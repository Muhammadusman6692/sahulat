import Link from "next/link";
import { Fragment, Suspense } from "react";
import { requirePermission } from "@/lib/dal";
import { getActiveCompanyId } from "@/lib/active-scope";
import { getTrialBalance, NATURE_ORDER, type TrialBalanceRow, type NatureSubtotal } from "@/lib/db/trial-balance";
import { listBranches } from "@/lib/db/branches";
import { can } from "@/lib/permissions";
import { fmtMoney } from "@/lib/format";
import styles from "@/components/data-grid/grid.module.css";
import TrialBalanceFilters from "./trial-balance-filters";

export const metadata = { title: "Trial Balance · Sahulat ERP" };

function toInt(value: string | undefined): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

// toISOString() converts to UTC first, which lands on the wrong calendar day
// whenever this process runs outside UTC (this machine is UTC+5).
function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function firstOfMonth(): string {
  const d = new Date();
  return toDateInputValue(new Date(d.getFullYear(), d.getMonth(), 1));
}

function today(): string {
  return toDateInputValue(new Date());
}

const NATURE_LABEL: Record<string, string> = {
  ASSET: "Asset",
  LIABILITY: "Liability",
  EQUITY: "Equity",
  INCOME: "Income",
  EXPENSE: "Expense",
};

type NatureGroup = {
  nature: string;
  rows: TrialBalanceRow[];
  subtotal: NatureSubtotal | undefined;
};

function groupByNature(rows: TrialBalanceRow[], subtotals: NatureSubtotal[]): NatureGroup[] {
  const subtotalByNature = new Map(subtotals.map((s) => [s.nature, s]));
  return NATURE_ORDER.map((nature) => ({
    nature,
    rows: rows.filter((r) => r.ACCOUNT_NATURE === nature),
    subtotal: subtotalByNature.get(nature),
  })).filter((g) => g.rows.length > 0);
}

export default async function TrialBalancePage({
  searchParams,
}: PageProps<"/admin/trial-balance">) {
  const user = await requirePermission("TRIAL_BALANCE", "VIEW");

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const companyId = await getActiveCompanyId(user.access);
  if (!companyId) {
    return <p className={styles.empty}>Your account is not scoped to any company.</p>;
  }

  const branchId = toInt(one(sp.branchId));
  const dateFrom = one(sp.from) || firstOfMonth();
  const dateTo = one(sp.to) || today();
  const includeZero = one(sp.zero) === "1";
  const includeClosing = one(sp.closing) !== "0";
  const mayPrint = can(user.permissions, "TRIAL_BALANCE", "PRINT");

  const branches = await listBranches([companyId], false);

  const tb = await getTrialBalance({
    companyId,
    branchId,
    dateFrom,
    dateTo,
    includeClosing,
    includeZero,
  });

  const printParams = new URLSearchParams({
    from: dateFrom,
    to: dateTo,
    ...(branchId ? { branchId: String(branchId) } : {}),
    ...(includeZero ? { zero: "1" } : {}),
    ...(includeClosing ? {} : { closing: "0" }),
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <h1 className={styles.title}>Trial Balance</h1>
          <p className={styles.subtitle}>
            Posted balances as at a date — opening, period movement, and closing per account.
          </p>
        </div>
        {mayPrint && (
          <Link href={`/print/trial-balance?${printParams.toString()}`} target="_blank" className={styles.btn}>
            Print
          </Link>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.toolbar}>
          <Suspense fallback={null}>
            <TrialBalanceFilters
              branches={branches.map((b) => ({ id: b.BRANCH_ID, code: b.BRANCH_CODE, name: b.BRANCH_NAME }))}
            />
          </Suspense>
        </div>

        {tb.rows.length === 0 ? (
          <p className={styles.empty}>No accounts match these filters.</p>
        ) : (
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
              {groupByNature(tb.rows, tb.subtotals).map((group) => (
                <Fragment key={group.nature}>
                  <tr>
                    <td colSpan={8} className={styles.strong} style={{ background: "var(--surface-2)" }}>
                      {NATURE_LABEL[group.nature] ?? group.nature}
                    </td>
                  </tr>
                  {group.rows.map((r) => (
                    <tr key={r.COA_ID}>
                      <td className={styles.code}>
                        <Link href={`/admin/gl-report?coaId=${r.COA_ID}&from=${dateFrom}&to=${dateTo}${branchId ? `&branchId=${branchId}` : ""}`}>
                          {r.ACCOUNT_CODE}
                        </Link>
                      </td>
                      <td>{r.ACCOUNT_NAME}</td>
                      <td className={styles.num}>{r.OPENING_DR ? fmtMoney(r.OPENING_DR) : ""}</td>
                      <td className={styles.num}>{r.OPENING_CR ? fmtMoney(r.OPENING_CR) : ""}</td>
                      <td className={styles.num}>{r.PERIOD_DR ? fmtMoney(r.PERIOD_DR) : ""}</td>
                      <td className={styles.num}>{r.PERIOD_CR ? fmtMoney(r.PERIOD_CR) : ""}</td>
                      <td className={styles.num}>{r.CLOSING_DR ? fmtMoney(r.CLOSING_DR) : ""}</td>
                      <td className={styles.num}>{r.CLOSING_CR ? fmtMoney(r.CLOSING_CR) : ""}</td>
                    </tr>
                  ))}
                  {group.subtotal && (
                    <tr style={{ fontWeight: 600 }}>
                      <td colSpan={2} style={{ textAlign: "right" }}>
                        Subtotal — {NATURE_LABEL[group.nature] ?? group.nature}
                      </td>
                      <td className={styles.num}>{fmtMoney(group.subtotal.openingDr)}</td>
                      <td className={styles.num}>{fmtMoney(group.subtotal.openingCr)}</td>
                      <td className={styles.num}>{fmtMoney(group.subtotal.periodDr)}</td>
                      <td className={styles.num}>{fmtMoney(group.subtotal.periodCr)}</td>
                      <td className={styles.num}>{fmtMoney(group.subtotal.closingDr)}</td>
                      <td className={styles.num}>{fmtMoney(group.subtotal.closingCr)}</td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} style={{ textAlign: "right", fontWeight: 600 }}>
                  Total
                </td>
                <td className={styles.num} style={{ fontWeight: 600 }}>{fmtMoney(tb.totalOpeningDr)}</td>
                <td className={styles.num} style={{ fontWeight: 600 }}>{fmtMoney(tb.totalOpeningCr)}</td>
                <td className={styles.num} style={{ fontWeight: 600 }}>{fmtMoney(tb.totalPeriodDr)}</td>
                <td className={styles.num} style={{ fontWeight: 600 }}>{fmtMoney(tb.totalPeriodCr)}</td>
                <td className={styles.num} style={{ fontWeight: 600 }}>{fmtMoney(tb.totalClosingDr)}</td>
                <td className={styles.num} style={{ fontWeight: 600 }}>{fmtMoney(tb.totalClosingCr)}</td>
              </tr>
              <tr>
                <td colSpan={8} style={{ textAlign: "right" }}>
                  {tb.inBalance ? (
                    <span className={styles.badgeOk}>In balance</span>
                  ) : (
                    <span className={styles.badgeWarn}>Out of balance</span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
