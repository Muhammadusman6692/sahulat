"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createApprovalRuleAction, updateApprovalRuleAction, type FormState } from "./actions";
import type { ApprovalRuleRow, ApprovableModule, ApproverRole } from "@/lib/db/approvals";
import { LockedField } from "@/components/form/locked-field";
import styles from "@/components/form/form.module.css";

export default function ApprovalRuleForm({
  rule,
  companyId,
  companyLabel,
  modules,
  roles,
}: {
  /** null for create. */
  rule: ApprovalRuleRow | null;
  /** Only meaningful for create — edit's company is fixed and not resubmitted. */
  companyId?: number;
  companyLabel: string;
  modules: ApprovableModule[];
  roles: ApproverRole[];
}) {
  const action = rule
    ? updateApprovalRuleAction.bind(null, rule.RULE_ID)
    : createApprovalRuleAction;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};

  const v = (name: string, stored: string | number | null | undefined) =>
    state.values?.[name] ?? (stored === null || stored === undefined ? "" : String(stored));

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

      {!rule && companyId && <input type="hidden" name="companyId" value={companyId} />}

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Identity</h2>
        <div className={styles.section}>
          <div className={styles.field}>
            <span className={styles.label}>Company</span>
            <LockedField value={companyLabel} />
          </div>

          {rule ? (
            <>
              <div className={styles.field}>
                <span className={styles.label}>Document</span>
                <LockedField value={rule.MODULE_NAME} />
              </div>
              <div className={styles.field}>
                <span className={styles.label}>Step</span>
                <LockedField value={rule.STEP_NO} mono />
              </div>
              <p className={styles.hint} style={{ gridColumn: "span 2" }}>
                Fixed once created — a document already evaluated under this
                identity must keep resolving to it.
              </p>
            </>
          ) : (
            <>
              <div className={styles.field}>
                <label className={`${styles.label} ${styles.req}`} htmlFor="moduleCode">
                  Document
                </label>
                <select
                  id="moduleCode"
                  name="moduleCode"
                  className={styles.select}
                  defaultValue={v("moduleCode", "")}
                  required
                >
                  <option value="" disabled>
                    — Choose a document —
                  </option>
                  {modules.map((m) => (
                    <option key={m.MODULE_CODE} value={m.MODULE_CODE}>
                      {m.MODULE_NAME}
                    </option>
                  ))}
                </select>
                {fe.moduleCode && <span className={styles.fieldError}>{fe.moduleCode}</span>}
              </div>

              <div className={styles.field}>
                <label className={`${styles.label} ${styles.req}`} htmlFor="stepNo">
                  Step number
                </label>
                <input
                  id="stepNo"
                  name="stepNo"
                  type="number"
                  min="1"
                  step="1"
                  className={`${fe.stepNo ? styles.inputInvalid : styles.input} ${styles.mono}`}
                  defaultValue={v("stepNo", 1)}
                  required
                />
                {fe.stepNo ? (
                  <span className={styles.fieldError}>{fe.stepNo}</span>
                ) : (
                  <span className={styles.hint}>
                    Lower steps are checked first for the same document.
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Settings</h2>
        <div className={styles.section}>
          <div className={styles.field}>
            <label className={`${styles.label} ${styles.req}`} htmlFor="approverRoleId">
              Approver role
            </label>
            <select
              id="approverRoleId"
              name="approverRoleId"
              className={styles.select}
              defaultValue={v("approverRoleId", rule?.APPROVER_ROLE_ID ?? "")}
              required
            >
              <option value="" disabled>
                — Choose a role —
              </option>
              {roles.map((r) => (
                <option key={r.ROLE_ID} value={r.ROLE_ID}>
                  {r.ROLE_NAME}
                </option>
              ))}
            </select>
            {fe.approverRoleId && <span className={styles.fieldError}>{fe.approverRoleId}</span>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="minAmount">
              Min amount
            </label>
            <input
              id="minAmount"
              name="minAmount"
              type="number"
              min="0"
              step="0.01"
              className={`${fe.minAmount ? styles.inputInvalid : styles.input} ${styles.mono}`}
              defaultValue={v("minAmount", rule?.MIN_AMOUNT ?? 0)}
            />
            {fe.minAmount ? (
              <span className={styles.fieldError}>{fe.minAmount}</span>
            ) : (
              <span className={styles.hint}>0 = this step is always required.</span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <Link href="/admin/approvals" className={styles.btn}>
          Cancel
        </Link>
        <div className={styles.grow} />
        <button type="submit" className={styles.btnPrimary} disabled={pending}>
          {pending ? "Saving…" : rule ? "Save changes" : "Create rule"}
        </button>
      </div>
    </form>
  );
}
