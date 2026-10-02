import Link from "next/link";
import { Fragment, Suspense } from "react";
import { requirePermission } from "@/lib/dal";
import { getActiveCompanyId } from "@/lib/active-scope";
import { getProfitLoss, type PLSection } from "@/lib/db/profit-loss";
import { listBranches } from "@/lib/db/branches";
import { listFiscalYears } from "@/lib/db/fiscal";
import { can } from "@/lib/permissions";
import { fmtAccounting } from "@/lib/format";
import styles from "@/components/data-grid/grid.module.css";
import ProfitLossFilters from "./pl-filters";

export const metadata = { title: "Profit & Loss · Sahulat ERP" };

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

function today(): string {
  return toDateInputValue(new Date());
}

function firstOfCalendarYear(): string {
  return toDateInputValue(new Date(new Date().getFullYear(), 0, 1));
}

function pct(amount: number, base: number): string {
  if (base === 0) return "";
  return `${((amount / base) * 100).toFixed(1)}%`;
}

function renderSection(
  section: PLSection,
  key: string,
  dateFrom: string,
  dateTo: string,
  branchId: number | undefined,
  totalRevenue: number,
) {
  return (
    <Fragment key={key}>
      {section.groups.map((group) => (
        <Fragment key={`${key}-${group.code}`}>
          {section.groups.length > 1 && (
            <tr>
              <td colSpan={2} className={styles.muted} style={{ paddingLeft: 24 }}>
                {group.name}
              </td>
              <td />
              <td />
            </tr>
          )}
          {group.rows.map((r) => (
            <tr key={r.COA_ID}>
              <td className={styles.code} style={{ paddingLeft: section.groups.length > 1 ? 40 : 24 }}>
                <Link
                  href={`/admin/gl-report?coaId=${r.COA_ID}&from=${dateFrom}&to=${dateTo}${branchId ? `&branchId=${branchId}` : ""}`}
                >
                  {r.ACCOUNT_CODE}
                </Link>
              </td>
              <td>{r.ACCOUNT_NAME}</td>
              <td className={styles.num}>{fmtAccounting(r.AMOUNT)}</td>
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
    </Fragment>
  );
}

export default async function ProfitLossPage({
  searchParams,
}: PageProps<"/admin/profit-loss">) {
  const user = await requirePermission("PROFIT_LOSS", "VIEW");

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const companyId = await getActiveCompanyId(user.access);
  if (!companyId) {
    return <p className={styles.empty}>Your account is not scoped to any company.</p>;
  }

  const branchId = toInt(one(sp.branchId));
  const includeZero = one(sp.zero) === "1";

  const branches = await listBranches([companyId], false);
  const fiscalYears = await listFiscalYears([companyId]);

  const dateTo = one(sp.to) || today();
  const currentFy = fiscalYears.find(
    (fy) => toDateInputValue(fy.START_DATE) <= dateTo && dateTo <= toDateInputValue(fy.END_DATE),
  );
  const dateFrom = one(sp.from) || (currentFy ? toDateInputValue(currentFy.START_DATE) : firstOfCalendarYear());

  const mayPrint = can(user.permissions, "PROFIT_LOSS", "PRINT");

  const pl = await getProfitLoss({ companyId, branchId, dateFrom, dateTo, includeZero });

  const printParams = new URLSearchParams({
    from: dateFrom,
    to: dateTo,
    ...(branchId ? { branchId: String(branchId) } : {}),
    ...(includeZero ? { zero: "1" } : {}),
  });

  const hasAnyRows =
    pl.revenueSections.length > 0 || pl.costOfSalesSections.length > 0 || pl.operatingExpenseSections.length > 0;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <h1 className={styles.title}>Profit &amp; Loss</h1>
          <p className={styles.subtitle}>
            Posted income and expense for the period. Year-end closing entries are always excluded.
          </p>
        </div>
        {mayPrint && (
          <Link href={`/print/profit-loss?${printParams.toString()}`} target="_blank" className={styles.btn}>
            Print
          </Link>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.toolbar}>
          <Suspense fallback={null}>
            <ProfitLossFilters
              branches={branches.map((b) => ({ id: b.BRANCH_ID, code: b.BRANCH_CODE, name: b.BRANCH_NAME }))}
              fiscalYears={fiscalYears.map((fy) => ({
                id: fy.FY_ID,
                name: fy.FY_NAME,
                startDate: toDateInputValue(fy.START_DATE),
                endDate: toDateInputValue(fy.END_DATE),
              }))}
            />
          </Suspense>
        </div>

        {pl.spansFiscalYears && (
          <p className={styles.note} style={{ margin: "0 16px 12px" }}>
            This range spans more than one fiscal year — the totals below are a valid sum, but not a
            single statutory P&amp;L.
          </p>
        )}

        {!pl.cogsMapped && (
          <p className={styles.note} style={{ margin: "0 16px 12px" }}>
            No Cost of Sales (COGS) account is mapped for this company, so Gross Profit cannot be shown —
            set it on the Default GL Accounts screen.
          </p>
        )}

        {!hasAnyRows ? (
          <p className={styles.empty}>No activity in this period.</p>
        ) : (
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
                <td colSpan={4} className={styles.strong} style={{ background: "var(--surface-2)" }}>
                  Revenue
                </td>
              </tr>
              {pl.revenueSections.map((s) =>
                renderSection(s, `rev-${s.code}`, dateFrom, dateTo, branchId, pl.totalRevenue),
              )}
              <tr style={{ fontWeight: 700 }}>
                <td colSpan={2} style={{ textAlign: "right" }}>
                  Total Revenue
                </td>
                <td className={styles.num}>{fmtAccounting(pl.totalRevenue)}</td>
                <td className={styles.num}>{pct(pl.totalRevenue, pl.totalRevenue)}</td>
              </tr>

              {pl.cogsMapped && (
                <>
                  <tr>
                    <td colSpan={4} className={styles.strong} style={{ background: "var(--surface-2)" }}>
                      Cost of Sales
                    </td>
                  </tr>
                  {pl.costOfSalesSections.map((s) =>
                    renderSection(s, `cos-${s.code}`, dateFrom, dateTo, branchId, pl.totalRevenue),
                  )}
                  <tr style={{ fontWeight: 700 }}>
                    <td colSpan={2} style={{ textAlign: "right" }}>
                      Total Cost of Sales
                    </td>
                    <td className={styles.num}>{fmtAccounting(pl.totalCostOfSales)}</td>
                    <td className={styles.num}>{pct(pl.totalCostOfSales, pl.totalRevenue)}</td>
                  </tr>

                  <tr style={{ fontWeight: 700, background: "var(--surface-2)" }}>
                    <td colSpan={2} style={{ textAlign: "right" }}>
                      Gross Profit
                    </td>
                    <td className={styles.num}>{fmtAccounting(pl.grossProfit ?? 0)}</td>
                    <td className={styles.num}>{pct(pl.grossProfit ?? 0, pl.totalRevenue)}</td>
                  </tr>
                </>
              )}

              <tr>
                <td colSpan={4} className={styles.strong} style={{ background: "var(--surface-2)" }}>
                  Operating Expenses
                </td>
              </tr>
              {pl.operatingExpenseSections.map((s) =>
                renderSection(s, `opex-${s.code}`, dateFrom, dateTo, branchId, pl.totalRevenue),
              )}
              <tr style={{ fontWeight: 700 }}>
                <td colSpan={2} style={{ textAlign: "right" }}>
                  Total Operating Expenses
                </td>
                <td className={styles.num}>{fmtAccounting(pl.totalOperatingExpenses)}</td>
                <td className={styles.num}>{pct(pl.totalOperatingExpenses, pl.totalRevenue)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} style={{ textAlign: "right", fontWeight: 700 }}>
                  Net Profit
                </td>
                <td className={styles.num} style={{ fontWeight: 700 }}>
                  {fmtAccounting(pl.netProfit)}
                </td>
                <td className={styles.num} style={{ fontWeight: 700 }}>
                  {pct(pl.netProfit, pl.totalRevenue)}
                </td>
              </tr>
              <tr>
                <td colSpan={4} style={{ textAlign: "right" }}>
                  {pl.netProfit >= 0 ? (
                    <span className={styles.badgeOk}>Profit</span>
                  ) : (
                    <span className={styles.badgeWarn}>Loss</span>
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
