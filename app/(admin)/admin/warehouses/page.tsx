import Link from "next/link";
import { requirePermission } from "@/lib/dal";
import { listWarehouses } from "@/lib/db/warehouses";
import { can } from "@/lib/permissions";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "Warehouses · Sahulat ERP" };

export default async function WarehousesPage({
  searchParams,
}: PageProps<"/admin/warehouses">) {
  const user = await requirePermission("WAREHOUSE_MAINT", "VIEW");
  const sp = await searchParams;
  const includeInactive =
    (Array.isArray(sp.inactive) ? sp.inactive[0] : sp.inactive) === "1";

  const companyIds = [...new Set(user.access.map((a) => a.companyId))];
  const rows = await listWarehouses(companyIds, includeInactive);

  const mayCreate = can(user.permissions, "WAREHOUSE_MAINT", "CREATE");
  const mayEdit = can(user.permissions, "WAREHOUSE_MAINT", "EDIT");

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <h1 className={styles.title}>Warehouses</h1>
          <p className={styles.subtitle}>
            Stock lives in a warehouse and is valued per branch. A shared
            warehouse can be used by more than one branch of the same company.
          </p>
        </div>
        <Link
          href={includeInactive ? "/admin/warehouses" : "/admin/warehouses?inactive=1"}
          className={styles.btn}
        >
          {includeInactive ? "Active only" : "Show inactive"}
        </Link>
        {mayCreate && (
          <Link href="/admin/warehouses/new" className={styles.btnPrimary}>
            <svg
              width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            New warehouse
          </Link>
        )}
      </div>

      <div className={styles.card}>
        {rows.length === 0 ? (
          <p className={styles.empty}>
            No warehouses in the companies you are scoped to.
          </p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Company</th>
                <th>Owning branch</th>
                <th>Code</th>
                <th>Warehouse name</th>
                <th>Access</th>
                <th style={{ textAlign: "right" }}>Ledger rows</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const inactive = r.ACTIVE_YN !== "Y";
                const shared = r.IS_SHARED === "Y";
                return (
                  <tr
                    key={r.WAREHOUSE_ID}
                    className={inactive ? styles.inactiveRow : undefined}
                  >
                    <td className={styles.muted}>{r.COMPANY_CODE}</td>
                    <td className={styles.muted}>
                      {r.BRANCH_CODE} — {r.BRANCH_NAME}
                    </td>
                    <td className={styles.code}>{r.WAREHOUSE_CODE}</td>
                    <td className={styles.strong}>{r.WAREHOUSE_NAME}</td>
                    <td>
                      {shared ? (
                        <span className={styles.tag}>
                          Shared · {r.LINKED_BRANCHES} branches
                        </span>
                      ) : (
                        <span className={styles.muted}>Owning branch only</span>
                      )}
                    </td>
                    <td className={styles.num}>{r.STOCK_ROWS}</td>
                    <td>
                      <span className={inactive ? styles.badgeOff : styles.badgeOk}>
                        {inactive ? "INACTIVE" : "ACTIVE"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {mayEdit && (
                        <Link
                          href={`/admin/warehouses/${r.WAREHOUSE_ID}`}
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
        Ledger rows shows how much stock movement a warehouse already carries.
        A warehouse with history cannot be moved to another branch.
      </p>
    </div>
  );
}
