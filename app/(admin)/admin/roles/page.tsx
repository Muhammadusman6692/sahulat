import Link from "next/link";
import { requirePermission } from "@/lib/dal";
import { listRoles } from "@/lib/db/roles";
import { can } from "@/lib/permissions";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "Roles & Permissions · Sahulat ERP" };

export default async function RolesPage() {
  const user = await requirePermission("ROLE_MAINT", "VIEW");
  const rows = await listRoles();
  const mayCreate = can(user.permissions, "ROLE_MAINT", "CREATE");
  const mayEdit = can(user.permissions, "ROLE_MAINT", "EDIT");

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <h1 className={styles.title}>Roles & Permissions</h1>
          <p className={styles.subtitle}>
            Each role grants a set of actions per module. A user&apos;s
            company/branch/warehouse access is granted separately, on the
            Users page — a role never limits where a user can work, only what
            they may do there.
          </p>
        </div>
        {mayCreate && (
          <Link href="/admin/roles/new" className={styles.btnPrimary}>
            <svg
              width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            New role
          </Link>
        )}
      </div>

      <div className={styles.card}>
        {rows.length === 0 ? (
          <p className={styles.empty}>No roles yet.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Role</th>
                <th>Company</th>
                <th>Modules granted</th>
                <th>Users</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ROLE_ID} className={r.ACTIVE_YN === "N" ? styles.inactiveRow : ""}>
                  <td className={styles.strong}>{r.ROLE_NAME}</td>
                  <td className={styles.muted}>{r.COMPANY_CODE ?? "Global"}</td>
                  <td className={styles.num}>{r.MODULES_GRANTED}</td>
                  <td className={styles.num}>{r.USER_COUNT}</td>
                  <td>
                    {r.ACTIVE_YN === "N" ? (
                      <span className={styles.badgeOff}>Inactive</span>
                    ) : (
                      <span className={styles.badgeOk}>Active</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {mayEdit && (
                      <Link href={`/admin/roles/${r.ROLE_ID}`} className={styles.pageLink}>
                        Edit
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
