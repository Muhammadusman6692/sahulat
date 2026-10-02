import { fmtMoney, fmtDate } from "@/lib/format";
import PrintToolbar from "./print-toolbar";
import styles from "./voucher-print.module.css";

export type LedgerPrintLine = {
  key: number | string;
  date: Date;
  voucherNo: string;
  voucherType: string;
  narration: string | null;
  partyName: string | null;
  debit: number;
  credit: number;
  balance: number;
};

export type LedgerPrintCompany = {
  code: string;
  name: string;
  address: string | null;
  ntnNo: string | null;
  strnNo: string | null;
  baseCurrency: string;
};

export default function LedgerPrintView({
  accountLabel,
  natureLabel,
  dateFromLabel,
  dateToLabel,
  openingBalance,
  lines,
  totalDebit,
  totalCredit,
  closingBalance,
  company,
}: {
  accountLabel: string;
  natureLabel: string;
  dateFromLabel: string;
  dateToLabel: string;
  openingBalance: number;
  lines: LedgerPrintLine[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  company: LedgerPrintCompany | null;
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

          <div className={styles.docTitle}>General Ledger — {accountLabel}</div>

          <div className={styles.metaGrid}>
            <div>
              <div className={styles.metaLabel}>Nature</div>
              <div className={styles.metaValue}>{natureLabel}</div>
            </div>
            <div>
              <div className={styles.metaLabel}>From</div>
              <div className={styles.metaValue}>{dateFromLabel}</div>
            </div>
            <div>
              <div className={styles.metaLabel}>To</div>
              <div className={styles.metaValue}>{dateToLabel}</div>
            </div>
            <div>
              <div className={styles.metaLabel}>Opening Balance</div>
              <div className={styles.metaValue}>{fmtMoney(openingBalance)}</div>
            </div>
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Voucher No</th>
                <th>Type</th>
                <th>Narration</th>
                <th>Party</th>
                <th style={{ textAlign: "right" }}>Debit</th>
                <th style={{ textAlign: "right" }}>Credit</th>
                <th style={{ textAlign: "right" }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key}>
                  <td>{fmtDate(l.date)}</td>
                  <td>{l.voucherNo}</td>
                  <td>{l.voucherType}</td>
                  <td>{l.narration ?? "—"}</td>
                  <td>{l.partyName ?? "—"}</td>
                  <td className={styles.num}>{l.debit ? fmtMoney(l.debit) : ""}</td>
                  <td className={styles.num}>{l.credit ? fmtMoney(l.credit) : ""}</td>
                  <td className={styles.num}>{fmtMoney(l.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={styles.totalRow}>
                <td colSpan={5} style={{ textAlign: "right" }}>
                  Totals
                </td>
                <td className={styles.num}>{fmtMoney(totalDebit)}</td>
                <td className={styles.num}>{fmtMoney(totalCredit)}</td>
                <td className={styles.num}>{fmtMoney(closingBalance)}</td>
              </tr>
            </tfoot>
          </table>

          <div className={styles.footer}>Printed {new Date().toLocaleString("en-GB")}</div>
        </div>
      </div>
    </div>
  );
}
