import "server-only";
import { query } from "@/lib/oracle";
import type { AccountNature } from "@/lib/coa-types";

export type DetailLevel = 2 | 3 | 4;

/** One printable line of the statement. Built here (not in the page) so the
 *  screen and the print view render the exact same structure. `amounts` holds
 *  one value per column — [asOf] or [asOf, compareAsOf] — already signed for
 *  presentation: assets Dr-Cr, equity/liabilities Cr-Dr, so a contra account
 *  (accumulated depreciation, drawings) comes out negative inside its group. */
export type BalanceSheetLine = {
  kind: "section" | "heading" | "account" | "earnings" | "subtotal" | "sectionTotal";
  depth: number; // indent level, 0 = section
  label: string;
  code?: string;
  coaId?: number; // set only for postable (level 4) accounts — drill-down target
  amounts: number[];
};

export type BalanceSheetColumn = {
  asOf: string; // YYYY-MM-DD
  fyStart: string | null; // start of the fiscal year containing asOf, null if none defined
  fyName: string | null;
  totalAssets: number;
  totalEquityAndLiabilities: number;
  currentYearEarnings: number;
  priorUnclosedEarnings: number;
  inBalance: boolean;
};

export type BalanceSheet = {
  lines: BalanceSheetLine[];
  columns: BalanceSheetColumn[];
  /** Fiscal years ending before the asOf year that are still OPEN — their
   *  profit is sitting outside Retained Earnings. */
  unclosedPriorYears: string[];
};

export type BalanceSheetFilters = {
  companyId: number;
  branchId?: number;
  asOf: string; // YYYY-MM-DD
  compareAsOf?: string; // YYYY-MM-DD
  level: DetailLevel;
  includeZero: boolean;
};

type CoaNode = {
  COA_ID: number;
  ACCOUNT_CODE: string;
  ACCOUNT_NAME: string;
  PARENT_ID: number | null;
  ACCOUNT_LEVEL: number;
  ACCOUNT_NATURE: AccountNature;
};

type Node = CoaNode & { children: Node[]; net: number[] }; // net = Dr - Cr per column

type FiscalYear = { FY_NAME: string; START_DATE: string; END_DATE: string; STATUS: string };

const BS_NATURES = "('ASSET','LIABILITY','EQUITY')";

/** Balance sheet as at one date (optionally a second, comparative date).
 *  Every POSTED line up to the date counts, CLOSING vouchers included — a
 *  balance sheet is cumulative. Profit not yet closed into Retained Earnings is
 *  derived from the INCOME/EXPENSE accounts over the same range: closed years
 *  net to zero there (their CLOSING voucher already moved them), so whatever is
 *  left is exactly the unclosed profit, split at the fiscal-year start into
 *  current year and prior years. No fiscal-year status logic is needed for
 *  the figures themselves; FY status only feeds the warning list. */
export async function getBalanceSheet(f: BalanceSheetFilters): Promise<BalanceSheet> {
  const dates = f.compareAsOf ? [f.asOf, f.compareAsOf] : [f.asOf];
  const branchClause = f.branchId ? "AND h.branch_id = :branchId" : "";

  const years = await query<FiscalYear>(
    `SELECT fy_name, TO_CHAR(start_date,'YYYY-MM-DD') AS start_date,
            TO_CHAR(end_date,'YYYY-MM-DD') AS end_date, status
       FROM fiscal_year
      WHERE company_id = :companyId
      ORDER BY start_date`,
    { companyId: f.companyId },
  );
  // YYYY-MM-DD strings compare correctly as text.
  const fyFor = (d: string) => years.find((y) => y.START_DATE <= d && d <= y.END_DATE) ?? null;
  const fys = dates.map(fyFor);

  const binds: Record<string, string | number> = { companyId: f.companyId };
  if (f.branchId) binds.branchId = f.branchId;
  dates.forEach((d, i) => {
    binds[`d${i}`] = d;
    // No fiscal year defined for the date: treat all unclosed profit as "current".
    binds[`fy${i}`] = fys[i]?.START_DATE ?? "0001-01-01";
  });
  const maxDate = dates.reduce((a, b) => (a > b ? a : b));
  binds.maxDate = maxDate;

  const netCols = dates
    .map(
      (_, i) =>
        `NVL(SUM(CASE WHEN h.voucher_date <= TO_DATE(:d${i},'YYYY-MM-DD')
                      THEN l.debit_amt - l.credit_amt END),0) AS net${i}`,
    )
    .join(",\n            ");

  const earningsCols = dates
    .map(
      (_, i) =>
        `NVL(SUM(CASE WHEN h.voucher_date <= TO_DATE(:d${i},'YYYY-MM-DD')
                      THEN l.credit_amt - l.debit_amt END),0) AS total${i},
            NVL(SUM(CASE WHEN h.voucher_date BETWEEN TO_DATE(:fy${i},'YYYY-MM-DD')
                                              AND TO_DATE(:d${i},'YYYY-MM-DD')
                      THEN l.credit_amt - l.debit_amt END),0) AS current${i}`,
    )
    .join(",\n            ");

  const glJoin = `FROM gl_voucher_line l
       JOIN gl_voucher_hdr h ON h.voucher_id = l.voucher_id
       JOIN coa c ON c.coa_id = l.coa_id
      WHERE h.company_id = :companyId
        AND h.status = 'POSTED'
        AND h.voucher_date <= TO_DATE(:maxDate,'YYYY-MM-DD')
        ${branchClause}`;

  const netBinds = { ...binds };
  const earnBinds = { ...binds };
  // Unused fy binds would make node-oracledb reject the statement.
  dates.forEach((_, i) => delete netBinds[`fy${i}`]);

  const [tree, balances, earnings] = await Promise.all([
    query<CoaNode>(
      `SELECT coa_id, account_code, account_name, parent_id, account_level, account_nature
         FROM coa
        WHERE company_id = :companyId
          AND account_nature IN ${BS_NATURES}
        ORDER BY account_code`,
      { companyId: f.companyId },
    ),
    query<Record<string, number>>(
      `SELECT l.coa_id, ${netCols}
         ${glJoin}
          AND c.account_nature IN ${BS_NATURES}
        GROUP BY l.coa_id`,
      netBinds,
    ),
    query<Record<string, number>>(
      `SELECT ${earningsCols}
         ${glJoin}
          AND c.account_nature IN ('INCOME','EXPENSE')`,
      earnBinds,
    ),
  ]);

  // ---- build and roll up the tree --------------------------------------
  const zero = () => dates.map(() => 0);
  const byId = new Map<number, Node>(tree.map((n) => [n.COA_ID, { ...n, children: [], net: zero() }]));
  const roots: Node[] = [];
  for (const n of byId.values()) {
    const parent = n.PARENT_ID != null ? byId.get(n.PARENT_ID) : undefined;
    if (parent) parent.children.push(n);
    else roots.push(n);
  }
  for (const b of balances) {
    const n = byId.get(b.COA_ID);
    if (n) dates.forEach((_, i) => (n.net[i] = b[`NET${i}`] ?? 0));
  }
  const rollUp = (n: Node): number[] => {
    for (const c of n.children) {
      const cn = rollUp(c);
      cn.forEach((v, i) => (n.net[i] += v));
    }
    return n.net;
  };
  roots.forEach(rollUp);

  const e = earnings[0] ?? {};
  const currentYear = dates.map((_, i) => e[`CURRENT${i}`] ?? 0);
  const priorUnclosed = dates.map((_, i) => (e[`TOTAL${i}`] ?? 0) - (e[`CURRENT${i}`] ?? 0));

  // ---- flatten into display lines --------------------------------------
  const lines: BalanceSheetLine[] = [];
  const isZero = (a: number[]) => a.every((v) => Math.abs(v) < 0.005);
  const signFor = (nature: AccountNature) => (nature === "ASSET" ? 1 : -1);

  const emit = (n: Node, sign: number, depth: number) => {
    const amounts = n.net.map((v) => v * sign);
    if (!f.includeZero && isZero(amounts)) return;
    if (n.ACCOUNT_LEVEL >= f.level || n.children.length === 0) {
      lines.push({
        kind: "account",
        depth,
        label: n.ACCOUNT_NAME,
        code: n.ACCOUNT_CODE,
        coaId: n.ACCOUNT_LEVEL === 4 ? n.COA_ID : undefined,
        amounts,
      });
      return;
    }
    lines.push({ kind: "heading", depth, label: n.ACCOUNT_NAME, code: n.ACCOUNT_CODE, amounts: [] });
    n.children.forEach((c) => emit(c, sign, depth + 1));
    lines.push({ kind: "subtotal", depth, label: `Total ${n.ACCOUNT_NAME}`, amounts });
  };

  /** One top-level (level 1) group. `label` null = the group *is* the section
   *  (a lone ASSETS node under the ASSETS section): its children go straight
   *  under the section and the section total stands in for its subtotal. */
  const emitGroup = (n: Node, label: string | null, extra?: () => void, extraAmounts?: number[]) => {
    const sign = signFor(n.ACCOUNT_NATURE);
    const amounts = n.net.map((v, i) => v * sign + (extraAmounts?.[i] ?? 0));
    const depth = label ? 2 : 1;
    if (label) lines.push({ kind: "heading", depth: 1, label, code: n.ACCOUNT_CODE, amounts: [] });
    n.children.forEach((c) => emit(c, sign, depth));
    extra?.();
    if (label) lines.push({ kind: "subtotal", depth: 1, label: `Total ${label}`, amounts });
    return amounts;
  };
  // Seeded level-1 names are all caps ("LIABILITIES"); with one group per
  // nature a plain label reads better. Several groups keep their own names.
  const groupLabel = (n: Node, siblings: Node[], fallback: string) =>
    siblings.length === 1 ? fallback : n.ACCOUNT_NAME;

  const sumCols = (rows: number[][]) => dates.map((_, i) => rows.reduce((s, r) => s + (r[i] ?? 0), 0));
  const rootsOf = (nature: AccountNature) => roots.filter((r) => r.ACCOUNT_NATURE === nature);

  // Assets
  lines.push({ kind: "section", depth: 0, label: "ASSETS", amounts: [] });
  const assetRoots = rootsOf("ASSET");
  const assetTotals = assetRoots.map((r) => emitGroup(r, assetRoots.length === 1 ? null : r.ACCOUNT_NAME));
  const totalAssets = sumCols(assetTotals);
  lines.push({ kind: "sectionTotal", depth: 0, label: "TOTAL ASSETS", amounts: totalAssets });

  // Equity & liabilities — equity first, with unclosed profit inside it.
  lines.push({ kind: "section", depth: 0, label: "EQUITY & LIABILITIES", amounts: [] });
  const earningsLines = () => {
    lines.push({
      kind: "earnings",
      depth: 2,
      label: fys[0] ? "Current year profit / (loss)" : "Profit / (loss) not yet closed",
      amounts: currentYear,
    });
    if (!isZero(priorUnclosed)) {
      lines.push({
        kind: "earnings",
        depth: 2,
        label: "Prior years' profit / (loss) not closed",
        amounts: priorUnclosed,
      });
    }
  };
  const earningsTotal = sumCols([currentYear, priorUnclosed]);
  const equityRoots = rootsOf("EQUITY");
  let equityTotals: number[][];
  if (equityRoots.length === 0) {
    lines.push({ kind: "heading", depth: 1, label: "Equity", amounts: [] });
    earningsLines();
    lines.push({ kind: "subtotal", depth: 1, label: "Total Equity", amounts: earningsTotal });
    equityTotals = [earningsTotal];
  } else {
    // Unclosed profit belongs to the first (normally only) equity group.
    equityTotals = equityRoots.map((r, idx) => {
      const label = groupLabel(r, equityRoots, "Equity");
      return idx === 0 ? emitGroup(r, label, earningsLines, earningsTotal) : emitGroup(r, label);
    });
  }
  const liabilityRoots = rootsOf("LIABILITY");
  const liabilityTotals = liabilityRoots.map((r) =>
    emitGroup(r, groupLabel(r, liabilityRoots, "Liabilities")),
  );
  const totalEL = sumCols([...equityTotals, ...liabilityTotals]);
  lines.push({ kind: "sectionTotal", depth: 0, label: "TOTAL EQUITY & LIABILITIES", amounts: totalEL });

  const asOfFy = fys[0];
  const unclosedPriorYears = asOfFy
    ? years.filter((y) => y.STATUS === "OPEN" && y.END_DATE < asOfFy.START_DATE).map((y) => y.FY_NAME)
    : [];

  return {
    lines,
    unclosedPriorYears,
    columns: dates.map((d, i) => ({
      asOf: d,
      fyStart: fys[i]?.START_DATE ?? null,
      fyName: fys[i]?.FY_NAME ?? null,
      totalAssets: totalAssets[i],
      totalEquityAndLiabilities: totalEL[i],
      currentYearEarnings: currentYear[i],
      priorUnclosedEarnings: priorUnclosed[i],
      inBalance: Math.abs(totalAssets[i] - totalEL[i]) < 0.01,
    })),
  };
}
