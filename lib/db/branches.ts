import "server-only";
import { query, execute } from "@/lib/oracle";

export type BranchRow = {
  BRANCH_ID: number;
  COMPANY_ID: number;
  COMPANY_CODE: string;
  COMPANY_NAME: string;
  BRANCH_CODE: string;
  BRANCH_NAME: string;
  ADDRESS: string | null;
  STRN_NO: string | null;
  ACTIVE_YN: string;
  WAREHOUSE_COUNT: number;
};

export type BranchInput = {
  companyId: number;
  branchCode: string;
  branchName: string;
  address: string | null;
  strnNo: string | null;
  activeYn: "Y" | "N";
};

/**
 * Only branches inside the companies the user is scoped to. A scope row with a
 * NULL branch_id means every branch of that company, which is the same reading
 * pkg_security.check_scope applies.
 */
export async function listBranches(
  companyIds: number[],
  includeInactive: boolean,
) {
  if (companyIds.length === 0) return [];
  const binds: Record<string, number> = { includeInactive: includeInactive ? 1 : 0 };
  const names = companyIds.map((id, i) => {
    binds[`c${i}`] = id;
    return `:c${i}`;
  });

  return query<BranchRow>(
    `SELECT b.branch_id, b.company_id, c.company_code, c.company_name,
            b.branch_code, b.branch_name, b.address, b.strn_no, b.active_yn,
            (SELECT COUNT(*) FROM warehouse w WHERE w.branch_id = b.branch_id) AS warehouse_count
       FROM branch b
       JOIN company c ON c.company_id = b.company_id
      WHERE b.company_id IN (${names.join(",")})
        AND (:includeInactive = 1 OR b.active_yn = 'Y')
      ORDER BY c.company_code, b.branch_code`,
    binds,
  );
}

export async function getBranch(branchId: number) {
  const rows = await query<BranchRow>(
    `SELECT b.branch_id, b.company_id, c.company_code, c.company_name,
            b.branch_code, b.branch_name, b.address, b.strn_no, b.active_yn,
            0 AS warehouse_count
       FROM branch b
       JOIN company c ON c.company_id = b.company_id
      WHERE b.branch_id = :id`,
    { id: branchId },
  );
  return rows[0] ?? null;
}

/** Companies the user may file a branch under. */
export async function listScopedCompanies(companyIds: number[]) {
  if (companyIds.length === 0) return [];
  const binds: Record<string, number> = {};
  const names = companyIds.map((id, i) => {
    binds[`c${i}`] = id;
    return `:c${i}`;
  });

  return query<{ COMPANY_ID: number; COMPANY_CODE: string; COMPANY_NAME: string }>(
    `SELECT company_id, company_code, company_name
       FROM company
      WHERE company_id IN (${names.join(",")})
        AND active_yn = 'Y'
      ORDER BY company_code`,
    binds,
  );
}

export async function createBranch(input: BranchInput) {
  await execute(
    `INSERT INTO branch (company_id, branch_code, branch_name, address, strn_no, active_yn)
     VALUES (:companyId, :branchCode, :branchName, :address, :strnNo, :activeYn)`,
    { ...input },
  );
}

/** company_id is deliberately not updatable — moving a branch between companies
 *  would strand its warehouses, stock and posted documents. */
export async function updateBranch(branchId: number, input: BranchInput) {
  await execute(
    `UPDATE branch
        SET branch_code = :branchCode,
            branch_name = :branchName,
            address     = :address,
            strn_no     = :strnNo,
            active_yn   = :activeYn
      WHERE branch_id = :branchId`,
    {
      branchCode: input.branchCode,
      branchName: input.branchName,
      address: input.address,
      strnNo: input.strnNo,
      activeYn: input.activeYn,
      branchId,
    },
  );
}
