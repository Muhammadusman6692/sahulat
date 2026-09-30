import { requirePermission } from "@/lib/dal";
import { listCompanies } from "@/lib/db/companies";
import { listSelectableBranches, listWarehouses } from "@/lib/db/warehouses";
import { listActiveRoles } from "@/lib/db/users";
import UserForm from "../user-form";
import BackLink from "@/components/back-link/back-link";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "New user · Sahulat ERP" };

export default async function NewUserPage() {
  await requirePermission("USER_MAINT", "CREATE");

  const companies = await listCompanies(false);
  const companyIds = companies.map((c) => c.COMPANY_ID);
  const [branches, warehouses, roles] = await Promise.all([
    listSelectableBranches(companyIds),
    listWarehouses(companyIds, false),
    listActiveRoles(),
  ]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <BackLink href="/admin/users">Users</BackLink>
          <h1 className={styles.title} style={{ marginTop: 4 }}>
            New user
          </h1>
          <p className={styles.subtitle}>
            Username is fixed once created — everything else can change later.
          </p>
        </div>
      </div>

      <UserForm
        user={null}
        companies={companies.map((c) => ({
          id: c.COMPANY_ID,
          code: c.COMPANY_CODE,
          name: c.COMPANY_NAME,
        }))}
        branches={branches.map((b) => ({
          id: b.BRANCH_ID,
          code: b.BRANCH_CODE,
          name: b.BRANCH_NAME,
          companyId: b.COMPANY_ID,
        }))}
        warehouses={warehouses.map((w) => ({
          id: w.WAREHOUSE_ID,
          code: w.WAREHOUSE_CODE,
          name: w.WAREHOUSE_NAME,
          branchId: w.BRANCH_ID,
        }))}
        roles={roles.map((r) => ({
          id: r.ROLE_ID,
          name: r.ROLE_NAME,
          companyCode: r.COMPANY_CODE,
        }))}
        initialRoleIds={[]}
        initialAccessRows={[]}
      />
    </div>
  );
}
