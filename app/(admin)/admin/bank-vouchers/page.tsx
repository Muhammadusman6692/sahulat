import Link from "next/link";
import { Suspense } from "react";
import { requirePermission } from "@/lib/dal";
import { getActiveCompanyId } from "@/lib/active-scope";
import { listBankVouchers, type BvStatus, type BvType, type InstrumentType } from "@/lib/db/bank-vouchers";
import { listBranches } from "@/lib/db/branches";
import { can } from "@/lib/permissions";
import { fmtMoney } from "@/lib/format";
import styles from "@/components/data-grid/grid.module.css";
import BvFilters from "./bv-filters";

export const metadata = { title: "Bank Payment/Receipt · Sahulat ERP" };

const PAGE_SIZE = 15;

const INSTRUMENT_LABEL: Record<InstrumentType, string> = {
  CHEQUE: "Cheque",
  ONLINE_TRANSFER: "Online Transfer",
  PAY_ORDER: "Pay Order",
  DD: "Demand Draft",
  RTGS: "RTGS",
};

function toInt(value: string | undefined): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function statusBadge(status: BvStatus) {
  if (status === "POSTED") return <span className={styles.badgeOk}>POSTED</span>;
  if (status === "CANCELLED")
    return (
      <span className={styles.badge} style={{ background: "#f7e3e2", color: "var(--danger)" }}>
        CANCELLED
      </span>
    );
  return <span className={styles.badgeOff}>DRAFT</span>;
}

function typeBadge(type: BvType) {
  return type === "BRV" ? (
    <span className={styles.badgeOk}>Receipt</span>
  ) : (
    <span className={styles.badge}>Payment</span>
  );
}

export default async function BankVouchersPage({
  searchParams,
}: PageProps<"/admin/bank-vouchers">) {
  const user = await requirePermission("BANK_VOUCHER", "VIEW");

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const companyId = await getActiveCompanyId(user.access);
  if (!companyId) {
    return <p className={styles.empty}>Your account is not scoped to any company.</p>;
  }

  const page = toInt(one(sp.page)) ?? 1;
  const search = one(sp.q)?.trim() || undefined;
  const statusRaw = one(sp.status);
  const status =
    statusRaw === "DRAFT" || statusRaw === "POSTED" || statusRaw === "CANCELLED"
      ? statusRaw
      : undefined;
  const typeRaw = one(sp.type);
  const type = typeRaw === "BPV" || typeRaw === "BRV" ? typeRaw : undefined;
  const branchId = toInt(one(sp.branchId));
  const dateFrom = one(sp.from) || undefined;
  const dateTo = one(sp.to) || undefined;
  const mayCreate = can(user.permissions, "BANK_VOUCHER", "CREATE");
  const mayEdit = can(user.permissions, "BANK_VOUCHER", "EDIT");

  const [{ rows, total }, branches] = await Promise.all([
    listBankVouchers({
      companyId,
      branchId,
      type,
      status,
      search,
      dateFrom,
      dateTo,
      page,
      pageSize: PAGE_SIZE,
    }),
    listBranches([companyId], false),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  const pageHref = (n: number) => {
    const next = new URLSearchParams();
    if (search) next.set("q", search);
    if (status) next.set("status", status);
    if (type) next.set("type", type);
    if (branchId) next.set("branchId", String(branchId));
    if (dateFrom) next.set("from", dateFrom);
    if (dateTo) next.set("to", dateTo);
    if (n > 1) next.set("page", String(n));
    const qs = next.toString();
    return qs ? `/admin/bank-vouchers?${qs}` : "/admin/bank-vouchers";
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <h1 className={styles.title}>Bank Payment / Receipt</h1>
          <p className={styles.subtitle}>Record payments made or amounts received through a bank account.</p>
        </div>
        {mayCreate && (
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/admin/bank-vouchers/new?type=BPV" className={styles.btnPrimary}>
              <svg
                width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Bank Payment
            </Link>
            <Link href="/admin/bank-vouchers/new?type=BRV" className={styles.btnPrimary}>
              <svg
                width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Bank Receipt
            </Link>
          </div>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.toolbar}>
          <Suspense fallback={null}>
            <BvFilters
              branches={branches.map((b) => ({ id: b.BRANCH_ID, code: b.BRANCH_CODE, name: b.BRANCH_NAME }))}
            />
          </Suspense>
          <div className={styles.grow} />
          <span className={styles.count}>
            {total} {total === 1 ? "voucher" : "vouchers"}
          </span>
        </div>

        {rows.length === 0 ? (
          <p className={styles.empty}>No bank vouchers match these filters.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Voucher No</th>
                <th>Date</th>
                <th>Branch</th>
                <th>Type</th>
                <th>Bank Account</th>
                <th>Instrument</th>
                <th>Narration</th>
                <th style={{ textAlign: "right" }}>Amount</th>
                <th>Status</th>
                <th>Created By</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const cancelled = r.STATUS === "CANCELLED";
                return (
                  <tr key={r.VOUCHER_ID} className={cancelled ? styles.inactiveRow : undefined}>
                    <td className={styles.code}>
                      <Link href={`/admin/bank-vouchers/${r.VOUCHER_ID}`}>{r.VOUCHER_NO}</Link>
                    </td>
                    <td className={styles.muted}>{fmtDate(r.VOUCHER_DATE)}</td>
                    <td>{r.BRANCH_NAME}</td>
                    <td>{typeBadge(r.VOUCHER_TYPE)}</td>
                    <td className={styles.muted}>
                      {r.BANK_ACCOUNT_CODE} - {r.BANK_ACCOUNT_NAME}
                    </td>
                    <td className={styles.muted}>
                      {INSTRUMENT_LABEL[r.INSTRUMENT_TYPE]}
                      {r.INSTRUMENT_NO ? ` · ${r.INSTRUMENT_NO}` : ""}
                    </td>
                    <td>{r.NARRATION ?? "—"}</td>
                    <td className={styles.num}>{fmtMoney(r.TOTAL_AMT)}</td>
                    <td>{statusBadge(r.STATUS)}</td>
                    <td className={styles.muted}>{r.CREATED_BY_NAME}</td>
                    <td style={{ textAlign: "right" }}>
                      <Link href={`/admin/bank-vouchers/${r.VOUCHER_ID}`} className={styles.pageLink}>
                        {r.STATUS === "DRAFT" && mayEdit ? "Edit" : "View"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div className={styles.footer}>
          <span className={styles.count}>
            Showing {from}–{to} of {total}
          </span>
          <div className={styles.grow} />
          <Link
            href={pageHref(page - 1)}
            className={page <= 1 ? styles.pageLinkOff : styles.pageLink}
            aria-disabled={page <= 1}
          >
            Previous
          </Link>
          <span className={styles.pageOf}>
            {page} / {pages}
          </span>
          <Link
            href={pageHref(page + 1)}
            className={page >= pages ? styles.pageLinkOff : styles.pageLink}
            aria-disabled={page >= pages}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}
