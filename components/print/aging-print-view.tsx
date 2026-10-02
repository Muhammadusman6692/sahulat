import { fmtMoney } from "@/lib/format";
import { AGING_BUCKETS, type AgingBucket } from "@/lib/db/aging-report";
import PrintToolbar from "./print-toolbar";
import styles from "./voucher-print.module.css";

export type AgingPrintRow = {
  key: number;
  code: string;
  name: string;
  buckets: Record<AgingBucket, number>;
  advance: number;
  total: number;
};

export type AgingPrintCompany = {
  code: string;
  name: string;
  address: string | null;
  ntnNo: string | null;
  strnNo: string | null;
  baseCurrency: string;
};

export default function AgingPrintView({
  asOfLabel,
  rows,
  grandTotal,
  company,
}: {
  asOfLabel: string;
  rows: AgingPrintRow[];
  grandTotal: Record<AgingBucket, number> & { advance: number; total: number };
  company: AgingPrintCompany | null;
}) {
  return (
    <div className={styles.backdrop}>
      <PrintToolbar />
      <div className={styles.sheet}>
        <div className={styles.sheetContent}>
          <div className={styles.letterhead}>
            <div className={styles.companyName}>{company?.name ?? "—"}</div>
            {company && (company.address || company.ntnNo || company.strnNo) && (
              <div className={styles.companyMeta}>
                {[company.address, company.ntnNo && `NTN ${company.ntnNo}`, company.strnNo && `STRN ${company.strnNo}`]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            )}
          </div>

          <div className={styles.docTitle}>Aging Report</div>

          <div className={styles.metaGrid}>
            <div>
              <div className={styles.metaLabel}>As of</div>
              <div className={styles.metaValue}>{asOfLabel}</div>
            </div>
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Party</th>
                {AGING_BUCKETS.map((b) => (
                  <th key={b.key} style={{ textAlign: "right" }}>
                    {b.label}
                  </th>
                ))}
                <th style={{ textAlign: "right" }}>Advance</th>
                <th style={{ textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td>{r.code}</td>
                  <td>{r.name}</td>
                  {AGING_BUCKETS.map((b) => (
                    <td key={b.key} className={styles.num}>
                      {r.buckets[b.key] ? fmtMoney(r.buckets[b.key]) : ""}
                    </td>
                  ))}
                  <td className={styles.num}>{r.advance ? fmtMoney(r.advance) : ""}</td>
                  <td className={styles.num}>{fmtMoney(r.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={styles.totalRow}>
                <td colSpan={2} style={{ textAlign: "right" }}>
                  Totals
                </td>
                {AGING_BUCKETS.map((b) => (
                  <td key={b.key} className={styles.num}>
                    {fmtMoney(grandTotal[b.key])}
                  </td>
                ))}
                <td className={styles.num}>{fmtMoney(grandTotal.advance)}</td>
                <td className={styles.num}>{fmtMoney(grandTotal.total)}</td>
              </tr>
            </tfoot>
          </table>

          <div className={styles.footer}>Printed {new Date().toLocaleString("en-GB")}</div>
        </div>
      </div>
    </div>
  );
}
