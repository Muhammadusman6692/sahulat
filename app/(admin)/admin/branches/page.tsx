import Link from "next/link";
import { requirePermission } from "@/lib/dal";
import { listBranches } from "@/lib/db/branches";
import { can } from "@/lib/permissions";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "Branches · Sahulat ERP" };

export default async function BranchesPage({
  searchParams,
}: PageProps<"/admin/branches">) {
  const user = await requirePermission("BRANCH_MAINT", "VIEW");
  const sp = await searchParams;
  const includeInactive =
    (Array.isArray(sp.inactive) ? sp.inactive[0] : sp.inactive) === "1";

  const companyIds = [...new Set(user.access.map((a) => a.companyId))];
  const rows = await listBranches(companyIds, includeInactive);

  const mayCreate = can(user.permissions, "BRANCH_MAINT", "CREATE");
  const mayEdit = can(user.permissions, "BRANCH_MAINT", "EDIT");

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <h1 className={styles.title}>Branches</h1>
          <p className={styles.subtitle}>
            Branches belong to one company and cannot be moved between them.
            Stock is valued per branch, so each one carries its own weighted
            average cost.
          </p>
        </div>
        <Link
          href={includeInactive ? "/admin/branches" : "/admin/branches?inactive=1"}
          className={styles.btn}
        >
          {includeInactive ? "Active only" : "Show inactive"}
        </Link>
        {mayCreate && (
          <Link href="/admin/branches/new" className={styles.btnPrimary}>
            <svg
              width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            New branch
          </Link>
        )}
      </div>

      <div className={styles.card}>
        {rows.length === 0 ? (
          <p className={styles.empty}>
            No branches in the companies you are scoped to.
          </p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Company</th>
                <th>Code</th>
                <th>Branch name</th>
                <th>Address</th>
                <th>Branch STRN</th>
                <th style={{ textAlign: "right" }}>Warehouses</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const inactive = r.ACTIVE_YN !== "Y";
                return (
                  <tr key={r.BRANCH_ID} className={inactive ? styles.inactiveRow : undefined}>
                    <td className={styles.muted}>{r.COMPANY_CODE}</td>
                    <td className={styles.code}>{r.BRANCH_CODE}</td>
                    <td className={styles.strong}>{r.BRANCH_NAME}</td>
                    <td className={styles.muted}>{r.ADDRESS ?? "—"}</td>
                    <td className={styles.code}>{r.STRN_NO ?? "—"}</td>
                    <td className={styles.num}>{r.WAREHOUSE_COUNT}</td>
                    <td>
                      <span className={inactive ? styles.badgeOff : styles.badgeOk}>
                        {inactive ? "INACTIVE" : "ACTIVE"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {mayEdit && (
                        <Link
                          href={`/admin/branches/${r.BRANCH_ID}`}
                          className={styles.pageLink}
                        >
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
        You only see branches in companies your account is scoped to. A branch
        with no STRN of its own bills under the company's registration.
      </p>
    </div>
  );
}
