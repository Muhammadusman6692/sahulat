"use client";

import { useEffect, useState, useTransition } from "react";
import { previewYearEndCloseAction, closeFiscalYearAction } from "./actions";
import type { YearEndPreviewRow } from "@/lib/db/period-close";
import Modal from "@/components/ui/modal";
import gridStyles from "@/components/data-grid/grid.module.css";
import formStyles from "@/components/form/form.module.css";

function fmtMoney(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function YearEndCloseModal({
  open,
  onClose,
  fyId,
  fyName,
  onClosed,
}: {
  open: boolean;
  onClose: () => void;
  fyId: number;
  fyName: string;
  onClosed: () => void;
}) {
  const [rows, setRows] = useState<YearEndPreviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      setRows(null);
      setError(null);
      return;
    }
    setLoading(true);
    previewYearEndCloseAction(fyId).then((res) => {
      setLoading(false);
      if (res.error) setError(res.error);
      else setRows(res.rows ?? []);
    });
  }, [open, fyId]);

  const netIncome = (rows ?? []).reduce((s, r) => s + (r.ZERO_DEBIT - r.ZERO_CREDIT), 0);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await closeFiscalYearAction(fyId);
      if (res.error) setError(res.error);
      else onClosed();
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Close ${fyName}`}
      subtitle="This posts a year-end closing entry that zeroes every Income/Expense account's balance for the year into Retained Earnings, then closes the last period and the fiscal year together."
    >
      {loading && <p className={gridStyles.muted}>Loading preview…</p>}

      {rows && rows.length === 0 && (
        <p className={gridStyles.muted}>
          No Income/Expense movement this year — closing will not post a voucher, it will
          just close the period and the fiscal year.
        </p>
      )}

      {rows && rows.length > 0 && (
        <table className={gridStyles.table}>
          <thead>
            <tr>
              <th>Account</th>
              <th style={{ textAlign: "right" }}>Debit</th>
              <th style={{ textAlign: "right" }}>Credit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.COA_ID}>
                <td>
                  {r.ACCOUNT_CODE} — {r.ACCOUNT_NAME}
                </td>
                <td className={gridStyles.num}>{r.ZERO_DEBIT ? fmtMoney(r.ZERO_DEBIT) : ""}</td>
                <td className={gridStyles.num}>{r.ZERO_CREDIT ? fmtMoney(r.ZERO_CREDIT) : ""}</td>
              </tr>
            ))}
            <tr>
              <td className={gridStyles.strong}>
                Retained Earnings ({netIncome >= 0 ? "profit" : "loss"})
              </td>
              <td className={gridStyles.num}>{netIncome < 0 ? fmtMoney(-netIncome) : ""}</td>
              <td className={gridStyles.num}>{netIncome > 0 ? fmtMoney(netIncome) : ""}</td>
            </tr>
          </tbody>
        </table>
      )}

      {error && (
        <p className={formStyles.error} style={{ marginTop: 10 }} role="alert">
          {error}
        </p>
      )}

      <div className={formStyles.actions} style={{ marginTop: 14 }}>
        <div className={formStyles.grow} />
        <button type="button" className={formStyles.btnTertiary} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={formStyles.btnPrimary}
          disabled={loading || pending || !!error}
          onClick={confirm}
        >
          {pending ? "Closing…" : "Close fiscal year"}
        </button>
      </div>
    </Modal>
  );
}
