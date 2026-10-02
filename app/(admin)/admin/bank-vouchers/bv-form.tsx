"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createDraftAction, updateDraftAction, type FormState } from "./actions";
import type { BvType, InstrumentType } from "@/lib/db/bank-vouchers";
import { LockedField } from "@/components/form/locked-field";
import { fmtMoney } from "@/lib/format";
import AccountCombobox from "@/components/form/account-combobox";
import { accountFullLabel, type AccountLovOption } from "@/components/form/account-lov";
import formStyles from "@/components/form/form.module.css";
import gridStyles from "@/components/data-grid/grid.module.css";

export type AccountOption = AccountLovOption;
export type BranchOption = { id: number; code: string; name: string };

export type BvLineDraft = {
  coaId: string;
  narration: string;
  amount: string;
};

function emptyLine(): BvLineDraft {
  return { coaId: "", narration: "", amount: "" };
}

const TYPE_LABEL: Record<BvType, string> = { BPV: "Bank Payment", BRV: "Bank Receipt" };
const LINES_LABEL: Record<BvType, string> = {
  BPV: "Lines (debited — paid for)",
  BRV: "Lines (credited — received for)",
};
const BANK_SIDE_LABEL: Record<BvType, string> = { BPV: "Bank account (Cr)", BRV: "Bank account (Dr)" };

const INSTRUMENT_LABEL: Record<InstrumentType, string> = {
  CHEQUE: "Cheque",
  ONLINE_TRANSFER: "Online Transfer",
  PAY_ORDER: "Pay Order",
  DD: "Demand Draft",
  RTGS: "RTGS",
};
const INSTRUMENT_NO_REQUIRED: Record<InstrumentType, boolean> = {
  CHEQUE: true,
  PAY_ORDER: true,
  DD: true,
  ONLINE_TRANSFER: false,
  RTGS: false,
};

export default function BvForm({
  mode,
  voucherType,
  voucherId,
  companyLabel,
  branches,
  bankAccounts,
  freeLegAccounts,
  initial,
}: {
  mode: "create" | "edit";
  voucherType: BvType;
  voucherId?: number;
  companyLabel: string;
  branches: BranchOption[];
  bankAccounts: AccountOption[];
  freeLegAccounts: AccountOption[];
  initial: {
    branchId: number;
    branchLabel: string;
    voucherDate: string; // YYYY-MM-DD
    voucherNo: string | null;
    bankCoaId: number;
    bankAccountLabel: string;
    narration: string;
    instrumentType: InstrumentType;
    instrumentNo: string;
    instrumentDate: string; // YYYY-MM-DD
    lines: BvLineDraft[];
  };
}) {
  const action =
    mode === "edit" && voucherId
      ? updateDraftAction.bind(null, voucherId)
      : createDraftAction.bind(null, voucherType);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};

  const [branchId, setBranchId] = useState<number>(initial.branchId || branches[0]?.id || 0);
  const [bankCoaId, setBankCoaId] = useState<string>(
    initial.bankCoaId ? String(initial.bankCoaId) : "",
  );
  const [narration, setNarration] = useState(initial.narration);
  const [instrumentType, setInstrumentType] = useState<InstrumentType>(initial.instrumentType);
  const [instrumentNo, setInstrumentNo] = useState(initial.instrumentNo);
  const [instrumentDate, setInstrumentDate] = useState(initial.instrumentDate);
  const [rows, setRows] = useState<BvLineDraft[]>(
    initial.lines.length >= 1 ? initial.lines : [emptyLine()],
  );

  function updateRow(i: number, patch: Partial<BvLineDraft>) {
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
  const instrumentNoRequired = INSTRUMENT_NO_REQUIRED[instrumentType];

  const linesJson = JSON.stringify(
    rows.map((r) => ({
      coaId: r.coaId,
      narration: r.narration || null,
      amount: r.amount || 0,
    })),
  );

  const selectedBankAccount = bankAccounts.find((a) => String(a.id) === bankCoaId) ?? null;

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
      {mode === "edit" && <input type="hidden" name="bankCoaId" value={bankCoaId} />}

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
              <label className={`${formStyles.label} ${formStyles.req}`} htmlFor="bankCoaId">
                Bank account
              </label>
              <input type="hidden" name="bankCoaId" value={bankCoaId} />
              <AccountCombobox
                accounts={bankAccounts}
                value={bankCoaId}
                onChange={setBankCoaId}
                placeholder="— select bank account —"
              />
              {fe.bankCoaId && <span className={formStyles.fieldError}>{fe.bankCoaId}</span>}
            </div>
          ) : (
            <div className={formStyles.field}>
              <span className={formStyles.label}>Bank account</span>
              <LockedField value={initial.bankAccountLabel} />
            </div>
          )}

          <div className={formStyles.field}>
            <label className={`${formStyles.label} ${formStyles.req}`} htmlFor="instrumentType">
              Instrument type
            </label>
            <select
              id="instrumentType"
              name="instrumentType"
              className={fe.instrumentType ? formStyles.inputInvalid : formStyles.select}
              value={instrumentType}
              onChange={(e) => setInstrumentType(e.target.value as InstrumentType)}
              required
            >
              {Object.entries(INSTRUMENT_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {fe.instrumentType && <span className={formStyles.fieldError}>{fe.instrumentType}</span>}
          </div>

          <div className={formStyles.field}>
            <label
              className={`${formStyles.label} ${instrumentNoRequired ? formStyles.req : ""}`}
              htmlFor="instrumentNo"
            >
              Instrument no.
            </label>
            <input
              id="instrumentNo"
              name="instrumentNo"
              className={fe.instrumentNo ? formStyles.inputInvalid : formStyles.input}
              value={instrumentNo}
              onChange={(e) => setInstrumentNo(e.target.value)}
              required={instrumentNoRequired}
            />
            {fe.instrumentNo && <span className={formStyles.fieldError}>{fe.instrumentNo}</span>}
          </div>

          <div className={formStyles.field}>
            <label className={`${formStyles.label} ${formStyles.req}`} htmlFor="instrumentDate">
              Instrument date
            </label>
            <input
              id="instrumentDate"
              name="instrumentDate"
              type="date"
              className={fe.instrumentDate ? formStyles.inputInvalid : formStyles.input}
              value={instrumentDate}
              onChange={(e) => setInstrumentDate(e.target.value)}
              required
            />
            {fe.instrumentDate && <span className={formStyles.fieldError}>{fe.instrumentDate}</span>}
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
              {BANK_SIDE_LABEL[voucherType]}
              {selectedBankAccount ? ` · ${accountFullLabel(selectedBankAccount)}` : ""}
            </div>
            <div className={formStyles.mono} style={{ fontSize: 15, fontWeight: 600 }}>
              {fmtMoney(total)}
            </div>
          </div>
        </div>
      </div>

      <div className={formStyles.actionsBar}>
        <Link href="/admin/bank-vouchers" className={formStyles.btnTertiary}>
          Cancel
        </Link>
        <div className={formStyles.grow} />
        <button
          type="submit"
          name="intent"
          value="draft"
          className={formStyles.btn}
          disabled={pending || !hasAmount || !bankCoaId}
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
          disabled={pending || !hasAmount || !bankCoaId}
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
