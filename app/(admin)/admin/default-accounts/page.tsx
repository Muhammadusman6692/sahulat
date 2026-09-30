import { requirePermission } from "@/lib/dal";
import {
  listRoles,
  getCompanyDefaults,
  listPostableAccounts,
} from "@/lib/db/default-accounts";
import { listParentCandidates } from "@/lib/db/coa";
import { getCompany } from "@/lib/db/companies";
import DefaultAccountsForm from "./default-accounts-form";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "Default GL Accounts · Sahulat ERP" };

export default async function DefaultAccountsPage() {
  const user = await requirePermission("DEFAULT_ACCT_MAINT", "VIEW");
  const companyId = user.access[0]?.companyId;

  if (!companyId) {
    return <p className={styles.empty}>Your account is not scoped to any company.</p>;
  }

  const [company, roles, current, accounts, parentAccounts] = await Promise.all([
    getCompany(companyId),
    listRoles(),
    getCompanyDefaults(companyId),
    listPostableAccounts(companyId),
    listParentCandidates(companyId),
  ]);

  const currentByRole = new Map(current.map((c) => [c.ROLE_CODE, c.COA_ID]));

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <h1 className={styles.title}>Default GL Accounts</h1>
          <p className={styles.subtitle}>
            {company ? `${company.COMPANY_CODE} — ${company.COMPANY_NAME}` : ""} · which
            posting account each document type hits automatically — the gap
            the original README flagged as needed before Trading can auto-post.
          </p>
        </div>
      </div>

      <DefaultAccountsForm
        companyId={companyId}
        roles={roles.map((r) => ({
          code: r.ROLE_CODE,
          name: r.ROLE_NAME,
          description: r.DESCRIPTION,
          currentCoaId: currentByRole.get(r.ROLE_CODE) ?? null,
        }))}
        accounts={accounts.map((a) => ({
          coaId: a.COA_ID,
          code: a.ACCOUNT_CODE,
          name: a.ACCOUNT_NAME,
          nature: a.ACCOUNT_NATURE,
        }))}
        parentAccounts={parentAccounts.map((a) => ({
          coaId: a.COA_ID,
          code: a.ACCOUNT_CODE,
          name: a.ACCOUNT_NAME,
          nature: "",
        }))}
      />

      <p className={styles.note}>
        Sales Invoice posting debits the customer&apos;s own account, then
        credits Sales and Output Sales Tax from here. Sales Return debits
        Sales Returns &amp; Allowances and credits the customer back.
      </p>
    </div>
  );
}
