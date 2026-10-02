import "server-only";
import { query } from "@/lib/oracle";
import type { AccountNature, NormalSide } from "@/lib/coa-types";

export const NATURE_ORDER: AccountNature[] = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];

export type TrialBalanceRow = {
  COA_ID: number;
  ACCOUNT_CODE: string;
  ACCOUNT_NAME: string;
  ACCOUNT_NATURE: AccountNature;
  NORMAL_SIDE: NormalSide;
  OPENING_DR: number;
  OPENING_CR: number;
  PERIOD_DR: number;
  PERIOD_CR: number;
  CLOSING_DR: number;
  CLOSING_CR: number;
};

export type NatureSubtotal = {
  nature: AccountNature;
  openingDr: number;
  openingCr: number;
  periodDr: number;
  periodCr: number;
  closingDr: number;
  closingCr: number;
};

export type TrialBalance = {
  rows: TrialBalanceRow[];
  subtotals: NatureSubtotal[];
  totalOpeningDr: number;
  totalOpeningCr: number;
  totalPeriodDr: number;
  totalPeriodCr: number;
  totalClosingDr: number;
  totalClosingCr: number;
  inBalance: boolean;
};

export type TrialBalanceFilters = {
  companyId: number;
  branchId?: number;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string; // YYYY-MM-DD
  includeClosing: boolean;
  includeZero: boolean;
};

type RawRow = {
  COA_ID: number;
  ACCOUNT_CODE: string;
  ACCOUNT_NAME: string;
  ACCOUNT_NATURE: AccountNature;
  NORMAL_SIDE: NormalSide;
  OPENING_DR: number;
  OPENING_CR: number;
  PERIOD_DR: number;
  PERIOD_CR: number;
};

function emptySubtotal(nature: AccountNature): NatureSubtotal {
  return { nature, openingDr: 0, openingCr: 0, periodDr: 0, periodCr: 0, closingDr: 0, closingCr: 0 };
}

/** Trial balance: opening balance (every POSTED line before dateFrom), gross
 *  period movement in [dateFrom, dateTo], and a netted closing balance — per
 *  postable account, company-wide or for one branch. CLOSING (year-end)
 *  vouchers are excluded by default so the report reads as a pre-closing TB;
 *  the caller opts back in to see post-closing figures. Opening/closing are
 *  netted to a single Dr or Cr the way a TB is conventionally printed; period
 *  columns stay gross (both can be non-zero) since they report activity, not
 *  a balance.
 *
 *  gl_voucher_line and gl_voucher_hdr are joined to each other FIRST (inside
 *  the parenthesised block below), with the company/status/date/closing/
 *  branch filter as part of THAT join, and only the resulting (line,
 *  header) pair is LEFT-joined onto coa. Joining them as two independent
 *  sibling LEFT JOINs (coa→line, coa→line→header) does not work: a LEFT
 *  JOIN's ON-clause conditions decide whether the header's columns are
 *  populated or NULL, not whether the already-joined line row is kept — so
 *  a DRAFT/CANCELLED voucher's line still contributed its amount to SUM(),
 *  just with NULL header columns. Confirmed live: an account with zero
 *  POSTED vouchers (every gl_voucher_hdr row for it CANCELLED) was still
 *  showing non-zero opening/period balances before this fix — found while
 *  building Profit & Loss, which copied this same shape and had the same
 *  bug (see lib/db/profit-loss.ts). */
export async function getTrialBalance(f: TrialBalanceFilters): Promise<TrialBalance> {
  const branchClause = f.branchId ? "AND h.branch_id = :branchId" : "";
  const closingClause = f.includeClosing ? "" : "AND h.voucher_type != 'CLOSING'";

  const binds: Record<string, string | number> = {
    companyId: f.companyId,
    dateFrom: f.dateFrom,
    dateTo: f.dateTo,
  };
  if (f.branchId) binds.branchId = f.branchId;

  const rawRows = await query<RawRow>(
    `SELECT c.coa_id, c.account_code, c.account_name, c.account_nature, c.normal_side,
            NVL(SUM(CASE WHEN h.voucher_date <  TO_DATE(:dateFrom,'YYYY-MM-DD') THEN l.debit_amt  END),0) AS opening_dr,
            NVL(SUM(CASE WHEN h.voucher_date <  TO_DATE(:dateFrom,'YYYY-MM-DD') THEN l.credit_amt END),0) AS opening_cr,
            NVL(SUM(CASE WHEN h.voucher_date BETWEEN TO_DATE(:dateFrom,'YYYY-MM-DD')
                                                   AND TO_DATE(:dateTo,'YYYY-MM-DD') THEN l.debit_amt  END),0) AS period_dr,
            NVL(SUM(CASE WHEN h.voucher_date BETWEEN TO_DATE(:dateFrom,'YYYY-MM-DD')
                                                   AND TO_DATE(:dateTo,'YYYY-MM-DD') THEN l.credit_amt END),0) AS period_cr
       FROM coa c
       LEFT JOIN (
         gl_voucher_line l
         JOIN gl_voucher_hdr h ON h.voucher_id = l.voucher_id
                               AND h.company_id = :companyId
                               AND h.status = 'POSTED'
                               AND h.voucher_date <= TO_DATE(:dateTo,'YYYY-MM-DD')
                               ${closingClause}
                               ${branchClause}
       ) ON l.coa_id = c.coa_id
      WHERE c.company_id = :companyId
        AND c.is_postable = 'Y'
      GROUP BY c.coa_id, c.account_code, c.account_name, c.account_nature, c.normal_side
      ORDER BY c.account_code`,
    binds,
  );

  const subtotalsByNature = new Map<AccountNature, NatureSubtotal>(
    NATURE_ORDER.map((n) => [n, emptySubtotal(n)]),
  );

  let totalOpeningDr = 0;
  let totalOpeningCr = 0;
  let totalPeriodDr = 0;
  let totalPeriodCr = 0;
  let totalClosingDr = 0;
  let totalClosingCr = 0;

  const rows: TrialBalanceRow[] = [];

  for (const r of rawRows) {
    const openingNet = r.OPENING_DR - r.OPENING_CR;
    const openingDr = openingNet > 0 ? openingNet : 0;
    const openingCr = openingNet < 0 ? -openingNet : 0;
    const closingNet = openingNet + r.PERIOD_DR - r.PERIOD_CR;
    const closingDr = closingNet > 0 ? closingNet : 0;
    const closingCr = closingNet < 0 ? -closingNet : 0;

    if (
      !f.includeZero &&
      openingDr === 0 &&
      openingCr === 0 &&
      r.PERIOD_DR === 0 &&
      r.PERIOD_CR === 0 &&
      closingDr === 0 &&
      closingCr === 0
    ) {
      continue;
    }

    rows.push({
      COA_ID: r.COA_ID,
      ACCOUNT_CODE: r.ACCOUNT_CODE,
      ACCOUNT_NAME: r.ACCOUNT_NAME,
      ACCOUNT_NATURE: r.ACCOUNT_NATURE,
      NORMAL_SIDE: r.NORMAL_SIDE,
      OPENING_DR: openingDr,
      OPENING_CR: openingCr,
      PERIOD_DR: r.PERIOD_DR,
      PERIOD_CR: r.PERIOD_CR,
      CLOSING_DR: closingDr,
      CLOSING_CR: closingCr,
    });

    const sub = subtotalsByNature.get(r.ACCOUNT_NATURE) ?? emptySubtotal(r.ACCOUNT_NATURE);
    sub.openingDr += openingDr;
    sub.openingCr += openingCr;
    sub.periodDr += r.PERIOD_DR;
    sub.periodCr += r.PERIOD_CR;
    sub.closingDr += closingDr;
    sub.closingCr += closingCr;
    subtotalsByNature.set(r.ACCOUNT_NATURE, sub);

    totalOpeningDr += openingDr;
    totalOpeningCr += openingCr;
    totalPeriodDr += r.PERIOD_DR;
    totalPeriodCr += r.PERIOD_CR;
    totalClosingDr += closingDr;
    totalClosingCr += closingCr;
  }

  const subtotals = NATURE_ORDER.map((n) => subtotalsByNature.get(n)!).filter(
    (s) => f.includeZero || s.openingDr || s.openingCr || s.periodDr || s.periodCr || s.closingDr || s.closingCr,
  );

  return {
    rows,
    subtotals,
    totalOpeningDr,
    totalOpeningCr,
    totalPeriodDr,
    totalPeriodCr,
    totalClosingDr,
    totalClosingCr,
    inBalance: Math.abs(totalClosingDr - totalClosingCr) < 0.01,
  };
}
