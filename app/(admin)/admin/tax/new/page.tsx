import { requirePermission } from "@/lib/dal";
import { listAuthorities } from "@/lib/db/tax";
import { listPostableAccounts } from "@/lib/db/default-accounts";
import { getCompany } from "@/lib/db/companies";
import TaxCodeForm from "../tax-code-form";
import BackLink from "@/components/back-link/back-link";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "New tax code · Sahulat ERP" };

export default async function NewTaxCodePage() {
  const user = await requirePermission("TAX_MAINT", "CREATE");
  const companyId = user.access[0]?.companyId;

  if (!companyId) {
    return <p className={styles.empty}>Your account is not scoped to any company.</p>;
  }

  const [company, authorities, accounts] = await Promise.all([
    getCompany(companyId),
    listAuthorities(),
    listPostableAccounts(companyId),
  ]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <BackLink href="/admin/tax">Tax Authority &amp; Master</BackLink>
          <h1 className={styles.title} style={{ marginTop: 4 }}>
            New tax code
          </h1>
          <p className={styles.subtitle}>
            Company and tax code together identify this record — the code
            cannot be changed afterwards.
          </p>
        </div>
      </div>

      <TaxCodeForm
        taxCode={null}
        companyId={companyId}
        companyLabel={company ? `${company.COMPANY_CODE} — ${company.COMPANY_NAME}` : ""}
        authorities={authorities.map((a) => ({
          value: a.AUTHORITY_CODE,
          label: `${a.AUTHORITY_CODE} — ${a.AUTHORITY_NAME}`,
        }))}
        accounts={accounts.map((a) => ({
          value: String(a.COA_ID),
          label: `${a.ACCOUNT_CODE} — ${a.ACCOUNT_NAME}`,
        }))}
      />
    </div>
  );
}
