import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/dal";
import { getRole, getRolePermissions } from "@/lib/db/roles";
import { listCompanies } from "@/lib/db/companies";
import RoleForm from "../role-form";
import BackLink from "@/components/back-link/back-link";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "Edit role · Sahulat ERP" };

export default async function EditRolePage({
  params,
}: PageProps<"/admin/roles/[roleId]">) {
  await requirePermission("ROLE_MAINT", "EDIT");

  const { roleId } = await params;
  const id = Number(roleId);
  if (!Number.isInteger(id)) notFound();

  const role = await getRole(id);
  if (!role) notFound();

  const [companies, modules] = await Promise.all([
    listCompanies(false),
    getRolePermissions(id),
  ]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <BackLink href="/admin/roles">Roles & Permissions</BackLink>
          <h1 className={styles.title} style={{ marginTop: 4 }}>
            {role.ROLE_NAME}
          </h1>
          <p className={styles.subtitle}>
            Changes apply the moment you save — every request reads this
            table live, so nobody holding this role needs to sign in again.
          </p>
        </div>
      </div>

      <RoleForm
        role={role}
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
