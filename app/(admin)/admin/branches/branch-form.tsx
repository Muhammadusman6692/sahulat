"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveBranch, type FormState } from "./actions";
import type { BranchRow } from "@/lib/db/branches";
import { LockedField } from "@/components/form/locked-field";
import styles from "@/components/form/form.module.css";

type CompanyOption = { id: number; code: string; name: string };

export default function BranchForm({
  branch,
  companies,
}: {
  branch: BranchRow | null;
  companies: CompanyOption[];
}) {
  const action = saveBranch.bind(null, branch?.BRANCH_ID ?? null);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};

  const v = (name: string, stored: string | number | null | undefined) =>
    state.values?.[name] ?? (stored === null || stored === undefined ? "" : String(stored));
  const checked = state.values
    ? state.values.activeYn === "on"
    : (branch?.ACTIVE_YN ?? "Y") === "Y";

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
            {branch ? (
              <>
                <LockedField value={`${branch.COMPANY_CODE} — ${branch.COMPANY_NAME}`} mono />
                <input type="hidden" name="companyId" value={branch.COMPANY_ID} />
                <span className={styles.hint}>
                  A branch cannot be moved between companies — its warehouses,
                  stock and posted documents belong to this company's books.
                </span>
              </>
            ) : (
              <>
                <select
                  id="companyId"
                  name="companyId"
                  className={styles.select}
                  defaultValue={v("companyId", companies[0]?.id)}
                  required
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
                {fe.companyId && <span className={styles.fieldError}>{fe.companyId}</span>}
              </>
            )}
          </div>

          <div className={styles.field}>
            <label className={`${styles.label} ${styles.req}`} htmlFor="branchCode">
              Branch code
            </label>
            <input
              id="branchCode"
              name="branchCode"
              className={`${fe.branchCode ? styles.inputInvalid : styles.input} ${styles.mono}`}
              defaultValue={v("branchCode", branch?.BRANCH_CODE)}
              maxLength={10}
              required
            />
            {fe.branchCode ? (
              <span className={styles.fieldError}>{fe.branchCode}</span>
            ) : (
              <span className={styles.hint}>
                Unique within the company. Another company may reuse the same code.
              </span>
            )}
          </div>

          <div className={styles.fieldWide}>
            <label className={`${styles.label} ${styles.req}`} htmlFor="branchName">
              Branch name
            </label>
            <input
              id="branchName"
              name="branchName"
              className={fe.branchName ? styles.inputInvalid : styles.input}
              defaultValue={v("branchName", branch?.BRANCH_NAME)}
              maxLength={200}
              required
            />
            {fe.branchName && <span className={styles.fieldError}>{fe.branchName}</span>}
          </div>

          <div className={styles.fieldWide}>
            <label className={styles.label} htmlFor="address">
              Address
            </label>
            <textarea
              id="address"
              name="address"
              className={styles.textarea}
              defaultValue={v("address", branch?.ADDRESS)}
              maxLength={400}
            />
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Tax registration</h2>
        <div className={styles.section}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="strnNo">
              Branch STRN
            </label>
            <input
              id="strnNo"
              name="strnNo"
              className={`${styles.input} ${styles.mono}`}
              defaultValue={v("strnNo", branch?.STRN_NO)}
              maxLength={30}
            />
            <span className={styles.hint}>
              Leave empty to use the company's STRN. Set it only where a branch
              registers separately for provincial sales tax.
            </span>
          </div>

          <div className={styles.field}>
            <label className={styles.checkRow}>
              <input type="checkbox" name="activeYn" defaultChecked={checked} />
              Active
            </label>
            <span className={styles.hint}>
              Inactive branches keep their history and stop appearing in
              selection lists.
            </span>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <Link href="/admin/branches" className={styles.btn}>
          Cancel
        </Link>
        <div className={styles.grow} />
        <button type="submit" className={styles.btnPrimary} disabled={pending}>
          {pending ? "Saving…" : branch ? "Save changes" : "Create branch"}
        </button>
      </div>
    </form>
  );
}
