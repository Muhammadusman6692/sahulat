import { requirePermission } from "@/lib/dal";
import { getActiveCompanyId } from "@/lib/active-scope";
import { getCompany } from "@/lib/db/companies";
import PartyForm from "../party-form";
import BackLink from "@/components/back-link/back-link";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "New party · Sahulat ERP" };

export default async function NewPartyPage() {
  const user = await requirePermission("PARTY_MAINT", "CREATE");
  const companyId = await getActiveCompanyId(user.access);

  if (!companyId) {
    return <p className={styles.empty}>Your account is not scoped to any company.</p>;
  }

  const company = await getCompany(companyId);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <BackLink href="/admin/parties">Parties</BackLink>
          <h1 className={styles.title} style={{ marginTop: 4 }}>
            New party
          </h1>
          <p className={styles.subtitle}>
            Its receivable/payable ledger account is created automatically once saved.
          </p>
        </div>
      </div>

      <PartyForm
        party={null}
        companyId={companyId}
        companyLabel={company ? `${company.COMPANY_CODE} — ${company.COMPANY_NAME}` : ""}
      />
    </div>
  );
}
