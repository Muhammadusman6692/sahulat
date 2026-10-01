"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createDraftAction, updateDraftAction, type FormState } from "./actions";
import { LockedField } from "@/components/form/locked-field";
import { fmtMoney } from "@/lib/format";
import AccountCombobox from "@/components/form/account-combobox";
import type { AccountLovOption } from "@/components/form/account-lov";
import formStyles from "@/components/form/form.module.css";
import gridStyles from "@/components/data-grid/grid.module.css";

export type AccountOption = AccountLovOption;
export type BranchOption = { id: number; code: string; name: string };

export type JvLineDraft = {
  coaId: string;
  narration: string;
  debit: string;
  credit: string;
};

function emptyLine(): JvLineDraft {
  return { coaId: "", narration: "", debit: "", credit: "" };
}

export default function JvForm({
  mode,
  voucherId,
  companyLabel,
  branches,
  accounts,
  initial,
}: {
  mode: "create" | "edit";
  voucherId?: number;
  companyLabel: string;
  branches: BranchOption[];
  accounts: AccountOption[];
  initial: {
    branchId: number;
    branchLabel: string;
    voucherDate: string; // YYYY-MM-DD
    voucherNo: string | null;
    narration: string;
    lines: JvLineDraft[];
  };
}) {
  const action =
    mode === "edit" && voucherId
      ? updateDraftAction.bind(null, voucherId)
      : createDraftAction;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};

  const [branchId, setBranchId] = useState<number>(initial.branchId || branches[0]?.id || 0);
  const [narration, setNarration] = useState(initial.narration);
  const [rows, setRows] = useState<JvLineDraft[]>(
    initial.lines.length >= 2 ? initial.lines : [emptyLine(), emptyLine()],
  );

  function updateRow(i: number, patch: Partial<JvLineDraft>) {
    setRows((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r;
        const next = { ...r, ...patch };
        if (patch.debit !== undefined && Number(patch.debit) > 0) next.credit = "";
        if (patch.credit !== undefined && Number(patch.credit) > 0) next.debit = "";
        return next;
      }),
    );
  }

  function addRow() {
    setRows((prev) => [...prev, emptyLine()]);
  }

  function removeRow(i: number) {
    setRows((prev) => (prev.length > 2 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  const totalDebit = rows.reduce((s, r) => s + (Number(r.debit) || 0), 0);
  const totalCredit = rows.reduce((s, r) => s + (Number(r.credit) || 0), 0);
  const diff = Math.round((totalDebit - totalCredit) * 100) / 100;
  const isEmpty = totalDebit === 0 && totalCredit === 0;
  const balanced = diff === 0 && !isEmpty;

  const linesJson = JSON.stringify(
    rows.map((r) => ({
      coaId: r.coaId,
      narration: r.narration || null,
      debit: r.debit || 0,
      credit: r.credit || 0,
    })),
  );

  return (
    <form action={formAction} className={formStyles.wrap} style={{ maxWidth: 1100 }}>
      {state.error && (
        <p className={formStyles.error} role="alert">
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

      <input type="hidden" name="linesJson" value={linesJson} />

      <div className={formStyles.card}>
        <h2 className={formStyles.sectionTitle}>Header</h2>
        <div className={formStyles.section}>
          <div className={formStyles.field}>
            <span className={formStyles.label}>Company</span>
            <LockedField value={companyLabel} />
          </div>

          {mode === "create" ? (
            <div className={formStyles.field}>
              <label className={`${formStyles.label} ${formStyles.req}`} htmlFor="branchId">
                Branch
              </label>
              <select
                id="branchId"
                name="branchId"
                className={fe.branchId ? formStyles.inputInvalid : formStyles.select}
                value={branchId || ""}
                onChange={(e) => setBranchId(Number(e.target.value))}
                required
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </select>
              {fe.branchId && <span className={formStyles.fieldError}>{fe.branchId}</span>}
            </div>
          ) : (
            <div className={formStyles.field}>
              <span className={formStyles.label}>Branch</span>
              <LockedField value={initial.branchLabel} />
            </div>
          )}

          {mode === "create" ? (
            <div className={formStyles.field}>
              <label className={`${formStyles.label} ${formStyles.req}`} htmlFor="voucherDate">
                Voucher date
              </label>
              <input
                id="voucherDate"
                name="voucherDate"
                type="date"
                className={fe.voucherDate ? formStyles.inputInvalid : formStyles.input}
                defaultValue={initial.voucherDate}
                required
              />
              {fe.voucherDate ? (
                <span className={formStyles.fieldError}>{fe.voucherDate}</span>
              ) : (
                <span className={formStyles.hint}>Must fall in an open fiscal period.</span>
              )}
            </div>
          ) : (
            <div className={formStyles.field}>
              <span className={formStyles.label}>Voucher date</span>
              <LockedField value={initial.voucherDate} mono />
            </div>
          )}

          <div className={formStyles.field}>
            <span className={formStyles.label}>Voucher no.</span>
            <LockedField value={initial.voucherNo ?? "Assigned on save"} mono />
          </div>

          <div className={formStyles.fieldWide}>
            <label className={`${formStyles.label} ${formStyles.req}`} htmlFor="narration">
              Narration
            </label>
            <textarea
              id="narration"
              name="narration"
              className={formStyles.textarea}
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              required
            />
          </div>
        </div>
      </div>

      <div className={gridStyles.card}>
        <div style={{ padding: "14px 16px 8px", fontSize: 12, fontWeight: 600 }}>Lines</div>

        <table className={gridStyles.table}>
          <thead>
            <tr>
              <th style={{ width: 32 }}>#</th>
              <th style={{ width: 280 }}>Account *</th>
              <th>Line narration</th>
              <th style={{ width: 130, textAlign: "right" }}>Debit</th>
              <th style={{ width: 130, textAlign: "right" }}>Credit</th>
              <th style={{ width: 36 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              return (
                <tr key={i}>
                  <td className={gridStyles.muted}>{i + 1}</td>
                  <td>
                    <AccountCombobox
                      accounts={accounts}
                      value={r.coaId}
                      onChange={(value) => updateRow(i, { coaId: value })}
                    />
                  </td>
                  <td>
                    <input
                      className={formStyles.input}
                      value={r.narration}
                      onChange={(e) => updateRow(i, { narration: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={formStyles.input}
                      style={{ textAlign: "right", fontFamily: "var(--font-plex-mono), monospace" }}
                      value={r.debit}
                      onChange={(e) => updateRow(i, { debit: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={formStyles.input}
                      style={{ textAlign: "right", fontFamily: "var(--font-plex-mono), monospace" }}
                      value={r.credit}
                      onChange={(e) => updateRow(i, { credit: e.target.value })}
                    />
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      type="button"
                      className={formStyles.btn}
                      style={{ padding: "4px 7px" }}
                      onClick={() => removeRow(i)}
                      disabled={rows.length <= 2}
                      aria-label="Remove line"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 14 }}>
          <button type="button" className={formStyles.btn} onClick={addRow}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add line
          </button>
          <span className={gridStyles.note}>
            A Customer or Supplier account carries its own dedicated ledger account — the party is picked up
            automatically from the account, no separate party field needed.
          </span>
        </div>

        <div
          style={{
            padding: "13px 16px",
            borderTop: "1px solid var(--rule)",
            background: "var(--surface-sunken)",
            display: "flex",
            alignItems: "center",
            gap: 26,
          }}
        >
          <div style={{ flexGrow: 1 }}>
            {isEmpty ? (
              <span style={{ fontSize: 11, color: "var(--ink-3)" }}>
                Enter debit and credit amounts that add up to the same total.
              </span>
            ) : balanced ? (
              <span
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px",
                  borderRadius: 14, background: "var(--primary-tint)", color: "var(--primary-ink)",
                  fontSize: 11, fontWeight: 600,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Balanced
              </span>
            ) : (
              <span
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px",
                  borderRadius: 14, background: "var(--danger-tint, #f7e3e2)", color: "var(--danger)",
                  fontSize: 11, fontWeight: 600,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 9v4M12 17h.01" />
                  <path d="M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                </svg>
                Out of balance by {fmtMoney(Math.abs(diff))} — debit and credit totals must match
              </span>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: ".04em" }}>
              Total debit
            </div>
            <div className={formStyles.mono} style={{ fontSize: 15, fontWeight: 600 }}>
              {fmtMoney(totalDebit)}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: ".04em" }}>
              Total credit
            </div>
            <div className={formStyles.mono} style={{ fontSize: 15, fontWeight: 600 }}>
              {fmtMoney(totalCredit)}
            </div>
          </div>
        </div>
      </div>

      <div className={formStyles.actions}>
        <Link href="/admin/journal-vouchers" className={formStyles.btn}>
          Cancel
        </Link>
        <div className={formStyles.grow} />
        <button
          type="submit"
          name="intent"
          value="draft"
          className={formStyles.btn}
          disabled={pending || !balanced}
        >
          {pending ? "Saving…" : "Save as draft"}
        </button>
        <button
          type="submit"
          name="intent"
          value="post"
          className={formStyles.btnPrimary}
          disabled={pending || !balanced}
        >
          {pending ? "Saving…" : "Save & Post"}
        </button>
      </div>
      <p className={gridStyles.note}>
        Save as draft and Save &amp; Post are disabled while debit and credit totals differ —
        the same rule the server enforces on post.
      </p>
    </form>
  );
}
