import "server-only";
import { query, execute } from "@/lib/oracle";

export type CompanyRow = {
  COMPANY_ID: number;
  COMPANY_CODE: string;
  COMPANY_NAME: string;
  NTN_NO: string | null;
  STRN_NO: string | null;
  ADDRESS: string | null;
  FY_START_MONTH: number;
  BASE_CURRENCY: string;
  ACTIVE_YN: string;
  BRANCH_COUNT: number;
};

export type CompanyInput = {
  companyCode: string;
  companyName: string;
  ntnNo: string | null;
  strnNo: string | null;
  address: string | null;
  fyStartMonth: number;
  baseCurrency: string;
  activeYn: "Y" | "N";
};

export async function listCompanies(includeInactive: boolean) {
  return query<CompanyRow>(
    `SELECT c.company_id, c.company_code, c.company_name, c.ntn_no, c.strn_no,
            c.address, c.fy_start_month, c.base_currency, c.active_yn,
            (SELECT COUNT(*) FROM branch b WHERE b.company_id = c.company_id) AS branch_count
       FROM company c
      WHERE (:includeInactive = 1 OR c.active_yn = 'Y')
      ORDER BY c.company_code`,
    { includeInactive: includeInactive ? 1 : 0 },
  );
}

export async function getCompany(companyId: number) {
  const rows = await query<CompanyRow>(
    `SELECT c.company_id, c.company_code, c.company_name, c.ntn_no, c.strn_no,
            c.address, c.fy_start_month, c.base_currency, c.active_yn, 0 AS branch_count
       FROM company c
      WHERE c.company_id = :id`,
    { id: companyId },
  );
  return rows[0] ?? null;
}

export async function createCompany(input: CompanyInput, userId: number) {
  await execute(
    `INSERT INTO company (company_code, company_name, ntn_no, strn_no, address,
                          fy_start_month, base_currency, active_yn, created_by)
     VALUES (:companyCode, :companyName, :ntnNo, :strnNo, :address,
             :fyStartMonth, :baseCurrency, :activeYn, :userId)`,
    { ...input, userId },
  );
}

export async function updateCompany(
  companyId: number,
  input: CompanyInput,
) {
  await execute(
    `UPDATE company
        SET company_code   = :companyCode,
            company_name   = :companyName,
            ntn_no         = :ntnNo,
            strn_no        = :strnNo,
            address        = :address,
            fy_start_month = :fyStartMonth,
            base_currency  = :baseCurrency,
            active_yn      = :activeYn
      WHERE company_id = :companyId`,
    { ...input, companyId },
  );
}

/** Soft delete only — rows are never removed, so history keeps resolving. */
export async function setCompanyActive(companyId: number, active: boolean) {
  await execute(
    `UPDATE company SET active_yn = :flag WHERE company_id = :companyId`,
    { flag: active ? "Y" : "N", companyId },
  );
}
