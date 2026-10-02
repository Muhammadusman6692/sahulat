import { fmtMoney } from "@/lib/format";
import { amountInWords } from "@/lib/number-to-words";
import PrintToolbar from "./print-toolbar";
import styles from "./voucher-print.module.css";

export type VoucherPrintLine = {
  key: number | string;
  accountLabel: string;
  narration: string | null;
  debit: number;
  credit: number;
};

export type VoucherPrintInfo = { label: string; value: string; sub?: string };

export type VoucherPrintCompany = {
  code: string;
  name: string;
  address: string | null;
  ntnNo: string | null;
  strnNo: string | null;
  baseCurrency: string;
};

export default function VoucherPrintView({
  documentTitle,
  voucherNo,
  statusLabel,
  info,
  narration,
  lines,
  totalDebit,
  totalCredit,
  company,
}: {
  documentTitle: string;
  voucherNo: string;
  statusLabel: string;
  info: VoucherPrintInfo[];
  narration: string | null;
  lines: VoucherPrintLine[];
  totalDebit: number;
  totalCredit: number;
  company: VoucherPrintCompany | null;
}) {
  const watermark = statusLabel === "CANCELLED" || statusLabel === "DRAFT" ? statusLabel : null;

  return (
    <div className={styles.backdrop}>
      <PrintToolbar />
      <div className={styles.sheet}>
        {watermark && (
          <div
            className={styles.watermark}
            style={watermark === "CANCELLED" ? { color: "rgba(155, 34, 38, 0.16)" } : undefined}
          >
            {watermark}
          </div>
        )}

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

          <div className={styles.docTitle}>
            {documentTitle} — {voucherNo} ({statusLabel})
          </div>

          <div className={styles.metaGrid}>
            {info.map((row) => (
              <div key={row.label}>
                <div className={styles.metaLabel}>{row.label}</div>
                <div className={styles.metaValue}>{row.value}</div>
                {row.sub && <div className={styles.metaValue}>{row.sub}</div>}
              </div>
            ))}
          </div>

          {narration && <p className={styles.narration}>{narration}</p>}

          <table className={styles.table}>
            <thead>
              <tr>
                <th>Account</th>
                <th>Line narration</th>
                <th style={{ textAlign: "right" }}>Debit</th>
                <th style={{ textAlign: "right" }}>Credit</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key}>
                  <td>{l.accountLabel}</td>
                  <td>{l.narration ?? "—"}</td>
                  <td className={styles.num}>{l.debit ? fmtMoney(l.debit) : ""}</td>
                  <td className={styles.num}>{l.credit ? fmtMoney(l.credit) : ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={styles.totalRow}>
                <td colSpan={2} style={{ textAlign: "right" }}>Total</td>
                <td className={styles.num}>{fmtMoney(totalDebit)}</td>
                <td className={styles.num}>{fmtMoney(totalCredit)}</td>
              </tr>
            </tfoot>
          </table>

          {company && (
            <div className={styles.amountWords}>
              <span className={styles.metaLabel}>Amount in words</span>{" "}
              {amountInWords(totalDebit, company.baseCurrency)}
            </div>
          )}

          <div className={styles.signatures}>
            <div className={styles.signatureLine}>Prepared by</div>
            <div className={styles.signatureLine}>Checked by</div>
            <div className={styles.signatureLine}>Approved by</div>
          </div>

          <div className={styles.footer}>Printed {new Date().toLocaleString("en-GB")}</div>
        </div>
      </div>
    </div>
  );
}
