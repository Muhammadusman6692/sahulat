"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { createFiscalYearAction, type NewFormState } from "./actions";
import { fiscalYearEnd, suggestFyName } from "@/lib/fiscal-calendar";
import styles from "@/components/form/form.module.css";

export type CompanyOption = {
  id: number;
  code: string;
  name: string;
  fyStartMonth: number;
};

export default function NewFiscalYearForm({
  companies,
  suggestedStarts,
}: {
  companies: CompanyOption[];
  /** company id -> ISO start date (YYYY-MM-DD), computed on the server so the
   *  "day after the last fiscal year" logic doesn't have to be duplicated on
   *  the client. */
  suggestedStarts: Record<number, string>;
}) {
  const [state, formAction, pending] = useActionState<NewFormState, FormData>(
    createFiscalYearAction,
    {},
  );
  const fe = state.fieldErrors ?? {};

  const v = (name: string, fallback: string) => state.values?.[name] ?? fallback;

  const [companyId, setCompanyId] = useState<number>(companies[0]?.id ?? 0);
  const [startDate, setStartDate] = useState<string>(
    v("startDate", suggestedStarts[companies[0]?.id ?? 0] ?? ""),
  );
  const [fyNameTouched, setFyNameTouched] = useState(Boolean(state.values?.fyName));
  const [fyName, setFyName] = useState<string>(
    v("fyName", startDate ? suggestFyName(new Date(startDate)) : ""),
  );

  const endDate = useMemo(() => {
    if (!startDate) return null;
    return fiscalYearEnd(new Date(startDate));
  }, [startDate]);

  function onCompanyChange(id: number) {
    setCompanyId(id);
    const next = suggestedStarts[id] ?? "";
    setStartDate(next);
    if (!fyNameTouched && next) setFyName(suggestFyName(new Date(next)));
  }

  function onStartDateChange(value: string) {
    setStartDate(value);
    if (!fyNameTouched && value) setFyName(suggestFyName(new Date(value)));
  }

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
            <label className={`${styles.label} ${styles.req}`} htmlFor="companyId">
              Company
            </label>
            <select
              id="companyId"
              name="companyId"
              className={styles.select}
              value={companyId || ""}
              onChange={(e) => onCompanyChange(Number(e.target.value))}
              required
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
            {fe.companyId && <span className={styles.fieldError}>{fe.companyId}</span>}
          </div>

          <div className={styles.field}>
            <label className={`${styles.label} ${styles.req}`} htmlFor="fyName">
              Fiscal year name
            </label>
            <input
              id="fyName"
              name="fyName"
              className={`${fe.fyName ? styles.inputInvalid : styles.input} ${styles.mono}`}
              value={fyName}
              onChange={(e) => {
                setFyNameTouched(true);
                setFyName(e.target.value);
              }}
              maxLength={20}
              required
            />
            {fe.fyName ? (
              <span className={styles.fieldError}>{fe.fyName}</span>
            ) : (
              <span className={styles.hint}>Suggested from the start date; editable.</span>
            )}
          </div>

          <div className={styles.field}>
            <label className={`${styles.label} ${styles.req}`} htmlFor="startDate">
              Start date
            </label>
            <input
              id="startDate"
              name="startDate"
              type="date"
              className={fe.startDate ? styles.inputInvalid : styles.input}
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              required
            />
            {fe.startDate ? (
              <span className={styles.fieldError}>{fe.startDate}</span>
            ) : (
              <span className={styles.hint}>
                Defaults to the day after this company&apos;s last fiscal year ends.
              </span>
            )}
          </div>

          <div className={styles.field}>
            <span className={styles.label}>End date</span>
            <input
              className={`${styles.input} ${styles.mono}`}
              value={
                endDate
                  ? endDate.toISOString().slice(0, 10)
                  : ""
              }
              disabled
              readOnly
            />
            <span className={styles.hint}>
              Always exactly one year after the start, so twelve regular
              monthly periods fit inside it.
            </span>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <Link href="/admin/fiscal-years" className={styles.btn}>
          Cancel
        </Link>
        <div className={styles.grow} />
        <button type="submit" className={styles.btnPrimary} disabled={pending}>
          {pending ? "Creating…" : "Create fiscal year and 12 periods"}
        </button>
      </div>
    </form>
  );
}
