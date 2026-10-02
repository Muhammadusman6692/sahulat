import "server-only";
import { query } from "@/lib/oracle";
import { canView } from "@/lib/permissions";
import type { PermissionMap } from "@/lib/permissions";

export type BuildStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";

export type ModuleType = "SETUP" | "TRANSACTION" | "REPORT";

export type MenuItem = {
  moduleCode: string;
  label: string;
  href: string | null;
  status: BuildStatus;
  notes: string | null;
  type: ModuleType;
};

/**
 * One cluster of items inside a module group, all of the same kind. `label`
 * is null when the group is a single kind end to end (e.g. ADMIN is almost
 * all Setup) — labelling that would just repeat the group name.
 */
export type MenuSection = {
  type: ModuleType;
  label: string | null;
  items: MenuItem[];
};

export type MenuGroup = {
  group: string;
  label: string;
  sections: MenuSection[];
};

const TYPE_LABELS: Record<ModuleType, string> = {
  SETUP: "Setup",
  TRANSACTION: "Transactions",
  REPORT: "Reports",
};

const TYPE_ORDER: ModuleType[] = ["SETUP", "TRANSACTION", "REPORT"];

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
  DEFAULT_ACCT_MAINT: "/admin/default-accounts",
  NUMBERING_MAINT: "/admin/numbering-series",
  ITEM_MAINT: "/admin/items",
  USER_MAINT: "/admin/users",
  ROLE_MAINT: "/admin/roles",
  APPROVAL_MAINT: "/admin/approvals",
  PENDING_APPROVALS: "/admin/pending-approvals",
  TAX_MAINT: "/admin/tax",
  UOM_MAINT: "/admin/uom",
  ITEM_CAT_MAINT: "/admin/item-categories",
  ITEM_BRAND_MAINT: "/admin/item-brands",
  PARTY_MAINT: "/admin/parties",
  JV_ENTRY: "/admin/journal-vouchers",
  CASH_VOUCHER: "/admin/cash-vouchers",
  BANK_VOUCHER: "/admin/bank-vouchers",
  GL_REPORT: "/admin/gl-report",
  PARTY_LEDGER: "/admin/party-ledger",
  TRIAL_BALANCE: "/admin/trial-balance",
  PERIOD_CLOSE: "/admin/period-close",
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
  MODULE_TYPE: ModuleType;
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
    `SELECT module_code, module_name, module_group, module_type, build_status, build_notes
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
      type: r.MODULE_TYPE,
    });
    byGroup.set(r.MODULE_GROUP, list);
  }

  return GROUP_ORDER.filter((g) => byGroup.get(g)?.length).map((g) => ({
    group: g,
    label: GROUP_LABELS[g] ?? g,
    sections: toSections(byGroup.get(g)!),
  }));
}

/**
 * Splits a group's items into Setup/Transaction/Report clusters, in that
 * fixed order, each keeping the items' original sort_order. A group that is
 * only one type comes back as a single unlabelled section.
 */
function toSections(items: MenuItem[]): MenuSection[] {
  const distinctTypes = new Set(items.map((i) => i.type));
  if (distinctTypes.size <= 1) {
    return [{ type: items[0].type, label: null, items }];
  }
  return TYPE_ORDER.filter((t) => distinctTypes.has(t)).map((t) => ({
    type: t,
    label: TYPE_LABELS[t],
    items: items.filter((i) => i.type === t),
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
