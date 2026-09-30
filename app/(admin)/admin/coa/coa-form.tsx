"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { createCoaAccountAction, updateCoaAccountAction, type FormState } from "./actions";
import { CONVENTIONAL_SIDE, type AccountNature } from "@/lib/coa-types";
import type { CoaRow } from "@/lib/db/coa";
import styles from "@/components/form/form.module.css";

export type ParentOption = {
  id: number;
  code: string;
  name: string;
  level: number;
};

const NATURES: AccountNature[] = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];

export default function CoaForm({
  account,
  companyId,
  companyLabel,
  parentOptions,
}: {
  /** null for create. */
  account: CoaRow | null;
  /** Only meaningful for create — edit's company is fixed and not resubmitted. */
  companyId?: number;
  companyLabel: string;
  /** Only passed for create — edit locks the parent entirely. */
  parentOptions?: ParentOption[];
}) {
  const action = account
    ? updateCoaAccountAction.bind(null, account.COA_ID)
    : createCoaAccountAction;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};

  const v = (name: string, stored: string | null | undefined) =>
    state.values?.[name] ?? stored ?? "";

  const [parentId, setParentId] = useState<string>(v("parentId", ""));
  const [nature, setNature] = useState<AccountNature>(
    (v("accountNature", account?.ACCOUNT_NATURE) as AccountNature) || "ASSET",
  );
  const [sideTouched, setSideTouched] = useState(Boolean(state.values?.normalSide));
  const [side, setSide] = useState(
    v("normalSide", account?.NORMAL_SIDE) || CONVENTIONAL_SIDE.ASSET,
  );

  const selectedParent = parentOptions?.find((p) => String(p.id) === parentId);
  const impliedLevel = account ? account.ACCOUNT_LEVEL : selectedParent ? selectedParent.level + 1 : 1;

  function onNatureChange(next: AccountNature) {
    setNature(next);
    if (!sideTouched) setSide(CONVENTIONAL_SIDE[next]);
  }

  const checked = (name: string, fallback: boolean) =>
    state.values ? state.values[name] === "on" : fallback;

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

          <div className={styles.field}>
            <span className={styles.label}>Level</span>
            <input
              className={`${styles.input} ${styles.mono}`}
              value={`${impliedLevel} — ${["", "Group", "Control", "Sub-Control", "Posting"][impliedLevel]}`}
              disabled
              readOnly
            />
            <span className={styles.hint}>
              {account
                ? "Fixed once created — moving an account after it has postings would rewrite what those postings roll up into."
                : "Always the parent's level plus one; chosen for you."}
            </span>
          </div>

          {account ? (
            <div className={styles.field}>
              <span className={styles.label}>Parent</span>
              <input className={`${styles.input} ${styles.mono}`} value="Fixed" disabled readOnly />
            </div>
          ) : (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="parentId">
                Parent account
              </label>
              <select
                id="parentId"
                name="parentId"
                className={styles.select}
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
              >
                <option value="">— None (top-level Group) —</option>
                {parentOptions?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name} (L{p.level})
                  </option>
                ))}
              </select>
              <span className={styles.hint}>
                Only Group, Control and Sub-Control accounts can be a parent — a
                posting account is always a leaf.
              </span>
            </div>
          )}

          <div className={styles.field}>
            <label className={`${styles.label} ${styles.req}`} htmlFor="accountCode">
              Account code
            </label>
            <input
              id="accountCode"
              name="accountCode"
              className={`${fe.accountCode ? styles.inputInvalid : styles.input} ${styles.mono}`}
              defaultValue={v("accountCode", account?.ACCOUNT_CODE)}
              maxLength={20}
              required
            />
            {fe.accountCode ? (
              <span className={styles.fieldError}>{fe.accountCode}</span>
            ) : (
              <span className={styles.hint}>Unique within the company, e.g. 1-02-003-0001.</span>
            )}
          </div>

          <div className={styles.fieldWide}>
            <label className={`${styles.label} ${styles.req}`} htmlFor="accountName">
              Account name
            </label>
            <input
              id="accountName"
              name="accountName"
              className={fe.accountName ? styles.inputInvalid : styles.input}
              defaultValue={v("accountName", account?.ACCOUNT_NAME)}
              maxLength={200}
              required
            />
            {fe.accountName && <span className={styles.fieldError}>{fe.accountName}</span>}
          </div>
        </div>
      </div>

      {!account && companyId && (
        <input type="hidden" name="companyId" value={companyId} />
      )}

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Classification</h2>
        <div className={styles.section}>
          <div className={styles.field}>
            <label className={`${styles.label} ${styles.req}`} htmlFor="accountNature">
              Nature
            </label>
            <select
              id="accountNature"
              name="accountNature"
              className={styles.select}
              value={nature}
              onChange={(e) => onNatureChange(e.target.value as AccountNature)}
            >
              {NATURES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={`${styles.label} ${styles.req}`} htmlFor="normalSide">
              Normal side
            </label>
            <select
              id="normalSide"
              name="normalSide"
              className={styles.select}
              value={side}
              onChange={(e) => {
                setSideTouched(true);
                setSide(e.target.value);
              }}
            >
              <option value="D">Debit</option>
              <option value="C">Credit</option>
            </select>
            <span className={styles.hint}>
              Suggested from nature; override for a contra account (e.g.
              Accumulated Depreciation is an ASSET with a credit balance).
            </span>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="isControlAc">
              Control account type
            </label>
            <select
              id="isControlAc"
              name="isControlAc"
              className={styles.select}
              defaultValue={v("isControlAc", account?.IS_CONTROL_AC ?? "")}
            >
              <option value="">Ordinary account</option>
              <option value="CUSTOMER">Customer</option>
              <option value="SUPPLIER">Supplier</option>
              <option value="CASH">Cash</option>
              <option value="BANK">Bank</option>
            </select>
            <span className={styles.hint}>
              Only meaningful on a posting account — a party&apos;s receivable
              or payable account points here directly.
            </span>
          </div>

          <div className={styles.field}>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                name="costCenterRequired"
                defaultChecked={checked("costCenterRequired", account?.COST_CENTER_REQUIRED === "Y")}
              />
              Cost centre required on every line
            </label>
          </div>

          <div className={styles.fieldWide}>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                name="activeYn"
                defaultChecked={checked("activeYn", (account?.ACTIVE_YN ?? "Y") === "Y")}
              />
              Active
            </label>
            <span className={styles.hint}>
              Inactive accounts keep their ledger history and stop appearing in
              selection lists.
            </span>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <Link href="/admin/coa" className={styles.btn}>
          Cancel
        </Link>
        <div className={styles.grow} />
        <button type="submit" className={styles.btnPrimary} disabled={pending}>
          {pending ? "Saving…" : account ? "Save changes" : "Create account"}
        </button>
      </div>
    </form>
  );
}
