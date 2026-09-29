import Link from "next/link";
import { requirePermission } from "@/lib/dal";
import { listCompanies } from "@/lib/db/companies";
import { can } from "@/lib/permissions";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "Companies · Sahulat ERP" };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function CompaniesPage({
  searchParams,
}: PageProps<"/admin/companies">) {
  const user = await requirePermission("COMPANY_MAINT", "VIEW");
  const sp = await searchParams;
  const includeInactive =
    (Array.isArray(sp.inactive) ? sp.inactive[0] : sp.inactive) === "1";

  const rows = await listCompanies(includeInactive);
  const mayCreate = can(user.permissions, "COMPANY_MAINT", "CREATE");
  const mayEdit = can(user.permissions, "COMPANY_MAINT", "EDIT");

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <h1 className={styles.title}>Companies</h1>
          <p className={styles.subtitle}>
            Each company keeps its own chart of accounts, fiscal calendar and
            financial statements. Parties and items are never shared between
            them.
          </p>
        </div>
        <Link
          href={includeInactive ? "/admin/companies" : "/admin/companies?inactive=1"}
          className={styles.btn}
        >
          {includeInactive ? "Active only" : "Show inactive"}
        </Link>
        {mayCreate && (
          <Link href="/admin/companies/new" className={styles.btnPrimary}>
            <svg
              width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            New company
          </Link>
        )}
      </div>

      <div className={styles.card}>
        {rows.length === 0 ? (
          <p className={styles.empty}>No companies yet.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Company name</th>
                <th>NTN</th>
                <th>STRN</th>
                <th>Fiscal year starts</th>
                <th>Currency</th>
                <th style={{ textAlign: "right" }}>Branches</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const inactive = r.ACTIVE_YN !== "Y";
                return (
                  <tr key={r.COMPANY_ID} className={inactive ? styles.inactiveRow : undefined}>
                    <td className={styles.code}>{r.COMPANY_CODE}</td>
                    <td className={styles.strong}>{r.COMPANY_NAME}</td>
                    <td className={styles.code}>{r.NTN_NO ?? "—"}</td>
                    <td className={styles.code}>{r.STRN_NO ?? "—"}</td>
                    <td className={styles.muted}>{MONTHS[r.FY_START_MONTH - 1]}</td>
                    <td className={styles.muted}>{r.BASE_CURRENCY}</td>
                    <td className={styles.num}>{r.BRANCH_COUNT}</td>
                    <td>
                      <span className={inactive ? styles.badgeOff : styles.badgeOk}>
                        {inactive ? "INACTIVE" : "ACTIVE"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {mayEdit && (
                        <Link
                          href={`/admin/companies/${r.COMPANY_ID}`}
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
        Companies are never deleted — they are marked inactive so posted
        documents, ledgers and audit history keep resolving.
      </p>
    </div>
  );
}
