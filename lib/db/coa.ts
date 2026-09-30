import "server-only";
import { query, execute } from "@/lib/oracle";
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
