import "server-only";
import { query, withTransaction } from "@/lib/oracle";

export type DefaultAccountRole = {
  ROLE_CODE: string;
  ROLE_NAME: string;
  DESCRIPTION: string | null;
};

/** The role list is a small, fixed reference set (like module_function) —
 *  the admin screen edits the coa_id mapping per company, not this list. */
export async function listRoles() {
  return query<DefaultAccountRole>(
    `SELECT role_code, role_name, description
       FROM default_account_role
      ORDER BY role_code`,
  );
}

export type CurrentMapping = {
  ROLE_CODE: string;
  COA_ID: number;
  ACCOUNT_CODE: string;
  ACCOUNT_NAME: string;
};

export async function getCompanyDefaults(companyId: number) {
  return query<CurrentMapping>(
    `SELECT cda.role_code, cda.coa_id, c.account_code, c.account_name
       FROM company_default_account cda
       JOIN coa c ON c.coa_id = cda.coa_id
      WHERE cda.company_id = :companyId`,
    { companyId },
  );
}

/** Only postable (level 4) accounts — the same rule pkg_gl.add_line enforces
 *  at the database, since a default account is only ever used as a voucher
 *  line's account. */
export async function listPostableAccounts(companyId: number) {
  return query<{
    COA_ID: number;
    ACCOUNT_CODE: string;
    ACCOUNT_NAME: string;
    ACCOUNT_NATURE: string;
  }>(
    `SELECT coa_id, account_code, account_name, account_nature
       FROM coa
      WHERE company_id = :companyId
        AND account_level = 4
        AND active_yn = 'Y'
      ORDER BY account_code`,
    { companyId },
  );
}

/**
 * Replaces the company's whole mapping set in one transaction: a role with a
 * chosen account is upserted, a role left unset (coaId null) has its row
 * removed so pkg_posting's get_default_account correctly reports it as
 * unconfigured rather than silently keeping a stale account.
 */
export async function saveDefaultAccounts(
  companyId: number,
  mappings: { roleCode: string; coaId: number | null }[],
) {
  await withTransaction(async (tx) => {
    for (const m of mappings) {
      if (m.coaId) {
        await tx.execute(
          `MERGE INTO company_default_account t
           USING (SELECT :companyId AS c, :roleCode AS r FROM dual) s
              ON (t.company_id = s.c AND t.role_code = s.r)
           WHEN MATCHED THEN UPDATE SET coa_id = :coaId
           WHEN NOT MATCHED THEN INSERT (company_id, role_code, coa_id)
             VALUES (:companyId, :roleCode, :coaId)`,
          { companyId, roleCode: m.roleCode, coaId: m.coaId },
        );
      } else {
        await tx.execute(
          `DELETE FROM company_default_account
            WHERE company_id = :companyId AND role_code = :roleCode`,
          { companyId, roleCode: m.roleCode },
        );
      }
    }
  });
}
