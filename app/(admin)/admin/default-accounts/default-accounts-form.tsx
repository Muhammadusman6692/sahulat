"use client";

import { useActionState } from "react";
import { saveDefaultAccountsAction, type FormState } from "./actions";
import styles from "@/components/form/form.module.css";

export type RoleField = {
  code: string;
  name: string;
  description: string | null;
  currentCoaId: number | null;
};

export type AccountOption = {
  coaId: number;
  code: string;
  name: string;
  nature: string;
};

/** Roles that point at a level 1-3 grouping account (the parent Party Master
 *  files auto-created customer/supplier ledger accounts under), not a
 *  postable level-4 account like every other role here. */
const PARENT_ROLES = new Set(["AR_CONTROL", "AP_CONTROL"]);

export default function DefaultAccountsForm({
  companyId,
  roles,
  accounts,
  parentAccounts,
}: {
  companyId: number;
  roles: RoleField[];
  accounts: AccountOption[];
  parentAccounts: AccountOption[];
}) {
  const action = saveDefaultAccountsAction.bind(null, companyId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});

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
      {state.saved && !state.error && (
        <p
          style={{
            background: "var(--primary-tint)",
            color: "var(--primary-ink)",
            border: "1px solid #a8c7bf",
            borderRadius: "var(--radius)",
            padding: "9px 12px",
            fontSize: 12,
          }}
        >
          Saved.
        </p>
      )}

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Default GL accounts</h2>
        <p className={styles.hint} style={{ marginBottom: 14 }}>
          Every account offered here is a posting account (level 4) — the
          same rule the database enforces on every voucher line. A role left
          unset here will refuse to post until it is configured.
        </p>

        <div className={styles.section}>
          {roles.map((r) => {
            const isParentRole = PARENT_ROLES.has(r.code);
            const options = isParentRole ? parentAccounts : accounts;
            return (
              <div className={styles.fieldWide} key={r.code}>
                <label className={styles.label} htmlFor={`role_${r.code}`}>
                  {r.name}
                </label>
                <select
                  id={`role_${r.code}`}
                  name={`role_${r.code}`}
                  className={styles.select}
                  defaultValue={r.currentCoaId ?? ""}
                >
                  <option value="">— Not set —</option>
                  {options.map((a) => (
                    <option key={a.coaId} value={a.coaId}>
                      {isParentRole ? `${a.code} — ${a.name}` : `${a.code} — ${a.name} (${a.nature})`}
                    </option>
                  ))}
                </select>
                {r.description && <span className={styles.hint}>{r.description}</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.actions}>
        <div className={styles.grow} />
        <button type="submit" className={styles.btnPrimary} disabled={pending}>
          {pending ? "Saving…" : "Save defaults"}
        </button>
      </div>
    </form>
  );
}
