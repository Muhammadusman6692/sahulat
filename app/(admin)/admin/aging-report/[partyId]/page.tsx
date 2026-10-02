import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/dal";
import { getActiveCompanyId } from "@/lib/active-scope";
import { getPartyOpenItems, AGING_BUCKETS } from "@/lib/db/aging-report";
import { fmtMoney, fmtDate } from "@/lib/format";
import { voucherDetailHref } from "@/lib/voucher-route";
import BackLink from "@/components/back-link/back-link";
import styles from "@/components/data-grid/grid.module.css";
import Link from "next/link";

export const metadata = { title: "Aging Report · Sahulat ERP" };

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

function bucketLabel(bucket: string): string {
  if (bucket === "ADVANCE") return "Advance";
  return AGING_BUCKETS.find((b) => b.key === bucket)?.label ?? bucket;
}

export default async function AgingReportPartyPage({
  params,
  searchParams,
}: PageProps<"/admin/aging-report/[partyId]">) {
  const { partyId: partyIdParam } = await params;
  const partyId = Number(partyIdParam);
  if (!Number.isInteger(partyId) || partyId <= 0) notFound();

  const user = await requirePermission("AGING_REPORT", "VIEW");

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const asOfDate = one(sp.asOf) || today();

  const companyId = await getActiveCompanyId(user.access);
  if (!companyId) {
    return <p className={styles.empty}>Your account is not scoped to any company.</p>;
  }

  const open = await getPartyOpenItems({ companyId, partyId, asOfDate });
  if (!open) notFound();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <BackLink href={`/admin/aging-report?asOf=${asOfDate}`}>Back to Aging Report</BackLink>
          <h1 className={styles.title}>
            {open.party.PARTY_CODE} &middot; {open.party.PARTY_NAME}{" "}
            <span className={styles.tag}>{roleTag(open.party.IS_CUSTOMER, open.party.IS_SUPPLIER)}</span>
          </h1>
          <p className={styles.subtitle}>Open items as of {fmtDate(new Date(asOfDate))}</p>
        </div>
      </div>

      <div className={styles.card}>
        {open.items.length === 0 ? (
          <p className={styles.empty}>No open balance as of this date.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Voucher No</th>
                <th>Type</th>
                <th>Date</th>
                <th>Due Date</th>
                <th style={{ textAlign: "right" }}>Days Overdue</th>
                <th>Bucket</th>
                <th>Narration</th>
                <th style={{ textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {open.items.map((i) => {
                const href = voucherDetailHref(i.VOUCHER_TYPE, i.VOUCHER_ID);
                return (
                  <tr key={`${i.VOUCHER_ID}-${i.VOUCHER_DATE.toISOString()}`}>
                    <td className={styles.code}>
                      {href ? <Link href={href}>{i.VOUCHER_NO}</Link> : i.VOUCHER_NO}
                    </td>
                    <td>
                      <span className={styles.tag}>{i.VOUCHER_TYPE}</span>
                    </td>
                    <td className={styles.muted}>{fmtDate(i.VOUCHER_DATE)}</td>
                    <td className={styles.muted}>{i.BUCKET === "ADVANCE" ? "—" : fmtDate(i.DUE_DATE)}</td>
                    <td className={styles.num}>{i.BUCKET === "ADVANCE" ? "—" : i.DAYS_OVERDUE}</td>
                    <td>{bucketLabel(i.BUCKET)}</td>
                    <td>{i.NARRATION ?? "—"}</td>
                    <td className={styles.num}>{fmtMoney(i.AMOUNT)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={7} style={{ textAlign: "right", fontWeight: 600 }}>
                  Total
                </td>
                <td className={styles.num} style={{ fontWeight: 600 }}>
                  {fmtMoney(open.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
