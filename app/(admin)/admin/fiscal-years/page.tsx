import Link from "next/link";
import { requirePermission } from "@/lib/dal";
import { listFiscalYears } from "@/lib/db/fiscal";
import { can } from "@/lib/permissions";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "Fiscal Years · Sahulat ERP" };

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function FiscalYearsPage() {
  const user = await requirePermission("FISCAL_MAINT", "VIEW");
  const companyIds = [...new Set(user.access.map((a) => a.companyId))];
  const rows = await listFiscalYears(companyIds);
  const mayCreate = can(user.permissions, "FISCAL_MAINT", "CREATE");

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <h1 className={styles.title}>Fiscal Years</h1>
          <p className={styles.subtitle}>
            Each year is created with its twelve monthly periods. A voucher can
            only post into a period that is still open — that check happens in
            the database on every posting attempt, not just here.
          </p>
        </div>
        {mayCreate && (
          <Link href="/admin/fiscal-years/new" className={styles.btnPrimary}>
            <svg
              width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            New fiscal year
          </Link>
        )}
      </div>

      <div className={styles.card}>
        {rows.length === 0 ? (
          <p className={styles.empty}>
            No fiscal years in the companies you are scoped to.
          </p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Company</th>
                <th>Fiscal year</th>
                <th>Start</th>
                <th>End</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Periods open</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const closed = r.STATUS === "CLOSED";
                return (
                  <tr key={r.FY_ID}>
                    <td className={styles.muted}>{r.COMPANY_CODE}</td>
                    <td className={styles.strong}>{r.FY_NAME}</td>
                    <td className={styles.muted}>{fmtDate(r.START_DATE)}</td>
                    <td className={styles.muted}>{fmtDate(r.END_DATE)}</td>
                    <td>
                      <span className={closed ? styles.badgeOff : styles.badgeOk}>
                        {r.STATUS}
                      </span>
                    </td>
                    <td className={styles.num}>
                      {r.OPEN_PERIOD_COUNT} / {r.PERIOD_COUNT}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link
                        href={`/admin/fiscal-years/${r.FY_ID}`}
                        className={styles.pageLink}
                      >
                        Manage periods
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className={styles.note}>
        A fiscal year is never deleted, only closed. Marking one closed
        requires every one of its periods to already be closed first.
      </p>
    </div>
  );
}
