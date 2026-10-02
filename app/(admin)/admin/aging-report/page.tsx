import Link from "next/link";
import { Suspense } from "react";
import { requirePermission } from "@/lib/dal";
import { getActiveCompanyId } from "@/lib/active-scope";
import { getAgingSummary, listPartiesForAging, AGING_BUCKETS } from "@/lib/db/aging-report";
import { listBranches } from "@/lib/db/branches";
import { can } from "@/lib/permissions";
import { fmtMoney } from "@/lib/format";
import styles from "@/components/data-grid/grid.module.css";
import AgingReportFilters from "./aging-report-filters";

export const metadata = { title: "Aging Report · Sahulat ERP" };

function toInt(value: string | undefined): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

// toISOString() converts to UTC first, which lands on the wrong calendar day
// whenever this process runs outside UTC (this machine is UTC+5) — same
// pitfall lib/oracle-date.ts guards against for dates read back from Oracle.
function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function today(): string {
  return toDateInputValue(new Date());
}

export default async function AgingReportPage({
  searchParams,
}: PageProps<"/admin/aging-report">) {
  const user = await requirePermission("AGING_REPORT", "VIEW");

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const companyId = await getActiveCompanyId(user.access);
  if (!companyId) {
    return <p className={styles.empty}>Your account is not scoped to any company.</p>;
  }

  const branchId = toInt(one(sp.branchId));
  const asOfDate = one(sp.asOf) || today();
  const mayPrint = can(user.permissions, "AGING_REPORT", "PRINT");

  const [parties, branches, summary] = await Promise.all([
    listPartiesForAging(companyId),
    listBranches([companyId], false),
    getAgingSummary({ companyId, branchId, asOfDate }),
  ]);

  const printHref = `/print/aging-report?asOf=${asOfDate}${branchId ? `&branchId=${branchId}` : ""}`;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <h1 className={styles.title}>Aging Report</h1>
          <p className={styles.subtitle}>
            Outstanding party balances bucketed by age — combined receivable + payable, as of a chosen date.
          </p>
        </div>
        {mayPrint && (
          <Link href={printHref} target="_blank" className={styles.btn}>
            Print
          </Link>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.toolbar}>
          <Suspense fallback={null}>
            <AgingReportFilters
              parties={parties.map((p) => ({
                id: p.PARTY_ID,
                code: p.PARTY_CODE,
                name: p.PARTY_NAME,
                isCustomer: p.IS_CUSTOMER,
                isSupplier: p.IS_SUPPLIER,
              }))}
              branches={branches.map((b) => ({ id: b.BRANCH_ID, code: b.BRANCH_CODE, name: b.BRANCH_NAME }))}
            />
          </Suspense>
        </div>

        {summary.rows.length === 0 ? (
          <p className={styles.empty}>No outstanding balances as of this date.</p>
        ) : (
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
              {summary.rows.map((r) => (
                <tr key={r.PARTY_ID}>
                  <td className={styles.code}>
                    <Link href={`/admin/aging-report/${r.PARTY_ID}?asOf=${asOfDate}`}>{r.PARTY_CODE}</Link>
                  </td>
                  <td>
                    <Link href={`/admin/aging-report/${r.PARTY_ID}?asOf=${asOfDate}`}>{r.PARTY_NAME}</Link>
                  </td>
                  {AGING_BUCKETS.map((b) => (
                    <td key={b.key} className={styles.num}>
                      {r.buckets[b.key] ? fmtMoney(r.buckets[b.key]) : ""}
                    </td>
                  ))}
                  <td className={styles.num}>{r.advance ? fmtMoney(r.advance) : ""}</td>
                  <td className={styles.num} style={{ fontWeight: 600 }}>
                    {fmtMoney(r.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} style={{ textAlign: "right", fontWeight: 600 }}>
                  Totals
                </td>
                {AGING_BUCKETS.map((b) => (
                  <td key={b.key} className={styles.num} style={{ fontWeight: 600 }}>
                    {fmtMoney(summary.grandTotal[b.key])}
                  </td>
                ))}
                <td className={styles.num} style={{ fontWeight: 600 }}>
                  {fmtMoney(summary.grandTotal.advance)}
                </td>
                <td className={styles.num} style={{ fontWeight: 600 }}>
                  {fmtMoney(summary.grandTotal.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
