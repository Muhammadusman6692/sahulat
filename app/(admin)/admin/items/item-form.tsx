"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createItemAction, updateItemAction, type FormState } from "./actions";
import type { ItemDetail } from "@/lib/db/items";
import { LockedField } from "@/components/form/locked-field";
import styles from "@/components/form/form.module.css";

export type Option = { value: string; label: string };

export default function ItemForm({
  item,
  companyId,
  companyLabel,
  categories,
  brands,
  uoms,
  taxes,
}: {
  /** null for create. */
  item: ItemDetail | null;
  companyId?: number;
  companyLabel: string;
  categories: Option[];
  brands: Option[];
  uoms: Option[];
  taxes: Option[];
}) {
  const action = item ? updateItemAction.bind(null, item.ITEM_ID) : createItemAction;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};

  const v = (name: string, stored: string | number | null | undefined) =>
    state.values?.[name] ?? (stored === null || stored === undefined ? "" : String(stored));
  const checked = (name: string, fallback: boolean) =>
    state.values ? state.values[name] === "on" : fallback;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className={styles.wrap}>
      {state.error && (
        <p className={styles.error} role="alert">
          <svg
            width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            style={{ flexShrink: 0, marginTop: 1 }}
          >
            <path d="M12 9v4M12 17h.01" />
            <path d="M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          </svg>
          {state.error}
        </p>
      )}

      {!item && companyId && <input type="hidden" name="companyId" value={companyId} />}

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Identity</h2>
        <div className={styles.section}>
          <div className={styles.field}>
            <span className={styles.label}>Company</span>
            <LockedField value={companyLabel} />
          </div>

          <div className={styles.field}>
            <label className={`${styles.label} ${styles.req}`} htmlFor="itemCode">
              Item code
            </label>
            <input
              id="itemCode"
              name="itemCode"
              className={`${fe.itemCode ? styles.inputInvalid : styles.input} ${styles.mono}`}
              defaultValue={v("itemCode", item?.ITEM_CODE)}
              maxLength={30}
              required
            />
            {fe.itemCode ? (
              <span className={styles.fieldError}>{fe.itemCode}</span>
            ) : (
              <span className={styles.hint}>Unique within the company.</span>
            )}
          </div>

          <div className={styles.fieldWide}>
            <label className={`${styles.label} ${styles.req}`} htmlFor="itemName">
              Item name
            </label>
            <input
              id="itemName"
              name="itemName"
              className={fe.itemName ? styles.inputInvalid : styles.input}
              defaultValue={v("itemName", item?.ITEM_NAME)}
              maxLength={200}
              required
            />
            {fe.itemName && <span className={styles.fieldError}>{fe.itemName}</span>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="barcode">
              Barcode
            </label>
            <input
              id="barcode"
              name="barcode"
              className={`${styles.input} ${styles.mono}`}
              defaultValue={v("barcode", item?.BARCODE)}
              maxLength={50}
            />
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Classification</h2>
        <div className={styles.section}>
          <div className={styles.field}>
            <label className={`${styles.label} ${styles.req}`} htmlFor="uomCode">
              Unit of measure
            </label>
            <select
              id="uomCode"
              name="uomCode"
              className={styles.select}
              defaultValue={v("uomCode", item?.UOM_CODE)}
              required
            >
              <option value="" disabled>
                — Choose —
              </option>
              {uoms.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
            {fe.uomCode && <span className={styles.fieldError}>{fe.uomCode}</span>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="categoryId">
              Category
            </label>
            <select
              id="categoryId"
              name="categoryId"
              className={styles.select}
              defaultValue={v("categoryId", item?.CATEGORY_ID)}
            >
              <option value="">— None —</option>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="brandId">
              Brand
            </label>
            <select
              id="brandId"
              name="brandId"
              className={styles.select}
              defaultValue={v("brandId", item?.BRAND_ID)}
            >
              <option value="">— None —</option>
              {brands.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="taxId">
              Tax
            </label>
            <select
              id="taxId"
              name="taxId"
              className={styles.select}
              defaultValue={v("taxId", item?.TAX_ID)}
            >
              <option value="">— None —</option>
              {taxes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="reorderLevel">
              Reorder level
            </label>
            <input
              id="reorderLevel"
              name="reorderLevel"
              type="number"
              step="0.0001"
              min="0"
              className={`${fe.reorderLevel ? styles.inputInvalid : styles.input} ${styles.mono}`}
              defaultValue={v("reorderLevel", item?.REORDER_LEVEL ?? 0)}
            />
            {fe.reorderLevel && <span className={styles.fieldError}>{fe.reorderLevel}</span>}
          </div>

          <div className={styles.fieldWide}>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                name="activeYn"
                defaultChecked={checked("activeYn", (item?.ACTIVE_YN ?? "Y") === "Y")}
              />
              Active
            </label>
            <span className={styles.hint}>
              Inactive items keep their history and stop appearing in
              selection lists.
            </span>
          </div>
        </div>
      </div>

      {!item && (
        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>Opening price</h2>
          <p className={styles.hint} style={{ marginBottom: 12 }}>
            Every item needs a starting sale price. Price history is never
            overwritten — to change it later, add a new price effective from a
            later date on the item&apos;s own page.
          </p>
          <div className={styles.section}>
            <div className={styles.field}>
              <label className={`${styles.label} ${styles.req}`} htmlFor="salePrice">
                Sale price
              </label>
              <input
                id="salePrice"
                name="salePrice"
                type="number"
                step="0.0001"
                min="0"
                className={`${fe.salePrice ? styles.inputInvalid : styles.input} ${styles.mono}`}
                defaultValue={v("salePrice", "")}
                required
              />
              {fe.salePrice ? (
                <span className={styles.fieldError}>{fe.salePrice}</span>
              ) : (
                <span className={styles.hint}>Tax-exclusive.</span>
              )}
            </div>

            <div className={styles.field}>
              <label className={`${styles.label} ${styles.req}`} htmlFor="effectiveFrom">
                Effective from
              </label>
              <input
                id="effectiveFrom"
                name="effectiveFrom"
                type="date"
                className={fe.effectiveFrom ? styles.inputInvalid : styles.input}
                defaultValue={v("effectiveFrom", today)}
                required
              />
              {fe.effectiveFrom && (
                <span className={styles.fieldError}>{fe.effectiveFrom}</span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={styles.actions}>
        <Link href="/admin/items" className={styles.btn}>
          Cancel
        </Link>
        <div className={styles.grow} />
        <button type="submit" className={styles.btnPrimary} disabled={pending}>
          {pending ? "Saving…" : item ? "Save changes" : "Create item"}
        </button>
      </div>
    </form>
  );
}
