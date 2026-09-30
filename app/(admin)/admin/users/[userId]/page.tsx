import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/dal";
import {
  getUser,
  getUserRoleIds,
  getUserAccessRows,
  listActiveRoles,
} from "@/lib/db/users";
import { listCompanies } from "@/lib/db/companies";
import { listSelectableBranches, listWarehouses } from "@/lib/db/warehouses";
import UserForm from "../user-form";
import ResetPassword from "../reset-password";
import { unlockUserAction } from "../actions";
import BackLink from "@/components/back-link/back-link";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "Edit user · Sahulat ERP" };

export default async function EditUserPage({
  params,
}: PageProps<"/admin/users/[userId]">) {
  await requirePermission("USER_MAINT", "EDIT");

  const { userId } = await params;
  const id = Number(userId);
  if (!Number.isInteger(id)) notFound();

  const user = await getUser(id);
  if (!user) notFound();

  const companies = await listCompanies(false);
  const companyIds = companies.map((c) => c.COMPANY_ID);
  const [branches, warehouses, roles, roleIds, accessRows] = await Promise.all([
    listSelectableBranches(companyIds),
    listWarehouses(companyIds, false),
    listActiveRoles(),
    getUserRoleIds(id),
    getUserAccessRows(id),
  ]);

  const locked = !!user.LOCKED_UNTIL && user.LOCKED_UNTIL.getTime() > Date.now();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <BackLink href="/admin/users">Users</BackLink>
          <h1 className={styles.title} style={{ marginTop: 4 }}>
            {user.USERNAME}
          </h1>
          <p className={styles.subtitle}>{user.FULL_NAME}</p>
        </div>
        {locked && (
          <form action={unlockUserAction.bind(null, id)}>
            <button type="submit" className={styles.btn} style={{ cursor: "pointer" }}>
              Unlock account
            </button>
          </form>
        )}
      </div>

      <UserForm
        user={user}
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
        initialRoleIds={roleIds}
        initialAccessRows={accessRows}
      />

      <ResetPassword userId={id} />
    </div>
  );
}
