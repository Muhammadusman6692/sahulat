import Link from "next/link";
import { Suspense } from "react";
import { requirePermission } from "@/lib/dal";
import { getActiveCompanyId } from "@/lib/active-scope";
import { getPartyLedger, listPartiesForLedger } from "@/lib/db/party-ledger";
import { listBranches } from "@/lib/db/branches";
import { can } from "@/lib/permissions";
import { fmtMoney, fmtDate } from "@/lib/format";
import { voucherDetailHref } from "@/lib/voucher-route";
import styles from "@/components/data-grid/grid.module.css";
import PartyLedgerFilters from "./party-ledger-filters";

export const metadata = { title: "Party Ledger · Sahulat ERP" };

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

function firstOfMonth(): string {
  const d = new Date();
  return toDateInputValue(new Date(d.getFullYear(), d.getMonth(), 1));
}

function today(): string {
  return toDateInputValue(new Date());
}

function roleTag(isCustomer: "Y" | "N", isSupplier: "Y" | "N"): string {
  if (isCustomer === "Y" && isSupplier === "Y") return "Customer & Supplier";
  if (isCustomer === "Y") return "Customer";
  if (isSupplier === "Y") return "Supplier";
  return "—";
}

export default async function PartyLedgerPage({
  searchParams,
}: PageProps<"/admin/party-ledger">) {
  const user = await requirePermission("PARTY_LEDGER", "VIEW");

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const companyId = await getActiveCompanyId(user.access);
  if (!companyId) {
    return <p className={styles.empty}>Your account is not scoped to any company.</p>;
  }

  const partyId = toInt(one(sp.partyId));
  const branchId = toInt(one(sp.branchId));
  const dateFrom = one(sp.from) || firstOfMonth();
  const dateTo = one(sp.to) || today();
  const mayPrint = can(user.permissions, "PARTY_LEDGER", "PRINT");

  const [parties, branches] = await Promise.all([
    listPartiesForLedger(companyId),
    listBranches([companyId], false),
  ]);

  const ledger = partyId
    ? await getPartyLedger({ companyId, partyId, branchId, dateFrom, dateTo })
    : null;

  const printHref = partyId
    ? `/print/party-ledger/${partyId}?from=${dateFrom}&to=${dateTo}${branchId ? `&branchId=${branchId}` : ""}`
    : null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <h1 className={styles.title}>Party Ledger</h1>
          <p className={styles.subtitle}>
            Posted movements for one party — combined receivable + payable, opening balance, running balance.
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
            <PartyLedgerFilters
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

        {!partyId ? (
          <p className={styles.empty}>Select a party to view its ledger.</p>
        ) : !ledger ? (
          <p className={styles.empty}>Party not found.</p>
        ) : (
          <>
            <div style={{ padding: "11px 14px", borderBottom: "1px solid var(--rule)" }}>
              <div className={styles.strong}>
                {ledger.party.PARTY_CODE} &middot; {ledger.party.PARTY_NAME}
                {" "}
                <span className={styles.tag}>{roleTag(ledger.party.IS_CUSTOMER, ledger.party.IS_SUPPLIER)}</span>
              </div>
              <div className={styles.muted} style={{ fontSize: 11 }}>
                Combined receivable + payable &middot; positive = party owes you, negative = you owe the party
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
                    <th>Ledger</th>
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
                        <td className={styles.muted}>{l.LEDGER_SIDE === "AR" ? "Receivable" : "Payable"}</td>
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
