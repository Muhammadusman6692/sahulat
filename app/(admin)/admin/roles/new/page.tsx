import { requirePermission } from "@/lib/dal";
import { listCompanies } from "@/lib/db/companies";
import { listModuleFunctions } from "@/lib/db/roles";
import RoleForm from "../role-form";
import BackLink from "@/components/back-link/back-link";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "New role · Sahulat ERP" };

export default async function NewRolePage() {
  await requirePermission("ROLE_MAINT", "CREATE");

  const [companies, modules] = await Promise.all([
    listCompanies(false),
    listModuleFunctions(),
  ]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <BackLink href="/admin/roles">Roles & Permissions</BackLink>
          <h1 className={styles.title} style={{ marginTop: 4 }}>
            New role
          </h1>
          <p className={styles.subtitle}>
            Leave company unset for a global role, such as Super Admin, that
            applies across every company.
          </p>
        </div>
      </div>

      <RoleForm
        role={null}
        companies={companies.map((c) => ({
          id: c.COMPANY_ID,
          code: c.COMPANY_CODE,
          name: c.COMPANY_NAME,
        }))}
        modules={modules}
      />
    </div>
  );
}
