import { requirePermission } from "@/lib/dal";
import { getActiveCompanyId } from "@/lib/active-scope";
import { listSelectableBranches } from "@/lib/db/warehouses";
import { listFiscalYears } from "@/lib/db/fiscal";
import { getCompany } from "@/lib/db/companies";
import SeriesForm from "../series-form";
import BackLink from "@/components/back-link/back-link";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "New numbering series · Sahulat ERP" };

export default async function NewSeriesPage() {
  const user = await requirePermission("NUMBERING_MAINT", "CREATE");
  const companyId = await getActiveCompanyId(user.access);

  if (!companyId) {
    return <p className={styles.empty}>Your account is not scoped to any company.</p>;
  }

  const [company, branches, fiscalYears] = await Promise.all([
    getCompany(companyId),
    listSelectableBranches([companyId]),
    listFiscalYears([companyId]),
  ]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <BackLink href="/admin/numbering-series">Numbering Series</BackLink>
          <h1 className={styles.title} style={{ marginTop: 4 }}>
            New numbering series
          </h1>
          <p className={styles.subtitle}>
            Company, branch, terminal and document type together identify
            this series — choose carefully, they cannot be changed afterwards.
          </p>
        </div>
      </div>

      <SeriesForm
        series={null}
        companyId={companyId}
        companyLabel={company ? `${company.COMPANY_CODE} — ${company.COMPANY_NAME}` : ""}
        branches={branches.map((b) => ({
          value: String(b.BRANCH_ID),
          label: `${b.BRANCH_CODE} — ${b.BRANCH_NAME}`,
        }))}
        fiscalYears={fiscalYears.map((f) => ({
          value: String(f.FY_ID),
          label: f.FY_NAME,
        }))}
      />
    </div>
  );
}
