import Link from "next/link";
import { requirePermission } from "@/lib/dal";
import CompanyForm from "../company-form";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "New company · Sahulat ERP" };

export default async function NewCompanyPage() {
  await requirePermission("COMPANY_MAINT", "CREATE");

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <Link href="/admin/companies" className={styles.note}>
            ← Companies
          </Link>
          <h1 className={styles.title} style={{ marginTop: 4 }}>
            New company
          </h1>
          <p className={styles.subtitle}>
            A new company starts with no chart of accounts, fiscal year or
            numbering series — set those up next.
          </p>
        </div>
      </div>

      <CompanyForm company={null} />
    </div>
  );
}
