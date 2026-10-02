import "server-only";
import { query } from "@/lib/oracle";
import { fromOracleDate } from "@/lib/oracle-date";
import type { AccountNature, ControlType, NormalSide } from "@/lib/coa-types";

export type LedgerAccount = {
  COA_ID: number;
  ACCOUNT_CODE: string;
  ACCOUNT_NAME: string;
  ACCOUNT_NATURE: AccountNature;
  NORMAL_SIDE: NormalSide;
  IS_CONTROL_AC: ControlType;
};

export type LedgerLine = {
  VOUCHER_ID: number;
  VOUCHER_NO: string;
  VOUCHER_TYPE: string;
  VOUCHER_DATE: Date;
  NARRATION: string | null;
  PARTY_NAME: string | null;
  DEBIT_AMT: number;
  CREDIT_AMT: number;
  RUNNING_BALANCE: number;
};

export type AccountLedger = {
  account: LedgerAccount;
  openingBalance: number;
  lines: LedgerLine[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
};

export type LedgerFilters = {
  companyId: number;
  coaId: number;
  branchId?: number;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string; // YYYY-MM-DD
};

/** Signed per the account's normal side, so a Dr-normal account's balance
 *  reads positive when it actually holds a debit balance, and a Cr-normal
 *  account's (liability/equity/income) reads positive on a credit balance. */
function signedMovement(normalSide: NormalSide, debit: number, credit: number): number {
  return normalSide === "D" ? debit - credit : credit - debit;
}

/** Account ledger: opening balance (every POSTED line before dateFrom) +
 *  POSTED movements in [dateFrom, dateTo] with a running balance. CANCELLED
 *  vouchers are excluded and DRAFT ones never reach gl_voucher_line with a
 *  POSTED header, so this only ever reflects what pkg_gl actually posted. */
export async function getAccountLedger(f: LedgerFilters): Promise<AccountLedger | null> {
  const accounts = await query<LedgerAccount>(
    `SELECT coa_id, account_code, account_name, account_nature, normal_side, is_control_ac
       FROM coa
      WHERE coa_id = :coaId AND company_id = :companyId`,
    { coaId: f.coaId, companyId: f.companyId },
  );
  const account = accounts[0];
  if (!account) return null;

  const branchClause = f.branchId ? "AND h.branch_id = :branchId" : "";
  const binds: Record<string, string | number> = {
    coaId: f.coaId,
    companyId: f.companyId,
    dateFrom: f.dateFrom,
    dateTo: f.dateTo,
  };
  if (f.branchId) binds.branchId = f.branchId;

  // A separate bind set for the opening-balance query: it has no :dateTo
  // placeholder, and oracledb rejects an object carrying an unused bind.
  const openingBinds: Record<string, string | number> = {
    coaId: f.coaId,
    companyId: f.companyId,
    dateFrom: f.dateFrom,
  };
  if (f.branchId) openingBinds.branchId = f.branchId;

  const [openingRows, lineRows] = await Promise.all([
    query<{ TOTAL_DR: number; TOTAL_CR: number }>(
      `SELECT NVL(SUM(l.debit_amt),0) AS total_dr, NVL(SUM(l.credit_amt),0) AS total_cr
         FROM gl_voucher_line l
         JOIN gl_voucher_hdr h ON h.voucher_id = l.voucher_id
        WHERE l.coa_id = :coaId
          AND h.company_id = :companyId
          AND h.status = 'POSTED'
          AND h.voucher_date < TO_DATE(:dateFrom,'YYYY-MM-DD')
          ${branchClause}`,
      openingBinds,
    ),
    query<Omit<LedgerLine, "RUNNING_BALANCE">>(
      `SELECT h.voucher_id, h.voucher_no, h.voucher_type, h.voucher_date,
              l.narration, p.party_name, l.debit_amt, l.credit_amt
         FROM gl_voucher_line l
         JOIN gl_voucher_hdr h ON h.voucher_id = l.voucher_id
         LEFT JOIN party p ON p.party_id = l.party_id
        WHERE l.coa_id = :coaId
          AND h.company_id = :companyId
          AND h.status = 'POSTED'
          AND h.voucher_date BETWEEN TO_DATE(:dateFrom,'YYYY-MM-DD') AND TO_DATE(:dateTo,'YYYY-MM-DD')
          ${branchClause}
        ORDER BY h.voucher_date, h.voucher_id, l.line_id`,
      binds,
    ),
  ]);

  const openingBalance = signedMovement(
    account.NORMAL_SIDE,
    openingRows[0]?.TOTAL_DR ?? 0,
    openingRows[0]?.TOTAL_CR ?? 0,
  );

  let running = openingBalance;
  let totalDebit = 0;
  let totalCredit = 0;
  const lines: LedgerLine[] = lineRows.map((r) => {
    totalDebit += r.DEBIT_AMT;
    totalCredit += r.CREDIT_AMT;
    running += signedMovement(account.NORMAL_SIDE, r.DEBIT_AMT, r.CREDIT_AMT);
    return { ...r, VOUCHER_DATE: fromOracleDate(r.VOUCHER_DATE), RUNNING_BALANCE: running };
  });

  return {
    account,
    openingBalance,
    lines,
    totalDebit,
    totalCredit,
    closingBalance: running,
  };
}
