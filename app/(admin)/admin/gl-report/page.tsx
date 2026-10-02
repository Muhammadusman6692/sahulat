import Link from "next/link";
import { Suspense } from "react";
import { requirePermission } from "@/lib/dal";
import { getActiveCompanyId } from "@/lib/active-scope";
import { getAccountLedger } from "@/lib/db/general-ledger";
import { listPostableAccounts } from "@/lib/db/coa";
import { listBranches } from "@/lib/db/branches";
import { can } from "@/lib/permissions";
import { fmtMoney, fmtDate } from "@/lib/format";
import { voucherDetailHref } from "@/lib/voucher-route";
import styles from "@/components/data-grid/grid.module.css";
import GlReportFilters from "./gl-report-filters";

export const metadata = { title: "General Ledger · Sahulat ERP" };

function toInt(value: string | undefined): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

// toISOString() converts to UTC first, which lands on the wrong calendar day
// whenever this process runs outside UTC (this machine is UTC+5) — the same
// pitfall lib/oracle-date.ts guards against for dates read back from Oracle.
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

export default async function GeneralLedgerPage({
  searchParams,
}: PageProps<"/admin/gl-report">) {
  const user = await requirePermission("GL_REPORT", "VIEW");

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const companyId = await getActiveCompanyId(user.access);
  if (!companyId) {
    return <p className={styles.empty}>Your account is not scoped to any company.</p>;
  }

  const coaId = toInt(one(sp.coaId));
  const branchId = toInt(one(sp.branchId));
  const dateFrom = one(sp.from) || firstOfMonth();
  const dateTo = one(sp.to) || today();
  const mayPrint = can(user.permissions, "GL_REPORT", "PRINT");

  const [accounts, branches] = await Promise.all([
    listPostableAccounts(companyId),
    listBranches([companyId], false),
  ]);

  const ledger = coaId
    ? await getAccountLedger({ companyId, coaId, branchId, dateFrom, dateTo })
    : null;

  const printHref = coaId
    ? `/print/gl-report/${coaId}?from=${dateFrom}&to=${dateTo}${branchId ? `&branchId=${branchId}` : ""}`
    : null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <h1 className={styles.title}>General Ledger</h1>
          <p className={styles.subtitle}>
            Posted movements for one account — opening balance, postings in range, running balance.
          </p>
        </div>
        {mayPrint && printHref && (
          <Link href={printHref} target="_blank" className={styles.btn}>
            Print
          </Link>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.toolbar}>
          <Suspense fallback={null}>
            <GlReportFilters
              accounts={accounts.map((a) => ({
                id: a.COA_ID,
                code: a.ACCOUNT_CODE,
                name: a.ACCOUNT_NAME,
                controlType: a.IS_CONTROL_AC,
                parentName: a.PARENT_NAME,
              }))}
              branches={branches.map((b) => ({ id: b.BRANCH_ID, code: b.BRANCH_CODE, name: b.BRANCH_NAME }))}
            />
          </Suspense>
        </div>

        {!coaId ? (
          <p className={styles.empty}>Select an account to view its ledger.</p>
        ) : !ledger ? (
          <p className={styles.empty}>Account not found.</p>
        ) : (
          <>
            <div style={{ padding: "11px 14px", borderBottom: "1px solid var(--rule)" }}>
              <div className={styles.strong}>
                {ledger.account.ACCOUNT_CODE} &middot; {ledger.account.ACCOUNT_NAME}
              </div>
              <div className={styles.muted} style={{ fontSize: 11 }}>
                {ledger.account.ACCOUNT_NATURE} &middot; Normal side {ledger.account.NORMAL_SIDE === "D" ? "Debit" : "Credit"}
                {" "}&middot; {fmtDate(new Date(dateFrom))} to {fmtDate(new Date(dateTo))}
              </div>
            </div>

            {ledger.lines.length === 0 ? (
              <p className={styles.empty}>No posted activity in this date range.</p>
            ) : (
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
                  <tr>
                    <td colSpan={7} className={styles.muted}>
                      Opening Balance
                    </td>
                    <td className={styles.num}>{fmtMoney(ledger.openingBalance)}</td>
                  </tr>
                  {ledger.lines.map((l) => {
                    const href = voucherDetailHref(l.VOUCHER_TYPE, l.VOUCHER_ID);
                    return (
                      <tr key={`${l.VOUCHER_ID}-${l.VOUCHER_DATE.toISOString()}`}>
                        <td className={styles.muted}>{fmtDate(l.VOUCHER_DATE)}</td>
                        <td className={styles.code}>
                          {href ? <Link href={href}>{l.VOUCHER_NO}</Link> : l.VOUCHER_NO}
                        </td>
                        <td>
                          <span className={styles.tag}>{l.VOUCHER_TYPE}</span>
                        </td>
                        <td>{l.NARRATION ?? "—"}</td>
                        <td className={styles.muted}>{l.PARTY_NAME ?? "—"}</td>
                        <td className={styles.num}>{l.DEBIT_AMT ? fmtMoney(l.DEBIT_AMT) : ""}</td>
                        <td className={styles.num}>{l.CREDIT_AMT ? fmtMoney(l.CREDIT_AMT) : ""}</td>
                        <td className={styles.num}>{fmtMoney(l.RUNNING_BALANCE)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5} style={{ textAlign: "right", fontWeight: 600 }}>
                      Totals
                    </td>
                    <td className={styles.num} style={{ fontWeight: 600 }}>
                      {fmtMoney(ledger.totalDebit)}
                    </td>
                    <td className={styles.num} style={{ fontWeight: 600 }}>
                      {fmtMoney(ledger.totalCredit)}
                    </td>
                    <td className={styles.num} style={{ fontWeight: 600 }}>
                      {fmtMoney(ledger.closingBalance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
