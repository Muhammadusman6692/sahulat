"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createTaxCodeAction, updateTaxCodeAction, type FormState } from "./actions";
import type { TaxCodeRow } from "@/lib/db/tax";
import styles from "@/components/form/form.module.css";

export type Option = { value: string; label: string };

const TAX_TYPES: Option[] = [
  { value: "SALES_TAX", label: "Sales Tax" },
  { value: "WITHHOLDING", label: "Withholding" },
  { value: "FURTHER_TAX", label: "Further Tax" },
  { value: "EXTRA_TAX", label: "Extra Tax" },
];

export default function TaxCodeForm({
  taxCode,
  companyId,
  companyLabel,
  authorities,
  accounts,
}: {
  /** null for create. */
  taxCode: TaxCodeRow | null;
  /** Only meaningful for create — edit's company is fixed and not resubmitted. */
  companyId?: number;
  companyLabel: string;
  authorities: Option[];
  accounts: Option[];
}) {
  const action = taxCode
    ? updateTaxCodeAction.bind(null, taxCode.TAX_ID)
    : createTaxCodeAction.bind(null, companyId!);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};

  const v = (name: string, stored: string | number | null | undefined) =>
    state.values?.[name] ?? (stored === null || stored === undefined ? "" : String(stored));
  const checked = (name: string, fallback: boolean) =>
    state.values ? state.values[name] === "on" : fallback;

  const [code, setCode] = useState(v("taxCode", taxCode?.TAX_CODE));

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

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Identity</h2>
        <div className={styles.section}>
          <div className={styles.field}>
            <span className={styles.label}>Company</span>
            <input className={styles.input} value={companyLabel} disabled readOnly />
          </div>

          {taxCode ? (
            <div className={styles.field}>
              <span className={styles.label}>Tax code</span>
              <input
                className={`${styles.input} ${styles.mono}`}
                value={taxCode.TAX_CODE}
                disabled
                readOnly
              />
            </div>
          ) : (
            <div className={styles.field}>
              <label className={`${styles.label} ${styles.req}`} htmlFor="taxCode">
                Tax code
              </label>
              <input
                id="taxCode"
                name="taxCode"
                className={`${fe.taxCode ? styles.inputInvalid : styles.input} ${styles.mono}`}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={20}
                required
              />
              {fe.taxCode ? (
                <span className={styles.fieldError}>{fe.taxCode}</span>
              ) : (
                <span className={styles.hint}>E.g. GST-18, EXEMPT, WHT-153. Fixed once created.</span>
              )}
            </div>
          )}

          <div className={styles.field}>
            <label className={`${styles.label} ${styles.req}`} htmlFor="taxName">
              Tax name
            </label>
            <input
              id="taxName"
              name="taxName"
              className={fe.taxName ? styles.inputInvalid : styles.input}
              defaultValue={v("taxName", taxCode?.TAX_NAME)}
              maxLength={100}
              required
            />
            {fe.taxName && <span className={styles.fieldError}>{fe.taxName}</span>}
          </div>

          <div className={styles.field}>
            <label className={`${styles.label} ${styles.req}`} htmlFor="authorityCode">
              Authority
            </label>
            <select
              id="authorityCode"
              name="authorityCode"
              className={fe.authorityCode ? styles.inputInvalid : styles.select}
              defaultValue={v("authorityCode", taxCode?.AUTHORITY_CODE)}
              required
            >
              <option value="">— Choose —</option>
              {authorities.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
            {fe.authorityCode && <span className={styles.fieldError}>{fe.authorityCode}</span>}
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Rate &amp; posting</h2>
        <div className={styles.section}>
          <div className={styles.field}>
            <label className={`${styles.label} ${styles.req}`} htmlFor="taxRate">
              Rate (%)
            </label>
            <input
              id="taxRate"
              name="taxRate"
              type="number"
              min="0"
              max="100"
              step="0.001"
              className={`${fe.taxRate ? styles.inputInvalid : styles.input} ${styles.mono}`}
              defaultValue={v("taxRate", taxCode?.TAX_RATE ?? 0)}
              required
            />
            {fe.taxRate && <span className={styles.fieldError}>{fe.taxRate}</span>}
          </div>

          <div className={styles.field}>
            <label className={`${styles.label} ${styles.req}`} htmlFor="taxType">
              Type
            </label>
            <select
              id="taxType"
              name="taxType"
              className={fe.taxType ? styles.inputInvalid : styles.select}
              defaultValue={v("taxType", taxCode?.TAX_TYPE ?? "SALES_TAX")}
              required
            >
              {TAX_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {fe.taxType && <span className={styles.fieldError}>{fe.taxType}</span>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="taxCoaId">
              GL account
            </label>
            <select
              id="taxCoaId"
              name="taxCoaId"
              className={styles.select}
              defaultValue={v("taxCoaId", taxCode?.TAX_COA_ID)}
            >
              <option value="">— Not set —</option>
              {accounts.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
            <span className={styles.hint}>
              Only needed once this tax code is wired into a posting rule.
            </span>
          </div>

          <div className={styles.fieldWide}>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                name="activeYn"
                defaultChecked={checked("activeYn", (taxCode?.ACTIVE_YN ?? "Y") === "Y")}
              />
              Active
            </label>
            <span className={styles.hint}>
              Inactive tax codes stop appearing in item and document pickers.
            </span>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <Link href="/admin/tax" className={styles.btn}>
          Cancel
        </Link>
        <div className={styles.grow} />
        <button type="submit" className={styles.btnPrimary} disabled={pending}>
          {pending ? "Saving…" : taxCode ? "Save changes" : "Create tax code"}
        </button>
      </div>
    </form>
  );
}
