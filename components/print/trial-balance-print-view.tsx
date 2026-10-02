import { Fragment } from "react";
import { fmtMoney } from "@/lib/format";
import PrintToolbar from "./print-toolbar";
import styles from "./voucher-print.module.css";

export type TrialBalancePrintRow = {
  coaId: number;
  accountCode: string;
  accountName: string;
  openingDr: number;
  openingCr: number;
  periodDr: number;
  periodCr: number;
  closingDr: number;
  closingCr: number;
};

export type TrialBalancePrintGroup = {
  nature: string;
  rows: TrialBalancePrintRow[];
  subtotal: {
    openingDr: number;
    openingCr: number;
    periodDr: number;
    periodCr: number;
    closingDr: number;
    closingCr: number;
  };
};

export type TrialBalancePrintCompany = {
  code: string;
  name: string;
  address: string | null;
  ntnNo: string | null;
  strnNo: string | null;
};

export default function TrialBalancePrintView({
  branchLabel,
  dateFromLabel,
  dateToLabel,
  groups,
  totalOpeningDr,
  totalOpeningCr,
  totalPeriodDr,
  totalPeriodCr,
  totalClosingDr,
  totalClosingCr,
  inBalance,
  company,
}: {
  branchLabel: string;
  dateFromLabel: string;
  dateToLabel: string;
  groups: TrialBalancePrintGroup[];
  totalOpeningDr: number;
  totalOpeningCr: number;
  totalPeriodDr: number;
  totalPeriodCr: number;
  totalClosingDr: number;
  totalClosingCr: number;
  inBalance: boolean;
  company: TrialBalancePrintCompany | null;
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

          <div className={styles.docTitle}>Trial Balance</div>

          <div className={styles.metaGrid}>
            <div>
              <div className={styles.metaLabel}>Branch</div>
              <div className={styles.metaValue}>{branchLabel}</div>
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
              <div className={styles.metaLabel}>Status</div>
              <div className={styles.metaValue}>{inBalance ? "In balance" : "OUT OF BALANCE"}</div>
            </div>
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Account</th>
                <th style={{ textAlign: "right" }}>Opening Dr</th>
                <th style={{ textAlign: "right" }}>Opening Cr</th>
                <th style={{ textAlign: "right" }}>Period Dr</th>
                <th style={{ textAlign: "right" }}>Period Cr</th>
                <th style={{ textAlign: "right" }}>Closing Dr</th>
                <th style={{ textAlign: "right" }}>Closing Cr</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.nature}>
                  <tr>
                    <td colSpan={8} style={{ fontWeight: 600 }}>{g.nature}</td>
                  </tr>
                  {g.rows.map((r) => (
                    <tr key={r.coaId}>
                      <td>{r.accountCode}</td>
                      <td>{r.accountName}</td>
                      <td className={styles.num}>{r.openingDr ? fmtMoney(r.openingDr) : ""}</td>
                      <td className={styles.num}>{r.openingCr ? fmtMoney(r.openingCr) : ""}</td>
                      <td className={styles.num}>{r.periodDr ? fmtMoney(r.periodDr) : ""}</td>
                      <td className={styles.num}>{r.periodCr ? fmtMoney(r.periodCr) : ""}</td>
                      <td className={styles.num}>{r.closingDr ? fmtMoney(r.closingDr) : ""}</td>
                      <td className={styles.num}>{r.closingCr ? fmtMoney(r.closingCr) : ""}</td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 600 }}>
                    <td colSpan={2} style={{ textAlign: "right" }}>Subtotal — {g.nature}</td>
                    <td className={styles.num}>{fmtMoney(g.subtotal.openingDr)}</td>
                    <td className={styles.num}>{fmtMoney(g.subtotal.openingCr)}</td>
                    <td className={styles.num}>{fmtMoney(g.subtotal.periodDr)}</td>
                    <td className={styles.num}>{fmtMoney(g.subtotal.periodCr)}</td>
                    <td className={styles.num}>{fmtMoney(g.subtotal.closingDr)}</td>
                    <td className={styles.num}>{fmtMoney(g.subtotal.closingCr)}</td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr className={styles.totalRow}>
                <td colSpan={2} style={{ textAlign: "right" }}>Total</td>
                <td className={styles.num}>{fmtMoney(totalOpeningDr)}</td>
                <td className={styles.num}>{fmtMoney(totalOpeningCr)}</td>
                <td className={styles.num}>{fmtMoney(totalPeriodDr)}</td>
                <td className={styles.num}>{fmtMoney(totalPeriodCr)}</td>
                <td className={styles.num}>{fmtMoney(totalClosingDr)}</td>
                <td className={styles.num}>{fmtMoney(totalClosingCr)}</td>
              </tr>
            </tfoot>
          </table>

          <div className={styles.footer}>Printed {new Date().toLocaleString("en-GB")}</div>
        </div>
      </div>
    </div>
  );
}
