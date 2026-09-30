import Link from "next/link";
import { requirePermission } from "@/lib/dal";
import { listUsers } from "@/lib/db/users";
import { unlockUserAction } from "./actions";
import { can } from "@/lib/permissions";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "Users · Sahulat ERP" };

export default async function UsersPage() {
  const user = await requirePermission("USER_MAINT", "VIEW");
  const rows = await listUsers();
  const mayCreate = can(user.permissions, "USER_MAINT", "CREATE");
  const mayEdit = can(user.permissions, "USER_MAINT", "EDIT");

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <h1 className={styles.title}>Users</h1>
          <p className={styles.subtitle}>
            Every user in the system, across every company — access to a
            specific company, branch or warehouse is granted per user below.
          </p>
        </div>
        {mayCreate && (
          <Link href="/admin/users/new" className={styles.btnPrimary}>
            <svg
              width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            New user
          </Link>
        )}
      </div>

      <div className={styles.card}>
        {rows.length === 0 ? (
          <p className={styles.empty}>No users yet.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Username</th>
                <th>Full name</th>
                <th>Roles</th>
                <th>Access</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const locked = !!r.LOCKED_UNTIL && r.LOCKED_UNTIL.getTime() > Date.now();
                return (
                  <tr key={r.USER_ID} className={r.IS_ACTIVE === "N" ? styles.inactiveRow : ""}>
                    <td className={styles.code}>{r.USERNAME}</td>
                    <td className={styles.strong}>{r.FULL_NAME}</td>
                    <td className={styles.muted}>{r.ROLES ?? "—"}</td>
                    <td className={styles.muted}>{r.ACCESS_SUMMARY ?? "—"}</td>
                    <td>
                      {r.IS_ACTIVE === "N" ? (
                        <span className={styles.badgeOff}>Inactive</span>
                      ) : locked ? (
                        <span className={styles.badgeWarn}>Locked</span>
                      ) : (
                        <span className={styles.badgeOk}>Active</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {mayEdit && locked && (
                        <form
                          action={unlockUserAction.bind(null, r.USER_ID)}
                          style={{ display: "inline-block", marginRight: 8 }}
                        >
                          <button type="submit" className={styles.pageLink} style={{ cursor: "pointer" }}>
                            Unlock
                          </button>
                        </form>
                      )}
                      {mayEdit && (
                        <Link href={`/admin/users/${r.USER_ID}`} className={styles.pageLink}>
                          Edit
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className={styles.note}>
        An account locks itself out after five failed sign-in attempts and
        unlocks on its own after 15 minutes, or immediately via Unlock here.
      </p>
    </div>
  );
}
