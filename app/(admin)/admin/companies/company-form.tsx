"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveCompany, type FormState } from "./actions";
import type { CompanyRow } from "@/lib/db/companies";
import styles from "@/components/form/form.module.css";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function CompanyForm({ company }: { company: CompanyRow | null }) {
  const action = saveCompany.bind(null, company?.COMPANY_ID ?? null);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  const fe = state.fieldErrors ?? {};

  // Prefer what the user last typed over the stored record, so a rejected save
  // does not discard their edits.
  const v = (name: string, stored: string | number | null | undefined) =>
    state.values?.[name] ?? (stored === null || stored === undefined ? "" : String(stored));
  const checked = state.values
    ? state.values.activeYn === "on"
    : (company?.ACTIVE_YN ?? "Y") === "Y";

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
            <label className={`${styles.label} ${styles.req}`} htmlFor="companyCode">
              Company code
            </label>
            <input
              id="companyCode"
              name="companyCode"
              className={`${fe.companyCode ? styles.inputInvalid : styles.input} ${styles.mono}`}
              defaultValue={v("companyCode", company?.COMPANY_CODE)}
              maxLength={10}
              required
            />
            {fe.companyCode ? (
              <span className={styles.fieldError}>{fe.companyCode}</span>
            ) : (
              <span className={styles.hint}>
                Short, permanent identifier. Used on documents and cannot clash
                with another company.
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label className={`${styles.label} ${styles.req}`} htmlFor="companyName">
              Company name
            </label>
            <input
              id="companyName"
              name="companyName"
              className={fe.companyName ? styles.inputInvalid : styles.input}
              defaultValue={v("companyName", company?.COMPANY_NAME)}
              maxLength={200}
              required
            />
            {fe.companyName && (
              <span className={styles.fieldError}>{fe.companyName}</span>
            )}
          </div>

          <div className={styles.fieldWide}>
            <label className={styles.label} htmlFor="address">
              Address
            </label>
            <textarea
              id="address"
              name="address"
              className={styles.textarea}
              defaultValue={v("address", company?.ADDRESS)}
              maxLength={400}
            />
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Tax registration</h2>
        <div className={styles.section}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="ntnNo">
              NTN
            </label>
            <input
              id="ntnNo"
              name="ntnNo"
              className={`${styles.input} ${styles.mono}`}
              defaultValue={v("ntnNo", company?.NTN_NO)}
              maxLength={30}
            />
            <span className={styles.hint}>National Tax Number issued by FBR.</span>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="strnNo">
              STRN
            </label>
            <input
              id="strnNo"
              name="strnNo"
              className={`${styles.input} ${styles.mono}`}
              defaultValue={v("strnNo", company?.STRN_NO)}
              maxLength={30}
            />
            <span className={styles.hint}>
              Sales Tax Registration Number. A branch may carry its own for
              provincial tax.
            </span>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Accounting</h2>
        <div className={styles.section}>
          <div className={styles.field}>
            <label className={`${styles.label} ${styles.req}`} htmlFor="fyStartMonth">
              Fiscal year starts
            </label>
            <select
              id="fyStartMonth"
              name="fyStartMonth"
              className={styles.select}
              defaultValue={v("fyStartMonth", company?.FY_START_MONTH ?? 7)}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <span className={styles.hint}>
              Drives fiscal year and period generation. Changing it later does
              not move periods that already exist.
            </span>
          </div>

          <div className={styles.field}>
            <label className={`${styles.label} ${styles.req}`} htmlFor="baseCurrency">
              Base currency
            </label>
            <input
              id="baseCurrency"
              name="baseCurrency"
              className={`${fe.baseCurrency ? styles.inputInvalid : styles.input} ${styles.mono}`}
              defaultValue={v("baseCurrency", company?.BASE_CURRENCY ?? "PKR")}
              maxLength={3}
              required
            />
            {fe.baseCurrency && (
              <span className={styles.fieldError}>{fe.baseCurrency}</span>
            )}
          </div>

          <div className={styles.fieldWide}>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                name="activeYn"
                defaultChecked={checked}
              />
              Active
            </label>
            <span className={styles.hint}>
              Inactive companies stay in the database and keep their history;
              they are just hidden from selection.
            </span>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <Link href="/admin/companies" className={styles.btn}>
          Cancel
        </Link>
        <div className={styles.grow} />
        <button type="submit" className={styles.btnPrimary} disabled={pending}>
          {pending ? "Saving…" : company ? "Save changes" : "Create company"}
        </button>
      </div>
    </form>
  );
}
