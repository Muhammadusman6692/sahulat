import Link from "next/link";
import { Suspense } from "react";
import { requirePermission } from "@/lib/dal";
import { getActiveCompanyId } from "@/lib/active-scope";
import { getBalanceSheet, type BalanceSheetLine, type DetailLevel } from "@/lib/db/balance-sheet";
import { listBranches } from "@/lib/db/branches";
import { can } from "@/lib/permissions";
import { fmtDate, fmtMoney } from "@/lib/format";
import styles from "@/components/data-grid/grid.module.css";
import BalanceSheetFilters from "./balance-sheet-filters";

export const metadata = { title: "Balance Sheet · Sahulat ERP" };

function toInt(value: string | undefined): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

// toISOString() converts to UTC first, which lands on the wrong calendar day
// whenever this process runs outside UTC (this machine is UTC+5).
function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function toLevel(value: string | undefined): DetailLevel {
  return value === "2" ? 2 : value === "4" ? 4 : 3;
}

/** Statement convention: negatives (contra accounts, a net loss) in brackets. */
function fmtAmount(n: number): string {
  return n < 0 ? `(${fmtMoney(-n)})` : fmtMoney(n);
}

function lineStyle(line: BalanceSheetLine): React.CSSProperties {
  switch (line.kind) {
    case "section":
      return { background: "var(--surface-sunken)", fontWeight: 700, letterSpacing: 0.4 };
    case "heading":
      return { fontWeight: 600 };
    case "subtotal":
      return { fontWeight: 600, borderTop: "1px solid var(--rule)" };
    case "sectionTotal":
      return { fontWeight: 700, borderTop: "2px solid var(--border-strong)", background: "var(--surface-sunken)" };
    case "earnings":
      return { fontStyle: "italic" };
    default:
      return {};
  }
}

export default async function BalanceSheetPage({
  searchParams,
}: PageProps<"/admin/balance-sheet">) {
  const user = await requirePermission("BALANCE_SHEET", "VIEW");

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const companyId = await getActiveCompanyId(user.access);
  if (!companyId) {
    return <p className={styles.empty}>Your account is not scoped to any company.</p>;
  }

  const branchId = toInt(one(sp.branchId));
  const asOf = one(sp.asOf) || today();
  const compareAsOf = one(sp.cmp) || undefined;
  const level = toLevel(one(sp.level));
  const includeZero = one(sp.zero) === "1";
  const mayPrint = can(user.permissions, "BALANCE_SHEET", "PRINT");

  const [branches, bs] = await Promise.all([
    listBranches([companyId], false),
    getBalanceSheet({ companyId, branchId, asOf, compareAsOf, level, includeZero }),
  ]);

  const main = bs.columns[0];
  const glFrom = main.fyStart ?? asOf;
  const branchParam = branchId ? `&branchId=${branchId}` : "";

  const printParams = new URLSearchParams({
    asOf,
    ...(compareAsOf ? { cmp: compareAsOf } : {}),
    ...(branchId ? { branchId: String(branchId) } : {}),
    ...(level !== 3 ? { level: String(level) } : {}),
    ...(includeZero ? { zero: "1" } : {}),
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <h1 className={styles.title}>Balance Sheet</h1>
          <p className={styles.subtitle}>
            Statement of financial position as at a date — posted balances, with profit not yet closed
            shown under equity.
          </p>
        </div>
        {mayPrint && (
          <Link href={`/print/balance-sheet?${printParams.toString()}`} target="_blank" className={styles.btn}>
            Print
          </Link>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.toolbar}>
          <Suspense fallback={null}>
            <BalanceSheetFilters
              branches={branches.map((b) => ({ id: b.BRANCH_ID, code: b.BRANCH_CODE, name: b.BRANCH_NAME }))}
              asOf={asOf}
              level={level}
            />
          </Suspense>
        </div>

        {(bs.unclosedPriorYears.length > 0 || branchId) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px" }}>
            {bs.unclosedPriorYears.length > 0 && (
              <span className={styles.badgeWarn}>
                {bs.unclosedPriorYears.join(", ")} not closed — that profit is shown as a separate line, not
                in Retained Earnings.
              </span>
            )}
            {branchId && (
              <span className={styles.muted} style={{ fontSize: 12 }}>
                Branch view: year-end closing entries are posted to one branch, so other branches show
                closed years&apos; profit as not yet closed.
              </span>
            )}
          </div>
        )}

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Account</th>
              {bs.columns.map((c) => (
                <th key={c.asOf} style={{ textAlign: "right" }}>
                  {fmtDate(new Date(c.asOf))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bs.lines.map((line, i) => (
              <tr key={i} style={lineStyle(line)}>
                <td style={{ paddingLeft: 12 + line.depth * 18 }}>
                  {line.coaId ? (
                    <Link
                      href={`/admin/gl-report?coaId=${line.coaId}&from=${glFrom}&to=${asOf}${branchParam}`}
                    >
                      <span className={styles.code}>{line.code}</span> {line.label}
                    </Link>
                  ) : line.kind === "earnings" ? (
                    <Link href={`/admin/trial-balance?from=${glFrom}&to=${asOf}${branchParam}`}>
                      {line.label}
                    </Link>
                  ) : (
                    line.label
                  )}
                </td>
                {bs.columns.map((c, ci) => (
                  <td key={c.asOf} className={styles.num}>
                    {line.amounts.length ? fmtAmount(line.amounts[ci]) : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ textAlign: "right" }}>Assets − (Equity + Liabilities)</td>
              {bs.columns.map((c) => (
                <td key={c.asOf} className={styles.num}>
                  {c.inBalance ? (
                    <span className={styles.badgeOk}>In balance</span>
                  ) : (
                    <span className={styles.badgeWarn}>
                      Out by {fmtAmount(c.totalAssets - c.totalEquityAndLiabilities)}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
