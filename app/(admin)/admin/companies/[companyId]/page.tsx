import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/dal";
import { getCompany } from "@/lib/db/companies";
import CompanyForm from "../company-form";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "Edit company · Sahulat ERP" };

export default async function EditCompanyPage({
  params,
}: PageProps<"/admin/companies/[companyId]">) {
  await requirePermission("COMPANY_MAINT", "EDIT");

  const { companyId } = await params;
  const id = Number(companyId);
  if (!Number.isInteger(id)) notFound();

  const company = await getCompany(id);
  if (!company) notFound();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <Link href="/admin/companies" className={styles.note}>
            ← Companies
          </Link>
          <h1 className={styles.title} style={{ marginTop: 4 }}>
            {company.COMPANY_NAME}
          </h1>
          <p className={styles.subtitle}>
            Changing the code affects how this company is identified on new
            documents; existing documents keep their own stored values.
          </p>
        </div>
      </div>

      <CompanyForm company={company} />
    </div>
  );
}
