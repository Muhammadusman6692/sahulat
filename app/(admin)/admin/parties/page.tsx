import Link from "next/link";
import { Suspense } from "react";
import { requirePermission } from "@/lib/dal";
import { getActiveCompanyId } from "@/lib/active-scope";
import { listParties } from "@/lib/db/parties";
import { can } from "@/lib/permissions";
import { fmtMoney } from "@/lib/format";
import styles from "@/components/data-grid/grid.module.css";
import PartyFilters from "./party-filters";

export const metadata = { title: "Party Master · Sahulat ERP" };

const PAGE_SIZE = 15;

function toInt(value: string | undefined): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export default async function PartiesPage({
  searchParams,
}: PageProps<"/admin/parties">) {
  const user = await requirePermission("PARTY_MAINT", "VIEW");

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const companyId = await getActiveCompanyId(user.access);
  if (!companyId) {
    return <p className={styles.empty}>Your account is not scoped to any company.</p>;
  }

  const page = toInt(one(sp.page)) ?? 1;
  const search = one(sp.q)?.trim() || undefined;
  const typeRaw = one(sp.type);
  const type = typeRaw === "CUSTOMER" || typeRaw === "SUPPLIER" ? typeRaw : undefined;
  const includeInactive = one(sp.inactive) === "1";
  const mayCreate = can(user.permissions, "PARTY_MAINT", "CREATE");
  const mayEdit = can(user.permissions, "PARTY_MAINT", "EDIT");

  const { rows, total } = await listParties({
    companyId,
    search,
    type,
    includeInactive,
    page,
    pageSize: PAGE_SIZE,
  });

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  const pageHref = (n: number) => {
    const next = new URLSearchParams();
    if (search) next.set("q", search);
    if (type) next.set("type", type);
    if (includeInactive) next.set("inactive", "1");
    if (n > 1) next.set("page", String(n));
    const qs = next.toString();
    return qs ? `/admin/parties?${qs}` : "/admin/parties";
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <h1 className={styles.title}>Party Master</h1>
          <p className={styles.subtitle}>
            Customers and suppliers. Each one gets its own receivable/payable
            ledger account, created automatically the first time it is saved.
          </p>
        </div>
        {mayCreate && (
          <Link href="/admin/parties/new" className={styles.btnPrimary}>
            <svg
              width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            New party
          </Link>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.toolbar}>
          <Suspense fallback={null}>
            <PartyFilters />
          </Suspense>
          <div className={styles.grow} />
          <span className={styles.count}>
            {total} {total === 1 ? "party" : "parties"}
          </span>
        </div>

        {rows.length === 0 ? (
          <p className={styles.empty}>No parties match these filters.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Party name</th>
                <th>Type</th>
                <th>NTN / STRN</th>
                <th>Phone</th>
                <th style={{ textAlign: "right" }}>Credit limit</th>
                <th style={{ textAlign: "right" }}>Days</th>
                <th>Ledger account</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const inactive = r.ACTIVE_YN !== "Y";
                return (
                  <tr key={r.PARTY_ID} className={inactive ? styles.inactiveRow : undefined}>
                    <td className={styles.code}>{r.PARTY_CODE}</td>
                    <td className={styles.strong}>{r.PARTY_NAME}</td>
                    <td>
                      {r.IS_CUSTOMER === "Y" && (
                        <span className={styles.tag} style={{ marginRight: 4 }}>
                          Customer
                        </span>
                      )}
                      {r.IS_SUPPLIER === "Y" && <span className={styles.tag}>Supplier</span>}
                    </td>
                    <td className={styles.muted}>
                      {[r.NTN_NO, r.STRN_NO].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td className={styles.muted}>{r.PHONE ?? "—"}</td>
                    <td className={styles.num}>{fmtMoney(r.CREDIT_LIMIT)}</td>
                    <td className={`${styles.num} ${styles.muted}`}>{r.CREDIT_DAYS}</td>
                    <td className={styles.code} style={{ fontSize: 11 }}>
                      {[r.AR_ACCOUNT_CODE, r.AP_ACCOUNT_CODE].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td>
                      {inactive ? (
                        <span className={styles.badgeOff}>INACTIVE</span>
                      ) : (
                        <span className={styles.badgeOk}>ACTIVE</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {mayEdit && (
                        <Link href={`/admin/parties/${r.PARTY_ID}`} className={styles.pageLink}>
                          Edit
                        </Link>
                      )}
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

      <p className={styles.note}>
        Creating or editing a party auto-creates its receivable/payable ledger
        account under Trade Debtors / Trade Creditors — there is no manual
        linking step. Deleting a party only marks it inactive; ledger history
        is never removed. Amounts are PKR.
      </p>
    </div>
  );
}
