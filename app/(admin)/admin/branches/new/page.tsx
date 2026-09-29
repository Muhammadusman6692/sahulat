import Link from "next/link";
import { requirePermission } from "@/lib/dal";
import { listScopedCompanies } from "@/lib/db/branches";
import BranchForm from "../branch-form";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "New branch · Sahulat ERP" };

export default async function NewBranchPage() {
  const user = await requirePermission("BRANCH_MAINT", "CREATE");

  const companyIds = [...new Set(user.access.map((a) => a.companyId))];
  const companies = await listScopedCompanies(companyIds);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <Link href="/admin/branches" className={styles.note}>
            ← Branches
          </Link>
          <h1 className={styles.title} style={{ marginTop: 4 }}>
            New branch
          </h1>
          <p className={styles.subtitle}>
            Give the branch at least one warehouse afterwards, or nothing can be
            received into or sold from it.
          </p>
        </div>
      </div>

      {companies.length === 0 ? (
        <p className={styles.empty}>
          Your account is not scoped to any active company, so there is nothing
          to file a branch under.
        </p>
      ) : (
        <BranchForm
          branch={null}
          companies={companies.map((c) => ({
            id: c.COMPANY_ID,
            code: c.COMPANY_CODE,
            name: c.COMPANY_NAME,
          }))}
        />
      )}
    </div>
  );
}
