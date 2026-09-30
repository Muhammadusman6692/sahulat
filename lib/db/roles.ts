import "server-only";
import { query, withTransaction, type Tx } from "@/lib/oracle";

export type RoleRow = {
  ROLE_ID: number;
  ROLE_NAME: string;
  COMPANY_ID: number | null;
  COMPANY_CODE: string | null;
  ACTIVE_YN: string;
  MODULES_GRANTED: number;
  USER_COUNT: number;
};

export async function listRoles() {
  return query<RoleRow>(
    `SELECT r.role_id, r.role_name, r.company_id, c.company_code, r.active_yn,
            (SELECT COUNT(*) FROM role_permission rp
              WHERE rp.role_id = r.role_id
                AND (rp.can_view = 'Y' OR rp.can_create = 'Y' OR rp.can_edit = 'Y'
                     OR rp.can_post = 'Y' OR rp.can_cancel = 'Y' OR rp.can_print = 'Y'
                     OR rp.can_approve = 'Y')) AS modules_granted,
            (SELECT COUNT(*) FROM user_role ur WHERE ur.role_id = r.role_id) AS user_count
       FROM role r
       LEFT JOIN company c ON c.company_id = r.company_id
      ORDER BY c.company_code NULLS FIRST, r.role_name`,
  );
}

export type RoleDetail = {
  ROLE_ID: number;
  ROLE_NAME: string;
  COMPANY_ID: number | null;
  ACTIVE_YN: string;
};

export async function getRole(roleId: number) {
  const rows = await query<RoleDetail>(
    `SELECT role_id, role_name, company_id, active_yn FROM role WHERE role_id = :id`,
    { id: roleId },
  );
  return rows[0] ?? null;
}

export type ModulePermissionRow = {
  MODULE_CODE: string;
  MODULE_NAME: string;
  MODULE_GROUP: string | null;
  SORT_ORDER: number;
  CAN_VIEW: string;
  CAN_CREATE: string;
  CAN_EDIT: string;
  CAN_POST: string;
  CAN_CANCEL: string;
  CAN_PRINT: string;
  CAN_APPROVE: string;
};

/** The full module list with every grant column forced to 'N', for a role that doesn't exist yet. */
export async function listModuleFunctions() {
  return query<ModulePermissionRow>(
    `SELECT module_code, module_name, module_group, sort_order,
            'N' AS can_view, 'N' AS can_create, 'N' AS can_edit,
            'N' AS can_post, 'N' AS can_cancel, 'N' AS can_print, 'N' AS can_approve
       FROM module_function
      ORDER BY sort_order, module_code`,
  );
}

/**
 * Every module_function row, LEFT JOINed to this role's grants so an
 * unsaved (or brand-new) role still gets a full, all-unchecked matrix.
 */
export async function getRolePermissions(roleId: number) {
  return query<ModulePermissionRow>(
    `SELECT m.module_code, m.module_name, m.module_group, m.sort_order,
            NVL(rp.can_view, 'N')    AS can_view,
            NVL(rp.can_create, 'N')  AS can_create,
            NVL(rp.can_edit, 'N')    AS can_edit,
            NVL(rp.can_post, 'N')    AS can_post,
            NVL(rp.can_cancel, 'N')  AS can_cancel,
            NVL(rp.can_print, 'N')   AS can_print,
            NVL(rp.can_approve, 'N') AS can_approve
       FROM module_function m
       LEFT JOIN role_permission rp ON rp.role_id = :id AND rp.module_code = m.module_code
      ORDER BY m.sort_order, m.module_code`,
    { id: roleId },
  );
}

export type ModulePermission = {
  moduleCode: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canPost: boolean;
  canCancel: boolean;
  canPrint: boolean;
  canApprove: boolean;
};

export type RoleInput = {
  roleName: string;
  companyId: number | null;
  activeYn: "Y" | "N";
};

const YN = (b: boolean) => (b ? "Y" : "N");

async function replacePermissions(tx: Tx, roleId: number, rows: ModulePermission[]) {
  await tx.execute(`DELETE FROM role_permission WHERE role_id = :id`, { id: roleId });
  // Only modules with at least one grant get a row — an all-N row carries no
  // information that NVL('N') in getRolePermissions doesn't already supply.
  const granted = rows.filter(
    (r) =>
      r.canView || r.canCreate || r.canEdit || r.canPost || r.canCancel || r.canPrint || r.canApprove,
  );
  for (const r of granted) {
    await tx.execute(
      `INSERT INTO role_permission
         (role_id, module_code, can_view, can_create, can_edit, can_post, can_cancel, can_print, can_approve)
       VALUES (:roleId, :moduleCode, :canView, :canCreate, :canEdit, :canPost, :canCancel, :canPrint, :canApprove)`,
      {
        roleId,
        moduleCode: r.moduleCode,
        canView: YN(r.canView),
        canCreate: YN(r.canCreate),
        canEdit: YN(r.canEdit),
        canPost: YN(r.canPost),
        canCancel: YN(r.canCancel),
        canPrint: YN(r.canPrint),
        canApprove: YN(r.canApprove),
      },
    );
  }
}

export async function createRole(input: RoleInput, permissions: ModulePermission[]) {
  await withTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO role (role_name, company_id, active_yn)
       VALUES (:roleName, :companyId, :activeYn)`,
      input,
    );

    // Read the id back rather than an OUT bind, matching createUser().
    const [created] = await tx.query<{ ROLE_ID: number }>(
      `SELECT role_id FROM role
        WHERE role_name = :roleName AND NVL(company_id, -1) = NVL(:companyId, -1)`,
      { roleName: input.roleName, companyId: input.companyId },
    );
    if (!created) throw new Error("Role row was not found after insert");

    await replacePermissions(tx, created.ROLE_ID, permissions);
  });
}

export async function updateRole(
  roleId: number,
  input: RoleInput,
  permissions: ModulePermission[],
) {
  await withTransaction(async (tx) => {
    await tx.execute(
      `UPDATE role SET role_name = :roleName, company_id = :companyId, active_yn = :activeYn
        WHERE role_id = :roleId`,
      { ...input, roleId },
    );
    await replacePermissions(tx, roleId, permissions);
  });
}
