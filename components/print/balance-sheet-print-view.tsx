import { fmtMoney } from "@/lib/format";
import type { BalanceSheetLine } from "@/lib/db/balance-sheet";
import PrintToolbar from "./print-toolbar";
import styles from "./voucher-print.module.css";

export type BalanceSheetPrintCompany = {
  code: string;
  name: string;
  address: string | null;
  ntnNo: string | null;
  strnNo: string | null;
};

/** Statement convention: negatives (contra accounts, a net loss) in brackets. */
function fmtAmount(n: number): string {
  return n < 0 ? `(${fmtMoney(-n)})` : fmtMoney(n);
}

function rowStyle(line: BalanceSheetLine): React.CSSProperties {
  switch (line.kind) {
    case "section":
      return { fontWeight: 700 };
    case "heading":
      return { fontWeight: 600 };
    case "subtotal":
      return { fontWeight: 600, borderTop: "1px solid #999" };
    case "sectionTotal":
      return { fontWeight: 700, borderTop: "1px solid #000", borderBottom: "3px double #000" };
    case "earnings":
      return { fontStyle: "italic" };
    default:
      return {};
  }
}

export default function BalanceSheetPrintView({
  branchLabel,
  columnLabels,
  lines,
  inBalance,
  levelLabel,
  company,
}: {
  branchLabel: string;
  columnLabels: string[];
  lines: BalanceSheetLine[];
  inBalance: boolean;
  levelLabel: string;
  company: BalanceSheetPrintCompany | null;
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

          <div className={styles.docTitle}>Balance Sheet</div>

          <div className={styles.metaGrid}>
            <div>
              <div className={styles.metaLabel}>Branch</div>
              <div className={styles.metaValue}>{branchLabel}</div>
            </div>
            <div>
              <div className={styles.metaLabel}>As at</div>
              <div className={styles.metaValue}>{columnLabels.join(" vs ")}</div>
            </div>
            <div>
              <div className={styles.metaLabel}>Detail</div>
              <div className={styles.metaValue}>{levelLabel}</div>
            </div>
            <div>
              <div className={styles.metaLabel}>Status</div>
              <div className={styles.metaValue}>{inBalance ? "In balance" : "OUT OF BALANCE"}</div>
            </div>
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>Account</th>
                {columnLabels.map((l) => (
                  <th key={l} style={{ textAlign: "right" }}>{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} style={rowStyle(line)}>
                  <td style={{ paddingLeft: 4 + line.depth * 14 }}>
                    {line.coaId && line.code ? `${line.code}  ` : ""}
                    {line.label}
                  </td>
                  {columnLabels.map((l, ci) => (
                    <td key={l} className={styles.num}>
                      {line.amounts.length ? fmtAmount(line.amounts[ci]) : ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div className={styles.footer}>Printed {new Date().toLocaleString("en-GB")}</div>
        </div>
      </div>
    </div>
  );
}
