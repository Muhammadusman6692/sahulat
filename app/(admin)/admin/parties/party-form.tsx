"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createPartyAction, updatePartyAction, type FormState } from "./actions";
import type { PartyDetail } from "@/lib/db/parties";
import { LockedField } from "@/components/form/locked-field";
import styles from "@/components/form/form.module.css";

export default function PartyForm({
  party,
  companyId,
  companyLabel,
}: {
  /** null for create. */
  party: PartyDetail | null;
  companyId?: number;
  companyLabel: string;
}) {
  const action = party ? updatePartyAction.bind(null, party.PARTY_ID) : createPartyAction;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};

  const v = (name: string, stored: string | number | null | undefined) =>
    state.values?.[name] ?? (stored === null || stored === undefined ? "" : String(stored));
  const checked = (name: string, fallback: boolean) =>
    state.values ? state.values[name] === "on" : fallback;

  const [isCustomer, setIsCustomer] = useState(checked("isCustomer", (party?.IS_CUSTOMER ?? "Y") === "Y"));
  const [isSupplier, setIsSupplier] = useState(checked("isSupplier", party?.IS_SUPPLIER === "Y"));

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

      {!party && companyId && <input type="hidden" name="companyId" value={companyId} />}

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Identity</h2>
        <div className={styles.section}>
          <div className={styles.field}>
            <span className={styles.label}>Company</span>
            <LockedField value={companyLabel} />
          </div>

          <div className={styles.field}>
            <label className={`${styles.label} ${styles.req}`} htmlFor="partyCode">
              Party code
            </label>
            <input
              id="partyCode"
              name="partyCode"
              className={`${fe.partyCode ? styles.inputInvalid : styles.input} ${styles.mono}`}
              defaultValue={v("partyCode", party?.PARTY_CODE)}
              maxLength={20}
              required
            />
            {fe.partyCode ? (
              <span className={styles.fieldError}>{fe.partyCode}</span>
            ) : (
              <span className={styles.hint}>Unique within the company.</span>
            )}
          </div>

          <div className={styles.fieldWide}>
            <label className={`${styles.label} ${styles.req}`} htmlFor="partyName">
              Party name
            </label>
            <input
              id="partyName"
              name="partyName"
              className={fe.partyName ? styles.inputInvalid : styles.input}
              defaultValue={v("partyName", party?.PARTY_NAME)}
              maxLength={200}
              required
            />
            {fe.partyName && <span className={styles.fieldError}>{fe.partyName}</span>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              className={styles.input}
              defaultValue={v("phone", party?.PHONE)}
              maxLength={20}
            />
          </div>

          <div className={styles.fieldWide}>
            <label className={styles.label} htmlFor="address">
              Address
            </label>
            <textarea
              id="address"
              name="address"
              className={styles.textarea}
              defaultValue={v("address", party?.ADDRESS)}
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
              defaultValue={v("ntnNo", party?.NTN_NO)}
              maxLength={30}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="strnNo">
              STRN
            </label>
            <input
              id="strnNo"
              name="strnNo"
              className={`${styles.input} ${styles.mono}`}
              defaultValue={v("strnNo", party?.STRN_NO)}
              maxLength={30}
            />
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Party type</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              name="isCustomer"
              checked={isCustomer}
              onChange={(e) => setIsCustomer(e.target.checked)}
            />
            This party is a Customer
          </label>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              name="isSupplier"
              checked={isSupplier}
              onChange={(e) => setIsSupplier(e.target.checked)}
            />
            This party is a Supplier
          </label>
          <span className={styles.hint} style={!isCustomer && !isSupplier ? { color: "var(--danger)" } : undefined}>
            At least one must be selected — a party can be both.
          </span>
          {fe.isCustomer && <span className={styles.fieldError}>{fe.isCustomer}</span>}
        </div>
      </div>

      {isCustomer && (
        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>Credit terms</h2>
          <div className={styles.section}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="creditLimit">
                Credit limit (PKR)
              </label>
              <input
                id="creditLimit"
                name="creditLimit"
                type="number"
                step="0.01"
                min="0"
                className={`${fe.creditLimit ? styles.inputInvalid : styles.input} ${styles.mono}`}
                defaultValue={v("creditLimit", party?.CREDIT_LIMIT ?? 0)}
              />
              {fe.creditLimit && <span className={styles.fieldError}>{fe.creditLimit}</span>}
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="creditDays">
                Credit days
              </label>
              <input
                id="creditDays"
                name="creditDays"
                type="number"
                step="1"
                min="0"
                className={`${fe.creditDays ? styles.inputInvalid : styles.input} ${styles.mono}`}
                defaultValue={v("creditDays", party?.CREDIT_DAYS ?? 0)}
              />
              {fe.creditDays && <span className={styles.fieldError}>{fe.creditDays}</span>}
            </div>
          </div>
        </div>
      )}

      {(isCustomer || isSupplier) && (
        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>Ledger accounts</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {isCustomer && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "10px 12px",
                  background: "var(--surface-sunken)",
                }}
              >
                <span className={styles.mono} style={{ fontSize: 12.5, fontWeight: 600 }}>
                  {party?.AR_ACCOUNT_CODE ?? "Assigned automatically on save"}
                </span>
                <span
                  style={{
                    background: "#f0eee8",
                    color: "var(--ink-3)",
                    padding: "2px 7px",
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  {party?.AR_ACCOUNT_CODE ? "AUTO-LINKED" : "WILL CREATE"}
                </span>
              </div>
            )}
            {isSupplier && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "10px 12px",
                  background: "var(--surface-sunken)",
                }}
              >
                <span className={styles.mono} style={{ fontSize: 12.5, fontWeight: 600 }}>
                  {party?.AP_ACCOUNT_CODE ?? "Assigned automatically on save"}
                </span>
                <span
                  style={{
                    background: "#f0eee8",
                    color: "var(--ink-3)",
                    padding: "2px 7px",
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  {party?.AP_ACCOUNT_CODE ? "AUTO-LINKED" : "WILL CREATE"}
                </span>
              </div>
            )}
            <span className={styles.hint}>
              Each customer/supplier gets its own ledger account automatically,
              created under Trade Debtors / Trade Creditors the moment this
              party is saved. It is never picked manually, and renaming the
              party renames its account too.
            </span>
          </div>
        </div>
      )}

      <div className={styles.card}>
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            name="activeYn"
            defaultChecked={checked("activeYn", (party?.ACTIVE_YN ?? "Y") === "Y")}
          />
          Active
        </label>
        <span className={styles.hint} style={{ display: "block", marginTop: 6 }}>
          Inactive parties keep their ledger history and stop appearing in
          document entry.
        </span>
      </div>

      <div className={styles.actions}>
        <Link href="/admin/parties" className={styles.btn}>
          Cancel
        </Link>
        <div className={styles.grow} />
        <button type="submit" className={styles.btnPrimary} disabled={pending}>
          {pending ? "Saving…" : party ? "Save changes" : "Create party"}
        </button>
      </div>
    </form>
  );
}
