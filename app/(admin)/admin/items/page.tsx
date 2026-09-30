import Link from "next/link";
import { Suspense } from "react";
import { requirePermission } from "@/lib/dal";
import { listItems, listBrands, listCategories } from "@/lib/db/items";
import { can } from "@/lib/permissions";
import { fmtQty, fmtRate } from "@/lib/format";
import styles from "@/components/data-grid/grid.module.css";
import ItemsFilters from "./items-filters";

export const metadata = { title: "Items · Sahulat ERP" };

const PAGE_SIZE = 15;

function toInt(value: string | undefined): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export default async function ItemsPage({
  searchParams,
}: PageProps<"/admin/items">) {
  // The gate for this page. The sidebar hiding the link is cosmetic only.
  const user = await requirePermission("ITEM_MAINT", "VIEW");

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const companyId = user.access[0]?.companyId;
  if (!companyId) {
    return <p className={styles.empty}>Your account is not scoped to any company.</p>;
  }

  const page = toInt(one(sp.page)) ?? 1;
  const search = one(sp.q)?.trim() || undefined;
  const categoryId = toInt(one(sp.category));
  const brandId = toInt(one(sp.brand));
  const includeInactive = one(sp.inactive) === "1";
  const mayCreate = can(user.permissions, "ITEM_MAINT", "CREATE");
  const mayEdit = can(user.permissions, "ITEM_MAINT", "EDIT");

  const [{ rows, total }, categories, brands] = await Promise.all([
    listItems({
      companyId,
      search,
      categoryId,
      brandId,
      includeInactive,
      page,
      pageSize: PAGE_SIZE,
    }),
    listCategories(companyId),
    listBrands(companyId),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  const pageHref = (n: number) => {
    const next = new URLSearchParams();
    if (search) next.set("q", search);
    if (categoryId) next.set("category", String(categoryId));
    if (brandId) next.set("brand", String(brandId));
    if (includeInactive) next.set("inactive", "1");
    if (n > 1) next.set("page", String(n));
    const qs = next.toString();
    return qs ? `/admin/items?${qs}` : "/admin/items";
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <h1 className={styles.title}>Items</h1>
          <p className={styles.subtitle}>
            Every item carries one unit of measure and a mandatory effective-dated
            sale price. Price history is never overwritten.
          </p>
        </div>
        <button type="button" className={styles.btn}>
          Export
        </button>
        {mayCreate && (
          <Link href="/admin/items/new" className={styles.btnPrimary}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            New item
          </Link>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.toolbar}>
          <Suspense fallback={null}>
            <ItemsFilters
              categories={categories.map((c) => ({
                id: c.CATEGORY_ID,
                name: c.CATEGORY_NAME,
              }))}
              brands={brands.map((b) => ({ id: b.BRAND_ID, name: b.BRAND_NAME }))}
            />
          </Suspense>
          <div className={styles.grow} />
          <span className={styles.count}>
            {total} {total === 1 ? "item" : "items"}
          </span>
        </div>

        {rows.length === 0 ? (
          <p className={styles.empty}>No items match these filters.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Item name</th>
                <th>Category</th>
                <th>Brand</th>
                <th>UOM</th>
                <th style={{ textAlign: "right" }}>Sale price</th>
                <th style={{ textAlign: "right" }}>On hand</th>
                <th style={{ textAlign: "right" }}>Reorder</th>
                <th>Tax</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const inactive = r.ACTIVE_YN !== "Y";
                const low = !inactive && r.ON_HAND < r.REORDER_LEVEL;
                return (
                  <tr
                    key={r.ITEM_ID}
                    className={
                      inactive ? styles.inactiveRow : low ? styles.lowRow : undefined
                    }
                  >
                    <td className={styles.code}>{r.ITEM_CODE}</td>
                    <td className={styles.strong}>{r.ITEM_NAME}</td>
                    <td className={styles.muted}>{r.CATEGORY_NAME ?? "—"}</td>
                    <td className={styles.muted}>{r.BRAND_NAME ?? "—"}</td>
                    <td className={styles.muted}>{r.UOM_CODE}</td>
                    <td className={styles.num}>{fmtRate(r.SALE_PRICE)}</td>
                    <td
                      className={styles.num}
                      style={low ? { color: "var(--accent)", fontWeight: 600 } : undefined}
                    >
                      {fmtQty(r.ON_HAND)}
                    </td>
                    <td className={`${styles.num} ${styles.muted}`}>
                      {fmtQty(r.REORDER_LEVEL)}
                    </td>
                    <td>
                      <span className={styles.tag}>{r.TAX_CODE ?? "—"}</span>
                    </td>
                    <td>
                      {inactive ? (
                        <span className={styles.badgeOff}>INACTIVE</span>
                      ) : low ? (
                        <span className={styles.badgeWarn}>LOW</span>
                      ) : (
                        <span className={styles.badgeOk}>ACTIVE</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {mayEdit && (
                        <Link href={`/admin/items/${r.ITEM_ID}`} className={styles.pageLink}>
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
        Deleting an item only marks it inactive — rows are never removed, so
        historical documents keep resolving. Prices shown are the ones effective
        today. Amounts are PKR and exclude tax.
      </p>
    </div>
  );
}
