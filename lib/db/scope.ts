import "server-only";
import { query } from "@/lib/oracle";
import type { ScopeRow } from "@/lib/permissions";

export type ScopeLabels = {
  company: string;
  branch: string;
  warehouse: string;
};

export type CompanyOption = {
  id: number;
  code: string;
  name: string;
};

/**
 * Every company the user has at least one access row for, for the scope
 * switcher. Ordered by name so the dropdown reads alphabetically rather than
 * in the access table's insertion order.
 */
export async function listAccessibleCompanies(
  access: ScopeRow[],
): Promise<CompanyOption[]> {
  const ids = [...new Set(access.map((a) => a.companyId))];
  if (ids.length === 0) return [];

  const rows = await query<{ COMPANY_ID: number; COMPANY_CODE: string; COMPANY_NAME: string }>(
    `SELECT company_id, company_code, company_name
       FROM company
      WHERE company_id IN (${ids.map((_, i) => `:id${i}`).join(",")})
      ORDER BY company_name`,
    Object.fromEntries(ids.map((id, i) => [`id${i}`, id])),
  );

  return rows.map((r) => ({ id: r.COMPANY_ID, code: r.COMPANY_CODE, name: r.COMPANY_NAME }));
}

/**
 * Human labels for the scope the user is currently working in. A NULL branch or
 * warehouse on the access row means unrestricted, which is shown as "All",
 * matching how pkg_security.check_scope reads the same NULLs. `activeCompanyId`
 * picks which of the user's access rows to describe — see lib/active-scope.ts.
 */
export async function getScopeLabels(
  access: ScopeRow[] | undefined,
  activeCompanyId: number | undefined,
): Promise<ScopeLabels | null> {
  const row =
    access?.find((a) => a.companyId === activeCompanyId) ?? access?.[0];
  if (!row) return null;

  const [company] = await query<{ COMPANY_NAME: string }>(
    `SELECT company_name FROM company WHERE company_id = :id`,
    { id: row.companyId },
  );

  let branch = "All branches";
  if (row.branchId !== null) {
    const [b] = await query<{ BRANCH_NAME: string }>(
      `SELECT branch_name FROM branch WHERE branch_id = :id`,
      { id: row.branchId },
    );
    branch = b?.BRANCH_NAME ?? "Unknown branch";
  }

  let warehouse = "All warehouses";
  if (row.warehouseId !== null) {
    const [w] = await query<{ WAREHOUSE_NAME: string }>(
      `SELECT warehouse_name FROM warehouse WHERE warehouse_id = :id`,
      { id: row.warehouseId },
    );
    warehouse = w?.WAREHOUSE_NAME ?? "Unknown warehouse";
  }

  return {
    company: company?.COMPANY_NAME ?? "Unknown company",
    branch,
    warehouse,
  };
}
