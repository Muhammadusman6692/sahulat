import Link from "next/link";
import { requirePermission } from "@/lib/dal";
import { listSeries } from "@/lib/db/numbering";
import { can } from "@/lib/permissions";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "Numbering Series · Sahulat ERP" };

function preview(prefix: string | null, nextNumber: number, padLength: number) {
  return `${prefix ?? ""}${String(nextNumber).padStart(padLength, "0")}`;
}

export default async function NumberingSeriesPage() {
  const user = await requirePermission("NUMBERING_MAINT", "VIEW");
  const companyId = user.access[0]?.companyId;

  if (!companyId) {
    return <p className={styles.empty}>Your account is not scoped to any company.</p>;
  }

  const rows = await listSeries(companyId);
  const mayCreate = can(user.permissions, "NUMBERING_MAINT", "CREATE");
  const mayEdit = can(user.permissions, "NUMBERING_MAINT", "EDIT");

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <h1 className={styles.title}>Numbering Series</h1>
          <p className={styles.subtitle}>
            One counter per document type, optionally scoped to a branch or a
            POS terminal. A row-level lock on the counter keeps two concurrent
            posts from ever issuing the same number.
          </p>
        </div>
        {mayCreate && (
          <Link href="/admin/numbering-series/new" className={styles.btnPrimary}>
            <svg
              width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            New series
          </Link>
        )}
      </div>

      <div className={styles.card}>
        {rows.length === 0 ? (
          <p className={styles.empty}>No numbering series for this company yet.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Doc type</th>
                <th>Scope</th>
                <th>Fiscal year</th>
                <th style={{ textAlign: "right" }}>Next number</th>
                <th>Preview</th>
                <th>Yearly reset</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.SERIES_ID}>
                  <td className={styles.code}>{r.DOC_TYPE}</td>
                  <td className={styles.muted}>
                    {r.BRANCH_CODE ?? "Company-wide"}
                    {r.TERMINAL_ID ? ` · Terminal ${r.TERMINAL_ID}` : ""}
                  </td>
                  <td className={styles.muted}>{r.FY_NAME ?? "—"}</td>
                  <td className={styles.num}>{r.NEXT_NUMBER}</td>
                  <td className={styles.code}>
                    {preview(r.PREFIX, r.NEXT_NUMBER, r.PAD_LENGTH)}
                  </td>
                  <td className={styles.muted}>{r.RESET_YEARLY === "Y" ? "Yes" : "No"}</td>
                  <td style={{ textAlign: "right" }}>
                    {mayEdit && (
                      <Link
                        href={`/admin/numbering-series/${r.SERIES_ID}`}
                        className={styles.pageLink}
                      >
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

      <p className={styles.note}>
        Company, branch, terminal and document type together identify a
        series and are fixed once it exists — only its format and counter can
        be changed afterwards.
      </p>
    </div>
  );
}
