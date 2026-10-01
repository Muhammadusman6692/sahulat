import "server-only";
import { query, execute, type Tx } from "@/lib/oracle";
import type { AccountNature, NormalSide, ControlType } from "@/lib/coa-types";

export type { AccountNature, NormalSide, ControlType };

export type CoaRow = {
  COA_ID: number;
  COMPANY_ID: number;
  ACCOUNT_CODE: string;
  ACCOUNT_NAME: string;
  PARENT_ID: number | null;
  ACCOUNT_LEVEL: number;
  ACCOUNT_NATURE: AccountNature;
  NORMAL_SIDE: NormalSide;
  IS_POSTABLE: "Y" | "N";
  IS_CONTROL_AC: ControlType;
  COST_CENTER_REQUIRED: "Y" | "N";
  ACTIVE_YN: "Y" | "N";
};

export type CoaNode = CoaRow & { children: CoaNode[] };

export async function listCoaFlat(companyId: number, includeInactive: boolean) {
  return query<CoaRow>(
    `SELECT coa_id, company_id, account_code, account_name, parent_id,
            account_level, account_nature, normal_side, is_postable,
            is_control_ac, cost_center_required, active_yn
       FROM coa
      WHERE company_id = :companyId
        AND (:includeInactive = 1 OR active_yn = 'Y')
      ORDER BY account_code`,
    { companyId, includeInactive: includeInactive ? 1 : 0 },
  );
}

/** Level-4 (postable) accounts a GL line can be coded to, e.g. for Journal
 *  Voucher entry. IS_CONTROL_AC drives whether a line needs a party. */
export async function listPostableAccounts(companyId: number) {
  return query<CoaRow>(
    `SELECT coa_id, company_id, account_code, account_name, parent_id,
            account_level, account_nature, normal_side, is_postable,
            is_control_ac, cost_center_required, active_yn
       FROM coa
      WHERE company_id = :companyId
        AND is_postable = 'Y'
        AND active_yn = 'Y'
      ORDER BY account_code`,
    { companyId },
  );
}

/** Builds the nested tree from the flat, company-scoped row list. */
export function buildCoaTree(rows: CoaRow[]): CoaNode[] {
  const byId = new Map<number, CoaNode>();
  for (const r of rows) byId.set(r.COA_ID, { ...r, children: [] });

  const roots: CoaNode[] = [];
  for (const node of byId.values()) {
    if (node.PARENT_ID !== null && byId.has(node.PARENT_ID)) {
      byId.get(node.PARENT_ID)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortByCode = (a: CoaNode, b: CoaNode) => a.ACCOUNT_CODE.localeCompare(b.ACCOUNT_CODE);
  const sortRec = (nodes: CoaNode[]) => {
    nodes.sort(sortByCode);
    for (const n of nodes) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}

export async function getCoaAccount(coaId: number) {
  const rows = await query<CoaRow>(
    `SELECT coa_id, company_id, account_code, account_name, parent_id,
            account_level, account_nature, normal_side, is_postable,
            is_control_ac, cost_center_required, active_yn
       FROM coa WHERE coa_id = :id`,
    { id: coaId },
  );
  return rows[0] ?? null;
}

/** Only levels 1–3 can be a parent; level 4 is postable and terminal. */
export async function listParentCandidates(companyId: number) {
  return query<{ COA_ID: number; ACCOUNT_CODE: string; ACCOUNT_NAME: string; ACCOUNT_LEVEL: number }>(
    `SELECT coa_id, account_code, account_name, account_level
       FROM coa
      WHERE company_id = :companyId
        AND account_level < 4
        AND active_yn = 'Y'
      ORDER BY account_code`,
    { companyId },
  );
}

export type CoaInput = {
  companyId: number;
  accountCode: string;
  accountName: string;
  parentId: number | null;
  accountLevel: number;
  accountNature: AccountNature;
  normalSide: NormalSide;
  isControlAc: ControlType;
  costCenterRequired: "Y" | "N";
  activeYn: "Y" | "N";
};

export async function createCoaAccount(input: CoaInput) {
  // Trigger trg_coa_level_chk still re-validates level = parent level + 1 (or
  // 1 with no parent) at the database — this mirrors that rule so a normal
  // submission never hits the raw trigger error, but the trigger remains the
  // real guard, not this check.
  await execute(
    `INSERT INTO coa (company_id, account_code, account_name, parent_id,
                      account_level, account_nature, normal_side,
                      is_control_ac, cost_center_required, active_yn)
     VALUES (:companyId, :accountCode, :accountName, :parentId,
             :accountLevel, :accountNature, :normalSide,
             :isControlAc, :costCenterRequired, :activeYn)`,
    { ...input },
  );
}

/**
 * parent_id and account_level are deliberately not updatable here: gl_voucher_line
 * references coa_id directly, so reparenting an account that already carries
 * postings would silently change what every historical transaction rolls up
 * into. company_id is likewise fixed — the same reasoning as branch/warehouse.
 */
export async function updateCoaAccount(
  coaId: number,
  input: Omit<CoaInput, "companyId" | "parentId" | "accountLevel">,
) {
  await execute(
    `UPDATE coa
        SET account_code         = :accountCode,
            account_name         = :accountName,
            account_nature       = :accountNature,
            normal_side          = :normalSide,
            is_control_ac        = :isControlAc,
            cost_center_required = :costCenterRequired,
            active_yn            = :activeYn
      WHERE coa_id = :coaId`,
    { ...input, coaId },
  );
}

export type ControlRole = "AR_CONTROL" | "AP_CONTROL";

/** The level 1-3 parent a company has mapped a control role to, set on the
 *  Default GL Accounts screen (company_default_account, same table every
 *  other posting-account role uses). */
export async function getControlParentCoaId(tx: Tx, companyId: number, role: ControlRole) {
  const rows = await tx.query<{ COA_ID: number; ACCOUNT_CODE: string; ACCOUNT_LEVEL: number }>(
    `SELECT c.coa_id, c.account_code, c.account_level
       FROM company_default_account cda
       JOIN coa c ON c.coa_id = cda.coa_id
      WHERE cda.company_id = :companyId AND cda.role_code = :role`,
    { companyId, role },
  );
  return rows[0] ?? null;
}

/** Next sequential 4-digit child code under a parent, e.g. "1-01-001" -> "1-01-001-0004". */
async function nextChildAccountCode(tx: Tx, companyId: number, parentCode: string) {
  const rows = await tx.query<{ MAX_SUFFIX: number }>(
    `SELECT NVL(MAX(TO_NUMBER(SUBSTR(account_code, LENGTH(:parentCode) + 2))), 0) AS max_suffix
       FROM coa
      WHERE company_id = :companyId
        AND account_code LIKE :pattern`,
    { companyId, parentCode, pattern: `${parentCode}-%` },
  );
  const next = (rows[0]?.MAX_SUFFIX ?? 0) + 1;
  return `${parentCode}-${String(next).padStart(4, "0")}`;
}

const CONTROL_ACCOUNT_SHAPE: Record<
  ControlRole,
  { nature: AccountNature; normalSide: NormalSide; controlType: Exclude<ControlType, null> }
> = {
  AR_CONTROL: { nature: "ASSET", normalSide: "D", controlType: "CUSTOMER" },
  AP_CONTROL: { nature: "LIABILITY", normalSide: "C", controlType: "SUPPLIER" },
};

/**
 * Creates the level-4 ledger account a customer/supplier needs the moment it
 * is saved — named after the party, filed under the company's AR/AP control
 * parent. Throws if that parent isn't mapped yet, so a party save fails with
 * an actionable error instead of guessing where to file the account. Always
 * called from inside the same transaction as the party write, so the two
 * rows land together or not at all.
 */
export async function createPartyLedgerAccount(
  tx: Tx,
  companyId: number,
  role: ControlRole,
  partyName: string,
): Promise<number> {
  const parent = await getControlParentCoaId(tx, companyId, role);
  if (!parent) {
    const label = role === "AR_CONTROL" ? "Accounts Receivable" : "Accounts Payable";
    throw new Error(
      `${label} control parent is not set for this company yet — set it on Default GL Accounts first.`,
    );
  }

  const shape = CONTROL_ACCOUNT_SHAPE[role];
  const accountCode = await nextChildAccountCode(tx, companyId, parent.ACCOUNT_CODE);

  // is_postable is a virtual column (derived from account_level = 4) — never
  // inserted directly, the same reason createCoaAccount above doesn't set it.
  await tx.execute(
    `INSERT INTO coa (company_id, account_code, account_name, parent_id, account_level,
                      account_nature, normal_side, is_control_ac, active_yn)
     VALUES (:companyId, :accountCode, :accountName, :parentId, :accountLevel,
             :accountNature, :normalSide, :controlType, 'Y')`,
    {
      companyId,
      accountCode,
      accountName: partyName,
      parentId: parent.COA_ID,
      accountLevel: parent.ACCOUNT_LEVEL + 1,
      accountNature: shape.nature,
      normalSide: shape.normalSide,
      controlType: shape.controlType,
    },
  );

  const [created] = await tx.query<{ COA_ID: number }>(
    `SELECT coa_id FROM coa WHERE company_id = :companyId AND account_code = :accountCode`,
    { companyId, accountCode },
  );
  if (!created) throw new Error("Ledger account row was not found after insert");
  return created.COA_ID;
}

export async function renamePartyLedgerAccount(tx: Tx, coaId: number, partyName: string) {
  await tx.execute(`UPDATE coa SET account_name = :name WHERE coa_id = :coaId`, {
    name: partyName,
    coaId,
  });
}

export async function setPartyLedgerAccountActive(tx: Tx, coaId: number, activeYn: "Y" | "N") {
  await tx.execute(`UPDATE coa SET active_yn = :activeYn WHERE coa_id = :coaId`, {
    activeYn,
    coaId,
  });
}
