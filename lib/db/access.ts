import "server-only";
import { query } from "@/lib/oracle";
import { ACTIONS } from "@/lib/permissions";
import type { PermissionMap, ScopeRow } from "@/lib/permissions";

type PermRow = {
  MODULE_CODE: string;
  CAN_VIEW: string;
  CAN_CREATE: string;
  CAN_EDIT: string;
  CAN_POST: string;
  CAN_CANCEL: string;
  CAN_PRINT: string;
  CAN_APPROVE: string;
};

function packPermissions(rows: PermRow[]): PermissionMap {
  const map: PermissionMap = {};
  for (const r of rows) {
    // A module can arrive once per role, so the grants are OR-ed together.
    let letters = map[r.MODULE_CODE] ?? "";
    const add = (flag: string, letter: string) => {
      if (flag === "Y" && !letters.includes(letter)) letters += letter;
    };
    add(r.CAN_VIEW, ACTIONS.VIEW);
    add(r.CAN_CREATE, ACTIONS.CREATE);
    add(r.CAN_EDIT, ACTIONS.EDIT);
    add(r.CAN_POST, ACTIONS.POST);
    add(r.CAN_CANCEL, ACTIONS.CANCEL);
    add(r.CAN_PRINT, ACTIONS.PRINT);
    add(r.CAN_APPROVE, ACTIONS.APPROVE);
    map[r.MODULE_CODE] = letters;
  }
  return map;
}

export type UserAccess = {
  isActive: boolean;
  fullName: string;
  username: string;
  roles: string[];
  permissions: PermissionMap;
  access: ScopeRow[];
};

/**
 * Reads the user's live permissions and scope. Deliberately not cached in the
 * session token: a revoked permission or a removed company has to take effect
 * on the next request, not at the next sign-in.
 */
export async function loadUserAccess(userId: number): Promise<UserAccess | null> {
  const [users, roles, perms, scope] = await Promise.all([
    query<{ USERNAME: string; FULL_NAME: string; IS_ACTIVE: string }>(
      `SELECT username, full_name, is_active FROM app_user WHERE user_id = :id`,
      { id: userId },
    ),
    query<{ ROLE_NAME: string }>(
      `SELECT r.role_name
         FROM user_role ur
         JOIN role r ON r.role_id = ur.role_id
        WHERE ur.user_id = :id AND r.active_yn = 'Y'
        ORDER BY r.role_name`,
      { id: userId },
    ),
    query<PermRow>(
      `SELECT rp.module_code, rp.can_view, rp.can_create, rp.can_edit,
              rp.can_post, rp.can_cancel, rp.can_print, rp.can_approve
         FROM user_role ur
         JOIN role r ON r.role_id = ur.role_id
         JOIN role_permission rp ON rp.role_id = ur.role_id
        WHERE ur.user_id = :id AND r.active_yn = 'Y'`,
      { id: userId },
    ),
    query<{ COMPANY_ID: number; BRANCH_ID: number | null; WAREHOUSE_ID: number | null }>(
      `SELECT company_id, branch_id, warehouse_id
         FROM user_company_access
        WHERE user_id = :id`,
      { id: userId },
    ),
  ]);

  const user = users[0];
  if (!user) return null;

  return {
    isActive: user.IS_ACTIVE === "Y",
    username: user.USERNAME,
    fullName: user.FULL_NAME,
    roles: roles.map((r) => r.ROLE_NAME),
    permissions: packPermissions(perms),
    access: scope.map<ScopeRow>((a) => ({
      companyId: a.COMPANY_ID,
      branchId: a.BRANCH_ID,
      warehouseId: a.WAREHOUSE_ID,
    })),
  };
}
