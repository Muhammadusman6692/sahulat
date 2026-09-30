import "server-only";
import { query } from "@/lib/oracle";
import { canView } from "@/lib/permissions";
import type { PermissionMap } from "@/lib/permissions";

export type BuildStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";

export type MenuItem = {
  moduleCode: string;
  label: string;
  href: string | null;
  status: BuildStatus;
  notes: string | null;
};

export type MenuGroup = {
  group: string;
  label: string;
  items: MenuItem[];
};

/**
 * Where a module's screen lives. A module with no entry here has not been
 * built yet, so the sidebar shows it greyed with its build badge rather than
 * linking to a 404.
 */
const ROUTES: Record<string, string> = {
  COMPANY_MAINT: "/admin/companies",
  BRANCH_MAINT: "/admin/branches",
  WAREHOUSE_MAINT: "/admin/warehouses",
  FISCAL_MAINT: "/admin/fiscal-years",
  COA_MAINT: "/admin/coa",
  ITEM_MAINT: "/admin/items",
};

const GROUP_LABELS: Record<string, string> = {
  ADMIN: "ADMIN",
  ACCOUNTING: "ACCOUNTING",
  TRADING: "TRADING",
  POS: "POS",
  DISTRIBUTION: "DISTRIBUTION",
  TAX: "TAX",
  REPORTS: "REPORTS",
};

const GROUP_ORDER = [
  "ADMIN",
  "ACCOUNTING",
  "TRADING",
  "POS",
  "DISTRIBUTION",
  "TAX",
  "REPORTS",
];

type Row = {
  MODULE_CODE: string;
  MODULE_NAME: string;
  MODULE_GROUP: string;
  BUILD_STATUS: BuildStatus;
  BUILD_NOTES: string | null;
};

/**
 * The sidebar is built from module_function, so the menu, the permission
 * matrix and the build tracker can never drift apart. LEGACY holds module
 * codes kept only because role_permission references them.
 */
export async function getMenu(permissions: PermissionMap): Promise<MenuGroup[]> {
  const rows = await query<Row>(
    `SELECT module_code, module_name, module_group, build_status, build_notes
       FROM module_function
      WHERE module_group != 'LEGACY'
      ORDER BY sort_order`,
  );

  const byGroup = new Map<string, MenuItem[]>();
  for (const r of rows) {
    if (!canView(permissions, r.MODULE_CODE)) continue;
    const list = byGroup.get(r.MODULE_GROUP) ?? [];
    list.push({
      moduleCode: r.MODULE_CODE,
      label: r.MODULE_NAME,
      href: ROUTES[r.MODULE_CODE] ?? null,
      status: r.BUILD_STATUS,
      notes: r.BUILD_NOTES,
    });
    byGroup.set(r.MODULE_GROUP, list);
  }

  return GROUP_ORDER.filter((g) => byGroup.get(g)?.length).map((g) => ({
    group: g,
    label: GROUP_LABELS[g] ?? g,
    items: byGroup.get(g)!,
  }));
}

export async function getBuildSummary() {
  return query<{ BUILD_STATUS: BuildStatus; MODULES: number }>(
    `SELECT build_status, COUNT(*) AS modules
       FROM module_function
      WHERE module_group != 'LEGACY'
      GROUP BY build_status`,
  );
}
