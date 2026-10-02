"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createDraftAction, updateDraftAction, type FormState } from "./actions";
import type { CvType } from "@/lib/db/cash-vouchers";
import { LockedField } from "@/components/form/locked-field";
import { fmtMoney } from "@/lib/format";
import AccountCombobox from "@/components/form/account-combobox";
import { accountFullLabel, type AccountLovOption } from "@/components/form/account-lov";
import formStyles from "@/components/form/form.module.css";
import gridStyles from "@/components/data-grid/grid.module.css";

export type AccountOption = AccountLovOption;
export type BranchOption = { id: number; code: string; name: string };

export type CvLineDraft = {
  coaId: string;
  narration: string;
  amount: string;
};

function emptyLine(): CvLineDraft {
  return { coaId: "", narration: "", amount: "" };
}

const TYPE_LABEL: Record<CvType, string> = { CPV: "Cash Payment", CRV: "Cash Receipt" };
const LINES_LABEL: Record<CvType, string> = {
  CPV: "Lines (debited — paid for)",
  CRV: "Lines (credited — received for)",
};
const CASH_SIDE_LABEL: Record<CvType, string> = { CPV: "Cash account (Cr)", CRV: "Cash account (Dr)" };

export default function CvForm({
  mode,
  voucherType,
  voucherId,
  companyLabel,
  branches,
  cashAccounts,
  freeLegAccounts,
  initial,
}: {
  mode: "create" | "edit";
  voucherType: CvType;
  voucherId?: number;
  companyLabel: string;
  branches: BranchOption[];
  cashAccounts: AccountOption[];
  freeLegAccounts: AccountOption[];
  initial: {
    branchId: number;
    branchLabel: string;
    voucherDate: string; // YYYY-MM-DD
    voucherNo: string | null;
    cashCoaId: number;
    cashAccountLabel: string;
    narration: string;
    lines: CvLineDraft[];
  };
}) {
  const action =
    mode === "edit" && voucherId
      ? updateDraftAction.bind(null, voucherId)
      : createDraftAction.bind(null, voucherType);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};

  const [branchId, setBranchId] = useState<number>(initial.branchId || branches[0]?.id || 0);
  const [cashCoaId, setCashCoaId] = useState<string>(
    initial.cashCoaId ? String(initial.cashCoaId) : "",
  );
  const [narration, setNarration] = useState(initial.narration);
  const [rows, setRows] = useState<CvLineDraft[]>(
    initial.lines.length >= 1 ? initial.lines : [emptyLine()],
  );

  function updateRow(i: number, patch: Partial<CvLineDraft>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyLine()]);
  }

  function removeRow(i: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const hasAmount = total > 0;

  const linesJson = JSON.stringify(
    rows.map((r) => ({
      coaId: r.coaId,
      narration: r.narration || null,
      amount: r.amount || 0,
    })),
  );

  const selectedCashAccount = cashAccounts.find((a) => String(a.id) === cashCoaId) ?? null;

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
      {mode === "edit" && <input type="hidden" name="cashCoaId" value={cashCoaId} />}

      <div className={formStyles.card}>
        <h2 className={formStyles.sectionTitle}>Header</h2>
        <div className={formStyles.section}>
          <div className={formStyles.field}>
            <span className={formStyles.label}>Company</span>
            <LockedField value={companyLabel} />
          </div>

          <div className={formStyles.field}>
            <span className={formStyles.label}>Voucher type</span>
            <LockedField value={TYPE_LABEL[voucherType]} />
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

          {mode === "create" ? (
            <div className={formStyles.field}>
              <label className={`${formStyles.label} ${formStyles.req}`} htmlFor="cashCoaId">
                Cash account
              </label>
              <input type="hidden" name="cashCoaId" value={cashCoaId} />
              <AccountCombobox
                accounts={cashAccounts}
                value={cashCoaId}
                onChange={setCashCoaId}
                placeholder="— select cash account —"
              />
              {fe.cashCoaId && <span className={formStyles.fieldError}>{fe.cashCoaId}</span>}
            </div>
          ) : (
            <div className={formStyles.field}>
              <span className={formStyles.label}>Cash account</span>
              <LockedField value={initial.cashAccountLabel} />
            </div>
          )}

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
        <div style={{ padding: "14px 16px 8px", fontSize: 12, fontWeight: 600 }}>
          {LINES_LABEL[voucherType]}
        </div>

        <table className={gridStyles.table}>
          <thead>
            <tr>
              <th style={{ width: 32 }}>#</th>
              <th style={{ width: 300 }}>Account *</th>
              <th>Line narration</th>
              <th style={{ width: 150, textAlign: "right" }}>Amount</th>
              <th style={{ width: 36 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className={gridStyles.muted}>{i + 1}</td>
                <td>
                  <AccountCombobox
                    accounts={freeLegAccounts}
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
                    value={r.amount}
                    onChange={(e) => updateRow(i, { amount: e.target.value })}
                  />
                </td>
                <td style={{ textAlign: "center" }}>
                  <button
                    type="button"
                    className={formStyles.btn}
                    style={{ padding: "4px 7px" }}
                    onClick={() => removeRow(i)}
                    disabled={rows.length <= 1}
                    aria-label="Remove line"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
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
            {hasAmount ? (
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
              <span style={{ fontSize: 11, color: "var(--ink-3)" }}>
                Enter at least one line with an amount greater than zero.
              </span>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: ".04em" }}>
              {CASH_SIDE_LABEL[voucherType]}
              {selectedCashAccount ? ` · ${accountFullLabel(selectedCashAccount)}` : ""}
            </div>
            <div className={formStyles.mono} style={{ fontSize: 15, fontWeight: 600 }}>
              {fmtMoney(total)}
            </div>
          </div>
        </div>
      </div>

      <div className={formStyles.actionsBar}>
        <Link href="/admin/cash-vouchers" className={formStyles.btnTertiary}>
          Cancel
        </Link>
        <div className={formStyles.grow} />
        <button
          type="submit"
          name="intent"
          value="draft"
          className={formStyles.btn}
          disabled={pending || !hasAmount || !cashCoaId}
        >
          <svg className={formStyles.btnIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
            <path d="M17 21v-8H7v8M7 3v5h8" />
          </svg>
          {pending ? "Saving…" : "Save as draft"}
        </button>
        <button
          type="submit"
          name="intent"
          value="post"
          className={formStyles.btnPrimary}
          disabled={pending || !hasAmount || !cashCoaId}
        >
          <svg className={formStyles.btnIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          {pending ? "Saving…" : "Save & Post"}
        </button>
      </div>
    </form>
  );
}
