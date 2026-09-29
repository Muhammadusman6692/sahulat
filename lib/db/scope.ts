import "server-only";
import { query } from "@/lib/oracle";
import type { ScopeRow } from "@/lib/permissions";

export type ScopeLabels = {
  company: string;
  branch: string;
  warehouse: string;
};

/**
 * Human labels for the scope the user is currently working in. A NULL branch or
 * warehouse on the access row means unrestricted, which is shown as "All",
 * matching how pkg_security.check_scope reads the same NULLs.
 */
export async function getScopeLabels(
  access: ScopeRow[] | undefined,
): Promise<ScopeLabels | null> {
  const row = access?.[0];
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
