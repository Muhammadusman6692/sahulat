import "server-only";
import { query } from "@/lib/oracle";

export type PLRow = {
  COA_ID: number;
  ACCOUNT_CODE: string;
  ACCOUNT_NAME: string;
  AMOUNT: number; // signed: INCOME = credit - debit, EXPENSE = debit - credit
};

export type PLGroup = {
  code: string; // level-3 account_code, or "" for the unclassified fallback
  name: string;
  rows: PLRow[];
  subtotal: number;
};

export type PLSection = {
  coaId: number | null; // level-2 coa_id, null for the unclassified fallback
  code: string;
  name: string;
  groups: PLGroup[];
  total: number;
};

export type ProfitLoss = {
  dateFrom: string;
  dateTo: string;
  revenueSections: PLSection[];
  totalRevenue: number;
  cogsMapped: boolean;
  costOfSalesSections: PLSection[];
  totalCostOfSales: number;
  grossProfit: number | null;
  operatingExpenseSections: PLSection[];
  totalOperatingExpenses: number;
  netProfit: number;
  spansFiscalYears: boolean;
};

export type ProfitLossFilters = {
  companyId: number;
  branchId?: number;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string; // YYYY-MM-DD
  includeZero: boolean;
};

type RawRow = {
  COA_ID: number;
  ACCOUNT_CODE: string;
  ACCOUNT_NAME: string;
  ACCOUNT_NATURE: "INCOME" | "EXPENSE";
  L2_COA_ID: number | null;
  L2_CODE: string | null;
  L2_NAME: string | null;
  L3_CODE: string | null;
  L3_NAME: string | null;
  PERIOD_DR: number;
  PERIOD_CR: number;
};

const UNCLASSIFIED = { code: "", name: "(Unclassified)" };

function buildSections(rows: RawRow[], nature: "INCOME" | "EXPENSE", includeZero: boolean): PLSection[] {
  const sectionsByL2 = new Map<number | null, PLSection>();

  for (const r of rows) {
    if (r.ACCOUNT_NATURE !== nature) continue;

    const amount = nature === "INCOME" ? r.PERIOD_CR - r.PERIOD_DR : r.PERIOD_DR - r.PERIOD_CR;
    if (!includeZero && amount === 0) continue;

    const l2Key = r.L2_COA_ID;
    let section = sectionsByL2.get(l2Key);
    if (!section) {
      section = {
        coaId: l2Key,
        code: l2Key !== null ? r.L2_CODE! : UNCLASSIFIED.code,
        name: l2Key !== null ? r.L2_NAME! : UNCLASSIFIED.name,
        groups: [],
        total: 0,
      };
      sectionsByL2.set(l2Key, section);
    }

    const l3Key = r.L3_CODE ?? "";
    let group = section.groups.find((g) => g.code === l3Key);
    if (!group) {
      group = {
        code: l3Key,
        name: r.L3_NAME ?? UNCLASSIFIED.name,
        rows: [],
        subtotal: 0,
      };
      section.groups.push(group);
    }

    group.rows.push({
      COA_ID: r.COA_ID,
      ACCOUNT_CODE: r.ACCOUNT_CODE,
      ACCOUNT_NAME: r.ACCOUNT_NAME,
      AMOUNT: amount,
    });
    group.subtotal += amount;
    section.total += amount;
  }

  return Array.from(sectionsByL2.values())
    .filter((s) => includeZero || s.total !== 0 || s.groups.some((g) => g.rows.length > 0))
    .sort((a, b) => a.code.localeCompare(b.code));
}

/** The level-2 ancestor of the company's COGS default account, if mapped —
 *  that section is treated as Cost of Sales for the Gross Profit subtotal.
 *  Everything else of EXPENSE nature is Operating Expenses. Not hardcoding
 *  an account-code prefix here: a company that hasn't mapped COGS (Default
 *  GL Accounts screen) simply gets no Gross Profit line, not a wrong one. */
async function getCogsLevel2Id(companyId: number): Promise<number | null> {
  const rows = await query<{ L2_COA_ID: number }>(
    `SELECT l2.coa_id AS l2_coa_id
       FROM company_default_account cda
       JOIN coa c  ON c.coa_id = cda.coa_id
       JOIN coa l3 ON l3.coa_id = c.parent_id
       JOIN coa l2 ON l2.coa_id = l3.parent_id
      WHERE cda.company_id = :companyId
        AND cda.role_code = 'COGS'`,
    { companyId },
  );
  return rows[0]?.L2_COA_ID ?? null;
}

async function getSpansFiscalYears(companyId: number, dateFrom: string, dateTo: string): Promise<boolean> {
  const rows = await query<{ CNT: number }>(
    `SELECT COUNT(*) AS cnt
       FROM fiscal_year
      WHERE company_id = :companyId
        AND start_date <= TO_DATE(:dateTo,'YYYY-MM-DD')
        AND end_date   >= TO_DATE(:dateFrom,'YYYY-MM-DD')`,
    { companyId, dateFrom, dateTo },
  );
  return (rows[0]?.CNT ?? 0) > 1;
}

/** Profit & Loss: posted INCOME/EXPENSE movement in [dateFrom, dateTo],
 *  grouped by the COA hierarchy (level-2 = statement section, level-3 =
 *  sub-heading, level-4 = the posted line). Year-end CLOSING vouchers are
 *  always excluded — they zero every income/expense account for the year,
 *  so a P&L that included them would read zero for any closed year. Unlike
 *  Trial Balance there is no toggle for this; it is never a valid reading.
 *
 *  gl_voucher_line and gl_voucher_hdr are joined to each other FIRST (inside
 *  the parenthesised block below), with the company/status/date/branch
 *  filter as part of THAT join, and only the resulting (line, header) pair
 *  is LEFT-joined onto coa. Filtering status='POSTED' only on the
 *  line→header join (as a sibling LEFT JOIN, the way an earlier report in
 *  this codebase does it) does not work: a LEFT JOIN's ON-clause conditions
 *  decide whether the header's columns are populated or NULL, not whether
 *  the already-joined line row is kept — so a DRAFT/CANCELLED voucher's
 *  line still contributes its amount to SUM(), just with NULL header
 *  columns. Confirmed live: company 6 has zero POSTED gl_voucher_hdr rows,
 *  yet the sibling-LEFT-JOIN shape still summed its CANCELLED vouchers'
 *  line amounts. */
export async function getProfitLoss(f: ProfitLossFilters): Promise<ProfitLoss> {
  const branchClause = f.branchId ? "AND h.branch_id = :branchId" : "";
  const binds: Record<string, string | number> = {
    companyId: f.companyId,
    dateFrom: f.dateFrom,
    dateTo: f.dateTo,
  };
  if (f.branchId) binds.branchId = f.branchId;

  const [rawRows, cogsLevel2Id, spansFiscalYears] = await Promise.all([
    query<RawRow>(
      `SELECT c.coa_id, c.account_code, c.account_name, c.account_nature,
              l2.coa_id AS l2_coa_id, l2.account_code AS l2_code, l2.account_name AS l2_name,
              l3.account_code AS l3_code, l3.account_name AS l3_name,
              NVL(SUM(l.debit_amt),0)  AS period_dr,
              NVL(SUM(l.credit_amt),0) AS period_cr
         FROM coa c
         LEFT JOIN coa l3 ON l3.coa_id = c.parent_id
         LEFT JOIN coa l2 ON l2.coa_id = l3.parent_id
         LEFT JOIN (
           gl_voucher_line l
           JOIN gl_voucher_hdr h ON h.voucher_id = l.voucher_id
                                 AND h.company_id = :companyId
                                 AND h.status = 'POSTED'
                                 AND h.voucher_type != 'CLOSING'
                                 AND h.voucher_date BETWEEN TO_DATE(:dateFrom,'YYYY-MM-DD')
                                                         AND TO_DATE(:dateTo,'YYYY-MM-DD')
                                 ${branchClause}
         ) ON l.coa_id = c.coa_id
        WHERE c.company_id = :companyId
          AND c.is_postable = 'Y'
          AND c.account_nature IN ('INCOME','EXPENSE')
        GROUP BY c.coa_id, c.account_code, c.account_name, c.account_nature,
                 l2.coa_id, l2.account_code, l2.account_name,
                 l3.account_code, l3.account_name
        ORDER BY c.account_code`,
      binds,
    ),
    getCogsLevel2Id(f.companyId),
    getSpansFiscalYears(f.companyId, f.dateFrom, f.dateTo),
  ]);

  const revenueSections = buildSections(rawRows, "INCOME", f.includeZero);
  const totalRevenue = revenueSections.reduce((sum, s) => sum + s.total, 0);

  const allExpenseSections = buildSections(rawRows, "EXPENSE", f.includeZero);
  const cogsMapped = cogsLevel2Id !== null;
  const costOfSalesSections = cogsMapped
    ? allExpenseSections.filter((s) => s.coaId === cogsLevel2Id)
    : [];
  const operatingExpenseSections = cogsMapped
    ? allExpenseSections.filter((s) => s.coaId !== cogsLevel2Id)
    : allExpenseSections;

  const totalCostOfSales = costOfSalesSections.reduce((sum, s) => sum + s.total, 0);
  const totalOperatingExpenses = operatingExpenseSections.reduce((sum, s) => sum + s.total, 0);
  const grossProfit = cogsMapped ? totalRevenue - totalCostOfSales : null;
  const netProfit = totalRevenue - totalCostOfSales - totalOperatingExpenses;

  return {
    dateFrom: f.dateFrom,
    dateTo: f.dateTo,
    revenueSections,
    totalRevenue,
    cogsMapped,
    costOfSalesSections,
    totalCostOfSales,
    grossProfit,
    operatingExpenseSections,
    totalOperatingExpenses,
    netProfit,
    spansFiscalYears,
  };
}
