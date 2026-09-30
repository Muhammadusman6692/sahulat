"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { createSeriesAction, updateSeriesAction, type FormState } from "./actions";
import type { SeriesRow } from "@/lib/db/numbering";
import styles from "@/components/form/form.module.css";

export type Option = { value: string; label: string };

export default function SeriesForm({
  series,
  companyId,
  companyLabel,
  branches,
  fiscalYears,
}: {
  /** null for create. */
  series: SeriesRow | null;
  /** Only meaningful for create — edit's company is fixed and not resubmitted. */
  companyId?: number;
  companyLabel: string;
  branches: Option[];
  fiscalYears: Option[];
}) {
  const action = series
    ? updateSeriesAction.bind(null, series.SERIES_ID)
    : createSeriesAction;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};

  const v = (name: string, stored: string | number | null | undefined) =>
    state.values?.[name] ?? (stored === null || stored === undefined ? "" : String(stored));
  const checked = (name: string, fallback: boolean) =>
    state.values ? state.values[name] === "on" : fallback;

  const [docType, setDocType] = useState(v("docType", series?.DOC_TYPE));
  const [prefix, setPrefix] = useState(v("prefix", series?.PREFIX));
  const [nextNumber, setNextNumber] = useState(v("nextNumber", series?.NEXT_NUMBER ?? 1));
  const [padLength, setPadLength] = useState(v("padLength", series?.PAD_LENGTH ?? 6));

  const preview = useMemo(() => {
    const n = Math.max(0, Math.trunc(Number(nextNumber) || 0));
    const pad = Math.max(1, Math.min(15, Math.trunc(Number(padLength) || 1)));
    return `${prefix ?? ""}${String(n).padStart(pad, "0")}`;
  }, [prefix, nextNumber, padLength]);

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

      {!series && companyId && <input type="hidden" name="companyId" value={companyId} />}

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Identity</h2>
        <div className={styles.section}>
          <div className={styles.field}>
            <span className={styles.label}>Company</span>
            <input className={styles.input} value={companyLabel} disabled readOnly />
          </div>

          {series ? (
            <>
              <div className={styles.field}>
                <span className={styles.label}>Branch</span>
                <input
                  className={styles.input}
                  value={series.BRANCH_CODE ?? "Company-wide"}
                  disabled
                  readOnly
                />
              </div>
              <div className={styles.field}>
                <span className={styles.label}>Terminal</span>
                <input
                  className={`${styles.input} ${styles.mono}`}
                  value={series.TERMINAL_ID ?? "— Not terminal-specific —"}
                  disabled
                  readOnly
                />
              </div>
              <div className={styles.field}>
                <span className={styles.label}>Document type</span>
                <input
                  className={`${styles.input} ${styles.mono}`}
                  value={series.DOC_TYPE}
                  disabled
                  readOnly
                />
              </div>
              <p className={styles.hint} style={{ gridColumn: "span 2" }}>
                Fixed once created — a document already numbered under this
                identity must keep resolving to it.
              </p>
            </>
          ) : (
            <>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="branchId">
                  Branch
                </label>
                <select
                  id="branchId"
                  name="branchId"
                  className={styles.select}
                  defaultValue={v("branchId", "")}
                >
                  <option value="">— Company-wide —</option>
                  {branches.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="terminalId">
                  Terminal ID
                </label>
                <input
                  id="terminalId"
                  name="terminalId"
                  type="number"
                  min="1"
                  step="1"
                  className={`${styles.input} ${styles.mono}`}
                  defaultValue={v("terminalId", "")}
                />
                <span className={styles.hint}>
                  Leave empty unless this series is specific to one POS
                  terminal. Becomes a picker once Terminal Setup exists.
                </span>
              </div>

              <div className={styles.field}>
                <label className={`${styles.label} ${styles.req}`} htmlFor="docType">
                  Document type
                </label>
                <input
                  id="docType"
                  name="docType"
                  className={`${fe.docType ? styles.inputInvalid : styles.input} ${styles.mono}`}
                  value={docType}
                  onChange={(e) => setDocType(e.target.value.toUpperCase())}
                  maxLength={15}
                  required
                />
                {fe.docType ? (
                  <span className={styles.fieldError}>{fe.docType}</span>
                ) : (
                  <span className={styles.hint}>
                    E.g. SINV, SRET, PINV, GRN, JV, POS_SALE, DIST_ORD.
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Format</h2>
        <div className={styles.section}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="prefix">
              Prefix
            </label>
            <input
              id="prefix"
              name="prefix"
              className={`${styles.input} ${styles.mono}`}
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              maxLength={15}
              placeholder="SINV-"
            />
          </div>

          <div className={styles.field}>
            <label className={`${styles.label} ${styles.req}`} htmlFor="padLength">
              Pad length
            </label>
            <input
              id="padLength"
              name="padLength"
              type="number"
              min="1"
              max="15"
              className={`${fe.padLength ? styles.inputInvalid : styles.input} ${styles.mono}`}
              value={padLength}
              onChange={(e) => setPadLength(e.target.value)}
              required
            />
            {fe.padLength && <span className={styles.fieldError}>{fe.padLength}</span>}
          </div>

          <div className={styles.field}>
            <label className={`${styles.label} ${styles.req}`} htmlFor="nextNumber">
              Next number
            </label>
            <input
              id="nextNumber"
              name="nextNumber"
              type="number"
              min="1"
              className={`${fe.nextNumber ? styles.inputInvalid : styles.input} ${styles.mono}`}
              value={nextNumber}
              onChange={(e) => setNextNumber(e.target.value)}
              required
            />
            {fe.nextNumber ? (
              <span className={styles.fieldError}>{fe.nextNumber}</span>
            ) : series ? (
              <span className={styles.hint}>
                Changing this after real documents exist can create duplicate
                or out-of-order numbers — nothing in the database checks that
                for you here.
              </span>
            ) : (
              <span className={styles.hint}>Usually 1, unless continuing a legacy sequence.</span>
            )}
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Preview</span>
            <input className={`${styles.input} ${styles.mono}`} value={preview} disabled readOnly />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="fyId">
              Fiscal year
            </label>
            <select
              id="fyId"
              name="fyId"
              className={styles.select}
              defaultValue={v("fyId", series?.FY_ID)}
            >
              <option value="">— Not tied to a fiscal year —</option>
              {fiscalYears.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.fieldWide}>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                name="resetYearly"
                defaultChecked={checked("resetYearly", (series?.RESET_YEARLY ?? "Y") === "Y")}
              />
              Reset to 1 each fiscal year
            </label>
            <span className={styles.hint}>
              Recorded here for when yearly rollover is built; the numbering
              package does not yet act on this flag on its own.
            </span>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <Link href="/admin/numbering-series" className={styles.btn}>
          Cancel
        </Link>
        <div className={styles.grow} />
        <button type="submit" className={styles.btnPrimary} disabled={pending}>
          {pending ? "Saving…" : series ? "Save changes" : "Create series"}
        </button>
      </div>
    </form>
  );
}
