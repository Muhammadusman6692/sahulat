import "server-only";
import { query } from "@/lib/oracle";
import { fromOracleDate } from "@/lib/oracle-date";

export type PartyLedgerOption = {
  PARTY_ID: number;
  PARTY_CODE: string;
  PARTY_NAME: string;
  IS_CUSTOMER: "Y" | "N";
  IS_SUPPLIER: "Y" | "N";
};

/** Parties with at least one auto-created control account — the only ones
 *  that can have any gl_voucher_line activity to show. Loaded in full for a
 *  client-filtered combobox, same as listPostableAccounts + AccountCombobox. */
export async function listPartiesForLedger(companyId: number): Promise<PartyLedgerOption[]> {
  return query<PartyLedgerOption>(
    `SELECT party_id, party_code, party_name, is_customer, is_supplier
       FROM party
      WHERE company_id = :companyId
        AND active_yn = 'Y'
        AND (ar_coa_id IS NOT NULL OR ap_coa_id IS NOT NULL)
      ORDER BY party_code`,
    { companyId },
  );
}

export type PartyLedgerParty = {
  PARTY_ID: number;
  PARTY_CODE: string;
  PARTY_NAME: string;
  IS_CUSTOMER: "Y" | "N";
  IS_SUPPLIER: "Y" | "N";
  AR_COA_ID: number | null;
  AP_COA_ID: number | null;
};

export type PartyLedgerLine = {
  VOUCHER_ID: number;
  VOUCHER_NO: string;
  VOUCHER_TYPE: string;
  VOUCHER_DATE: Date;
  NARRATION: string | null;
  LEDGER_SIDE: "AR" | "AP";
  DEBIT_AMT: number;
  CREDIT_AMT: number;
  RUNNING_BALANCE: number;
};

export type PartyLedger = {
  party: PartyLedgerParty;
  openingBalance: number;
  lines: PartyLedgerLine[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
};

export type PartyLedgerFilters = {
  companyId: number;
  partyId: number;
  branchId?: number;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string; // YYYY-MM-DD
};

/**
 * One combined statement across a party's AR and AP control accounts: every
 * line nets as debit-minus-credit regardless of which of the two accounts it
 * actually hit, so the running balance reads as a single net position —
 * positive when the party owes the company, negative when the company owes
 * the party. (This is simply AR's own normal side applied uniformly: an AP
 * debit, e.g. paying a supplier, reduces what's owed exactly the way an AR
 * credit, e.g. a customer paying us, reduces what's owed.)
 */
export async function getPartyLedger(f: PartyLedgerFilters): Promise<PartyLedger | null> {
  const parties = await query<PartyLedgerParty>(
    `SELECT party_id, party_code, party_name, is_customer, is_supplier,
            ar_coa_id, ap_coa_id
       FROM party
      WHERE party_id = :partyId AND company_id = :companyId`,
    { partyId: f.partyId, companyId: f.companyId },
  );
  const party = parties[0];
  if (!party) return null;

  const coaIds = [party.AR_COA_ID, party.AP_COA_ID].filter((id): id is number => id != null);
  if (coaIds.length === 0) {
    return { party, openingBalance: 0, lines: [], totalDebit: 0, totalCredit: 0, closingBalance: 0 };
  }

  const placeholders = coaIds.map((_, i) => `:coa${i}`).join(",");
  const coaBinds = Object.fromEntries(coaIds.map((id, i) => [`coa${i}`, id]));

  const branchClause = f.branchId ? "AND h.branch_id = :branchId" : "";
  const binds: Record<string, string | number> = {
    ...coaBinds,
    companyId: f.companyId,
    dateFrom: f.dateFrom,
    dateTo: f.dateTo,
  };
  if (f.branchId) binds.branchId = f.branchId;

  const openingBinds: Record<string, string | number> = {
    ...coaBinds,
    companyId: f.companyId,
    dateFrom: f.dateFrom,
  };
  if (f.branchId) openingBinds.branchId = f.branchId;

  const [openingRows, lineRows] = await Promise.all([
    query<{ TOTAL_DR: number; TOTAL_CR: number }>(
      `SELECT NVL(SUM(l.debit_amt),0) AS total_dr, NVL(SUM(l.credit_amt),0) AS total_cr
         FROM gl_voucher_line l
         JOIN gl_voucher_hdr h ON h.voucher_id = l.voucher_id
        WHERE l.coa_id IN (${placeholders})
          AND h.company_id = :companyId
          AND h.status = 'POSTED'
          AND h.voucher_date < TO_DATE(:dateFrom,'YYYY-MM-DD')
          ${branchClause}`,
      openingBinds,
    ),
    query<Omit<PartyLedgerLine, "RUNNING_BALANCE" | "LEDGER_SIDE"> & { COA_ID: number }>(
      `SELECT h.voucher_id, h.voucher_no, h.voucher_type, h.voucher_date,
              l.narration, l.coa_id, l.debit_amt, l.credit_amt
         FROM gl_voucher_line l
         JOIN gl_voucher_hdr h ON h.voucher_id = l.voucher_id
        WHERE l.coa_id IN (${placeholders})
          AND h.company_id = :companyId
          AND h.status = 'POSTED'
          AND h.voucher_date BETWEEN TO_DATE(:dateFrom,'YYYY-MM-DD') AND TO_DATE(:dateTo,'YYYY-MM-DD')
          ${branchClause}
        ORDER BY h.voucher_date, h.voucher_id, l.line_id`,
      binds,
    ),
  ]);

  const openingBalance = (openingRows[0]?.TOTAL_DR ?? 0) - (openingRows[0]?.TOTAL_CR ?? 0);

  let running = openingBalance;
  let totalDebit = 0;
  let totalCredit = 0;
  const lines: PartyLedgerLine[] = lineRows.map((r) => {
    totalDebit += r.DEBIT_AMT;
    totalCredit += r.CREDIT_AMT;
    running += r.DEBIT_AMT - r.CREDIT_AMT;
    const { COA_ID, ...rest } = r;
    return {
      ...rest,
      VOUCHER_DATE: fromOracleDate(r.VOUCHER_DATE),
      LEDGER_SIDE: COA_ID === party.AR_COA_ID ? "AR" : "AP",
      RUNNING_BALANCE: running,
    };
  });

  return {
    party,
    openingBalance,
    lines,
    totalDebit,
    totalCredit,
    closingBalance: running,
  };
}
