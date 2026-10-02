import { Fragment } from "react";
import { fmtAccounting } from "@/lib/format";
import PrintToolbar from "./print-toolbar";
import styles from "./voucher-print.module.css";

export type PLPrintRow = {
  coaId: number;
  accountCode: string;
  accountName: string;
  amount: number;
};

export type PLPrintGroup = {
  code: string;
  name: string;
  rows: PLPrintRow[];
  subtotal: number;
};

export type PLPrintSection = {
  code: string;
  name: string;
  groups: PLPrintGroup[];
  total: number;
};

export type ProfitLossPrintCompany = {
  code: string;
  name: string;
  address: string | null;
  ntnNo: string | null;
  strnNo: string | null;
};

function pct(amount: number, base: number): string {
  if (base === 0) return "";
  return `${((amount / base) * 100).toFixed(1)}%`;
}

function SectionRows({ section, totalRevenue }: { section: PLPrintSection; totalRevenue: number }) {
  return (
    <>
      {section.groups.map((g) => (
        <Fragment key={g.code}>
          {section.groups.length > 1 && (
            <tr>
              <td colSpan={2} style={{ paddingLeft: 20 }}>
                {g.name}
              </td>
              <td />
              <td />
            </tr>
          )}
          {g.rows.map((r) => (
            <tr key={r.coaId}>
              <td style={{ paddingLeft: section.groups.length > 1 ? 36 : 20 }}>{r.accountCode}</td>
              <td>{r.accountName}</td>
              <td className={styles.num}>{fmtAccounting(r.amount)}</td>
              <td className={styles.num} />
            </tr>
          ))}
        </Fragment>
      ))}
      <tr style={{ fontWeight: 600 }}>
        <td colSpan={2} style={{ textAlign: "right" }}>
          Total {section.name}
        </td>
        <td className={styles.num}>{fmtAccounting(section.total)}</td>
        <td className={styles.num}>{pct(section.total, totalRevenue)}</td>
      </tr>
    </>
  );
}

export default function ProfitLossPrintView({
  branchLabel,
  dateFromLabel,
  dateToLabel,
  revenueSections,
  totalRevenue,
  cogsMapped,
  costOfSalesSections,
  totalCostOfSales,
  grossProfit,
  operatingExpenseSections,
  totalOperatingExpenses,
  netProfit,
  spansFiscalYears,
  company,
}: {
  branchLabel: string;
  dateFromLabel: string;
  dateToLabel: string;
  revenueSections: PLPrintSection[];
  totalRevenue: number;
  cogsMapped: boolean;
  costOfSalesSections: PLPrintSection[];
  totalCostOfSales: number;
  grossProfit: number | null;
  operatingExpenseSections: PLPrintSection[];
  totalOperatingExpenses: number;
  netProfit: number;
  spansFiscalYears: boolean;
  company: ProfitLossPrintCompany | null;
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

          <div className={styles.docTitle}>Profit &amp; Loss</div>

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
              <div className={styles.metaLabel}>Result</div>
              <div className={styles.metaValue}>{netProfit >= 0 ? "Profit" : "Loss"}</div>
            </div>
          </div>

          {spansFiscalYears && (
            <p className={styles.narration}>
              This range spans more than one fiscal year — the totals below are a valid sum, but not a
              single statutory P&amp;L.
            </p>
          )}

          <table className={styles.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Account</th>
                <th style={{ textAlign: "right" }}>Amount</th>
                <th style={{ textAlign: "right" }}>%</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4} style={{ fontWeight: 600 }}>
                  Revenue
                </td>
              </tr>
              {revenueSections.map((s) => (
                <SectionRows key={s.code} section={s} totalRevenue={totalRevenue} />
              ))}
              <tr style={{ fontWeight: 700 }}>
                <td colSpan={2} style={{ textAlign: "right" }}>
                  Total Revenue
                </td>
                <td className={styles.num}>{fmtAccounting(totalRevenue)}</td>
                <td className={styles.num}>{pct(totalRevenue, totalRevenue)}</td>
              </tr>

              {cogsMapped && (
                <>
                  <tr>
                    <td colSpan={4} style={{ fontWeight: 600 }}>
                      Cost of Sales
                    </td>
                  </tr>
                  {costOfSalesSections.map((s) => (
                    <SectionRows key={s.code} section={s} totalRevenue={totalRevenue} />
                  ))}
                  <tr style={{ fontWeight: 700 }}>
                    <td colSpan={2} style={{ textAlign: "right" }}>
                      Total Cost of Sales
                    </td>
                    <td className={styles.num}>{fmtAccounting(totalCostOfSales)}</td>
                    <td className={styles.num}>{pct(totalCostOfSales, totalRevenue)}</td>
                  </tr>
                  <tr style={{ fontWeight: 700 }}>
                    <td colSpan={2} style={{ textAlign: "right" }}>
                      Gross Profit
                    </td>
                    <td className={styles.num}>{fmtAccounting(grossProfit ?? 0)}</td>
                    <td className={styles.num}>{pct(grossProfit ?? 0, totalRevenue)}</td>
                  </tr>
                </>
              )}

              <tr>
                <td colSpan={4} style={{ fontWeight: 600 }}>
                  Operating Expenses
                </td>
              </tr>
              {operatingExpenseSections.map((s) => (
                <SectionRows key={s.code} section={s} totalRevenue={totalRevenue} />
              ))}
              <tr style={{ fontWeight: 700 }}>
                <td colSpan={2} style={{ textAlign: "right" }}>
                  Total Operating Expenses
                </td>
                <td className={styles.num}>{fmtAccounting(totalOperatingExpenses)}</td>
                <td className={styles.num}>{pct(totalOperatingExpenses, totalRevenue)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className={styles.totalRow}>
                <td colSpan={2} style={{ textAlign: "right" }}>
                  Net Profit
                </td>
                <td className={styles.num}>{fmtAccounting(netProfit)}</td>
                <td className={styles.num}>{pct(netProfit, totalRevenue)}</td>
              </tr>
            </tfoot>
          </table>

          <div className={styles.footer}>Printed {new Date().toLocaleString("en-GB")}</div>
        </div>
      </div>
    </div>
  );
}
