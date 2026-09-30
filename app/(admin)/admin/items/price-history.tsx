"use client";

import { useActionState } from "react";
import { addItemPriceAction, type PriceFormState } from "./actions";
import { fmtRate } from "@/lib/format";
import gridStyles from "@/components/data-grid/grid.module.css";
import formStyles from "@/components/form/form.module.css";

export type PriceRow = {
  id: number;
  salePrice: number;
  effectiveFrom: string;
  effectiveTo: string | null;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function PriceHistory({
  itemId,
  rows,
  canEdit,
}: {
  itemId: number;
  rows: PriceRow[];
  canEdit: boolean;
}) {
  const action = addItemPriceAction.bind(null, itemId);
  const [state, formAction, pending] = useActionState<PriceFormState, FormData>(action, {});

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className={gridStyles.card}>
      <div
        style={{
          padding: "11px 14px",
          borderBottom: "1px solid var(--rule)",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        Price history
      </div>

      <table className={gridStyles.table}>
        <thead>
          <tr>
            <th style={{ textAlign: "right" }}>Sale price</th>
            <th>Effective from</th>
            <th>Effective to</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className={gridStyles.num}>{fmtRate(r.salePrice)}</td>
              <td className={gridStyles.muted}>{fmtDate(r.effectiveFrom)}</td>
              <td className={gridStyles.muted}>
                {r.effectiveTo ? fmtDate(r.effectiveTo) : "— current —"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {canEdit && (
        <form
          action={formAction}
          style={{
            padding: "12px 14px",
            borderTop: "1px solid var(--rule)",
            display: "flex",
            alignItems: "flex-end",
            gap: 12,
          }}
        >
          <div className={formStyles.field} style={{ width: 160 }}>
            <label className={formStyles.label} htmlFor="salePrice">
              New sale price
            </label>
            <input
              id="salePrice"
              name="salePrice"
              type="number"
              step="0.0001"
              min="0"
              className={`${formStyles.input} ${formStyles.mono}`}
              required
            />
          </div>
          <div className={formStyles.field} style={{ width: 170 }}>
            <label className={formStyles.label} htmlFor="effectiveFrom">
              Effective from
            </label>
            <input
              id="effectiveFrom"
              name="effectiveFrom"
              type="date"
              className={formStyles.input}
              defaultValue={today}
              required
            />
          </div>
          <button type="submit" className={formStyles.btnPrimary} disabled={pending}>
            {pending ? "Saving…" : "Add price"}
          </button>
          {state.error && (
            <span style={{ color: "var(--danger)", fontSize: 12 }}>{state.error}</span>
          )}
        </form>
      )}

      <p className={gridStyles.note} style={{ padding: "10px 14px 12px" }}>
        Adding a price never edits an existing row — it closes the current
        one&apos;s end date and opens a new one, so past documents keep
        resolving to the rate that was actually in effect.
      </p>
    </div>
  );
}
