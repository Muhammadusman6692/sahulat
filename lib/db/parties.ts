import "server-only";
import { query, withTransaction, type Tx } from "@/lib/oracle";
import {
  createPartyLedgerAccount,
  renamePartyLedgerAccount,
  setPartyLedgerAccountActive,
  type ControlRole,
} from "@/lib/db/coa";

export type PartyRow = {
  PARTY_ID: number;
  PARTY_CODE: string;
  PARTY_NAME: string;
  IS_CUSTOMER: "Y" | "N";
  IS_SUPPLIER: "Y" | "N";
  NTN_NO: string | null;
  STRN_NO: string | null;
  PHONE: string | null;
  CREDIT_LIMIT: number;
  CREDIT_DAYS: number;
  AR_ACCOUNT_CODE: string | null;
  AP_ACCOUNT_CODE: string | null;
  ACTIVE_YN: "Y" | "N";
};

export type PartyListFilters = {
  companyId: number;
  search?: string;
  type?: "CUSTOMER" | "SUPPLIER";
  includeInactive?: boolean;
  page: number;
  pageSize: number;
};

export type PartyListResult = { rows: PartyRow[]; total: number };

const SELECT_LIST = `
  SELECT p.party_id, p.party_code, p.party_name, p.is_customer, p.is_supplier,
         p.ntn_no, p.strn_no, p.phone, p.credit_limit, p.credit_days, p.active_yn,
         ar.account_code AS ar_account_code, ap.account_code AS ap_account_code
    FROM party p
    LEFT JOIN coa ar ON ar.coa_id = p.ar_coa_id
    LEFT JOIN coa ap ON ap.coa_id = p.ap_coa_id
`;

function buildWhere(f: PartyListFilters) {
  const where: string[] = ["p.company_id = :companyId"];
  const binds: Record<string, string | number> = { companyId: f.companyId };

  if (f.search) {
    where.push(`(UPPER(p.party_code) LIKE :search OR UPPER(p.party_name) LIKE :search)`);
    binds.search = `%${f.search.toUpperCase()}%`;
  }
  if (f.type === "CUSTOMER") where.push("p.is_customer = 'Y'");
  if (f.type === "SUPPLIER") where.push("p.is_supplier = 'Y'");
  if (!f.includeInactive) where.push("p.active_yn = 'Y'");

  return { clause: `WHERE ${where.join(" AND ")}`, binds };
}

export async function listParties(f: PartyListFilters): Promise<PartyListResult> {
  const { clause, binds } = buildWhere(f);

  const [rows, counted] = await Promise.all([
    query<PartyRow>(
      `${SELECT_LIST} ${clause}
       ORDER BY p.party_code
       OFFSET :skip ROWS FETCH NEXT :take ROWS ONLY`,
      { ...binds, skip: (f.page - 1) * f.pageSize, take: f.pageSize },
    ),
    query<{ TOTAL: number }>(`SELECT COUNT(*) AS total FROM party p ${clause}`, binds),
  ]);

  return { rows, total: counted[0]?.TOTAL ?? 0 };
}

export type PartyDetail = {
  PARTY_ID: number;
  COMPANY_ID: number;
  PARTY_CODE: string;
  PARTY_NAME: string;
  IS_CUSTOMER: "Y" | "N";
  IS_SUPPLIER: "Y" | "N";
  NTN_NO: string | null;
  STRN_NO: string | null;
  PHONE: string | null;
  ADDRESS: string | null;
  CREDIT_LIMIT: number;
  CREDIT_DAYS: number;
  AR_COA_ID: number | null;
  AP_COA_ID: number | null;
  AR_ACCOUNT_CODE: string | null;
  AP_ACCOUNT_CODE: string | null;
  ACTIVE_YN: "Y" | "N";
};

export async function getParty(partyId: number) {
  const rows = await query<PartyDetail>(
    `SELECT p.party_id, p.company_id, p.party_code, p.party_name,
            p.is_customer, p.is_supplier, p.ntn_no, p.strn_no, p.phone, p.address,
            p.credit_limit, p.credit_days, p.ar_coa_id, p.ap_coa_id, p.active_yn,
            ar.account_code AS ar_account_code, ap.account_code AS ap_account_code
       FROM party p
       LEFT JOIN coa ar ON ar.coa_id = p.ar_coa_id
       LEFT JOIN coa ap ON ap.coa_id = p.ap_coa_id
      WHERE p.party_id = :id`,
    { id: partyId },
  );
  return rows[0] ?? null;
}

export type PartyInput = {
  companyId: number;
  partyCode: string;
  partyName: string;
  isCustomer: "Y" | "N";
  isSupplier: "Y" | "N";
  ntnNo: string | null;
  strnNo: string | null;
  phone: string | null;
  address: string | null;
  creditLimit: number;
  creditDays: number;
  activeYn: "Y" | "N";
};

/**
 * Creates or keeps in sync the ledger account behind one side (AR or AP) of a
 * party: makes it the first time the flag is switched on, otherwise just
 * keeps its name and active state matching the party. Never deletes or
 * unlinks a created account — turning the flag off only deactivates it, same
 * "never delete" rule every other master here follows.
 */
async function syncLedgerAccount(
  tx: Tx,
  companyId: number,
  role: ControlRole,
  flagOn: boolean,
  partyActive: boolean,
  partyName: string,
  existingCoaId: number | null,
): Promise<number | null> {
  if (!existingCoaId) {
    if (!flagOn) return null;
    return createPartyLedgerAccount(tx, companyId, role, partyName);
  }
  await renamePartyLedgerAccount(tx, existingCoaId, partyName);
  await setPartyLedgerAccountActive(tx, existingCoaId, flagOn && partyActive ? "Y" : "N");
  return existingCoaId;
}

export async function createParty(input: PartyInput) {
  await withTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO party (company_id, party_code, party_name, is_supplier, is_customer,
                          ntn_no, strn_no, phone, address, credit_limit, credit_days, active_yn)
       VALUES (:companyId, :partyCode, :partyName, :isSupplier, :isCustomer,
               :ntnNo, :strnNo, :phone, :address, :creditLimit, :creditDays, :activeYn)`,
      {
        companyId: input.companyId,
        partyCode: input.partyCode,
        partyName: input.partyName,
        isSupplier: input.isSupplier,
        isCustomer: input.isCustomer,
        ntnNo: input.ntnNo,
        strnNo: input.strnNo,
        phone: input.phone,
        address: input.address,
        creditLimit: input.creditLimit,
        creditDays: input.creditDays,
        activeYn: input.activeYn,
      },
    );

    const [created] = await tx.query<{ PARTY_ID: number }>(
      `SELECT party_id FROM party WHERE company_id = :companyId AND party_code = :partyCode`,
      { companyId: input.companyId, partyCode: input.partyCode },
    );
    if (!created) throw new Error("Party row was not found after insert");

    const partyActive = input.activeYn === "Y";
    const arCoaId = await syncLedgerAccount(
      tx, input.companyId, "AR_CONTROL", input.isCustomer === "Y", partyActive, input.partyName, null,
    );
    const apCoaId = await syncLedgerAccount(
      tx, input.companyId, "AP_CONTROL", input.isSupplier === "Y", partyActive, input.partyName, null,
    );

    await tx.execute(
      `UPDATE party SET ar_coa_id = :arCoaId, ap_coa_id = :apCoaId WHERE party_id = :partyId`,
      { arCoaId, apCoaId, partyId: created.PARTY_ID },
    );
  });
}

/** company_id is fixed — the same reasoning as every other master here. */
export async function updateParty(
  partyId: number,
  existing: PartyDetail,
  input: Omit<PartyInput, "companyId">,
) {
  await withTransaction(async (tx) => {
    await tx.execute(
      `UPDATE party
          SET party_code    = :partyCode,
              party_name    = :partyName,
              is_supplier   = :isSupplier,
              is_customer   = :isCustomer,
              ntn_no        = :ntnNo,
              strn_no       = :strnNo,
              phone         = :phone,
              address       = :address,
              credit_limit  = :creditLimit,
              credit_days   = :creditDays,
              active_yn     = :activeYn
        WHERE party_id = :partyId`,
      { ...input, partyId },
    );

    const partyActive = input.activeYn === "Y";
    const arCoaId = await syncLedgerAccount(
      tx, existing.COMPANY_ID, "AR_CONTROL", input.isCustomer === "Y", partyActive, input.partyName, existing.AR_COA_ID,
    );
    const apCoaId = await syncLedgerAccount(
      tx, existing.COMPANY_ID, "AP_CONTROL", input.isSupplier === "Y", partyActive, input.partyName, existing.AP_COA_ID,
    );

    if (arCoaId !== existing.AR_COA_ID || apCoaId !== existing.AP_COA_ID) {
      await tx.execute(
        `UPDATE party SET ar_coa_id = :arCoaId, ap_coa_id = :apCoaId WHERE party_id = :partyId`,
        { arCoaId, apCoaId, partyId },
      );
    }
  });
}
