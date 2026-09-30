import "server-only";
import { query, execute } from "@/lib/oracle";

export type AuthorityRow = {
  AUTHORITY_CODE: string;
  AUTHORITY_NAME: string;
};

export async function listAuthorities() {
  return query<AuthorityRow>(
    `SELECT authority_code, authority_name FROM tax_authority ORDER BY authority_code`,
  );
}

export async function createAuthority(code: string, name: string) {
  await execute(
    `INSERT INTO tax_authority (authority_code, authority_name) VALUES (:code, :name)`,
    { code, name },
  );
}

export async function updateAuthority(code: string, name: string) {
  await execute(`UPDATE tax_authority SET authority_name = :name WHERE authority_code = :code`, {
    code,
    name,
  });
}

export type TaxCodeRow = {
  TAX_ID: number;
  COMPANY_ID: number;
  AUTHORITY_CODE: string;
  AUTHORITY_NAME: string;
  TAX_CODE: string;
  TAX_NAME: string;
  TAX_RATE: number;
  TAX_TYPE: string;
  TAX_COA_ID: number | null;
  ACCOUNT_CODE: string | null;
  ACCOUNT_NAME: string | null;
  ACTIVE_YN: "Y" | "N";
};

const SELECT_TAX_CODE = `
  SELECT t.tax_id, t.company_id, t.authority_code, a.authority_name,
         t.tax_code, t.tax_name, t.tax_rate, t.tax_type,
         t.tax_coa_id, coa.account_code, coa.account_name, t.active_yn
    FROM tax_master t
    JOIN tax_authority a ON a.authority_code = t.authority_code
    LEFT JOIN coa ON coa.coa_id = t.tax_coa_id
`;

export async function listTaxCodes(companyId: number) {
  return query<TaxCodeRow>(
    `${SELECT_TAX_CODE} WHERE t.company_id = :companyId ORDER BY t.tax_code`,
    { companyId },
  );
}

export async function getTaxCode(taxId: number) {
  const rows = await query<TaxCodeRow>(`${SELECT_TAX_CODE} WHERE t.tax_id = :id`, { id: taxId });
  return rows[0] ?? null;
}

/** Everything about a tax code except its identity (company + tax_code, fixed once created). */
export type TaxCodeFields = {
  authorityCode: string;
  taxName: string;
  taxRate: number;
  taxType: "SALES_TAX" | "WITHHOLDING" | "FURTHER_TAX" | "EXTRA_TAX";
  taxCoaId: number | null;
  activeYn: "Y" | "N";
};

export async function createTaxCode(companyId: number, taxCode: string, fields: TaxCodeFields) {
  await execute(
    `INSERT INTO tax_master (company_id, authority_code, tax_code, tax_name,
                             tax_rate, tax_type, tax_coa_id, active_yn)
     VALUES (:companyId, :authorityCode, :taxCode, :taxName,
             :taxRate, :taxType, :taxCoaId, :activeYn)`,
    { companyId, taxCode, ...fields },
  );
}

export async function updateTaxCode(taxId: number, fields: TaxCodeFields) {
  await execute(
    `UPDATE tax_master
        SET authority_code = :authorityCode,
            tax_name       = :taxName,
            tax_rate       = :taxRate,
            tax_type       = :taxType,
            tax_coa_id     = :taxCoaId,
            active_yn      = :activeYn
      WHERE tax_id = :taxId`,
    { ...fields, taxId },
  );
}
