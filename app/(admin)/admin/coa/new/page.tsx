import { requirePermission } from "@/lib/dal";
import { getActiveCompanyId } from "@/lib/active-scope";
import { listParentCandidates } from "@/lib/db/coa";
import { getCompany } from "@/lib/db/companies";
import CoaForm from "../coa-form";
import BackLink from "@/components/back-link/back-link";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "New account · Sahulat ERP" };

export default async function NewCoaAccountPage() {
  const user = await requirePermission("COA_MAINT", "CREATE");
  const companyId = await getActiveCompanyId(user.access);

  if (!companyId) {
    return <p className={styles.empty}>Your account is not scoped to any company.</p>;
  }

  const [company, parents] = await Promise.all([
    getCompany(companyId),
    listParentCandidates(companyId),
  ]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <BackLink href="/admin/coa">Chart of Accounts</BackLink>
          <h1 className={styles.title} style={{ marginTop: 4 }}>
            New account
          </h1>
          <p className={styles.subtitle}>
            Pick a parent to place this account in the tree — its level is
            derived from the parent, not typed by hand.
          </p>
        </div>
      </div>

      <CoaForm
        account={null}
        companyId={companyId}
        companyLabel={company ? `${company.COMPANY_CODE} — ${company.COMPANY_NAME}` : ""}
        parentOptions={parents.map((p) => ({
          id: p.COA_ID,
          code: p.ACCOUNT_CODE,
          name: p.ACCOUNT_NAME,
          level: p.ACCOUNT_LEVEL,
        }))}
      />
    </div>
  );
}
