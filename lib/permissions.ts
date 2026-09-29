export const ACTIONS = {
  VIEW: "V",
  CREATE: "C",
  EDIT: "E",
  POST: "P",
  CANCEL: "X",
  PRINT: "R",
  APPROVE: "A",
} as const;

export type Action = keyof typeof ACTIONS;

/**
 * module_code -> granted action letters, e.g. { SALES_INVOICE: "VCEPR" }.
 * Packed into one string per module so the whole matrix fits in a cookie-sized
 * JWT; 24 modules of seven booleans each would not.
 */
export type PermissionMap = Record<string, string>;

export type ScopeRow = {
  companyId: number;
  branchId: number | null;
  warehouseId: number | null;
};

export type SessionUser = {
  userId: number;
  username: string;
  fullName: string;
  roles: string[];
  permissions: PermissionMap;
  access: ScopeRow[];
};

export function can(
  permissions: PermissionMap | undefined,
  moduleCode: string,
  action: Action,
): boolean {
  return permissions?.[moduleCode]?.includes(ACTIONS[action]) ?? false;
}

/** True when the user may see the module at all. */
export function canView(
  permissions: PermissionMap | undefined,
  moduleCode: string,
): boolean {
  return can(permissions, moduleCode, "VIEW");
}

/**
 * Whether a company/branch/warehouse selection falls inside the user's granted
 * scope. A NULL branch or warehouse on a scope row means "all of them", which
 * mirrors how pkg_security.check_scope reads the same table.
 */
export function inScope(
  access: ScopeRow[] | undefined,
  companyId: number,
  branchId?: number | null,
  warehouseId?: number | null,
): boolean {
  if (!access) return false;
  return access.some(
    (row) =>
      row.companyId === companyId &&
      (row.branchId === null || row.branchId === branchId) &&
      (row.warehouseId === null || row.warehouseId === warehouseId),
  );
}
