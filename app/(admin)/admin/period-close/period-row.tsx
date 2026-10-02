"use client";

import { useState, useTransition } from "react";
import { closePeriodAction, reopenPeriodAction } from "./actions";
import Modal from "@/components/ui/modal";
import gridStyles from "@/components/data-grid/grid.module.css";
import formStyles from "@/components/form/form.module.css";

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function PeriodRow({
  periodId,
  fyId,
  periodNo,
  startDate,
  endDate,
  status,
  draftCount,
  balanced,
  canApprove,
}: {
  periodId: number;
  fyId: number;
  periodNo: number;
  startDate: Date;
  endDate: Date;
  status: "OPEN" | "CLOSED";
  draftCount: number;
  balanced: "Y" | "N";
  canApprove: boolean;
}) {
  const [current, setCurrent] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [showReopen, setShowReopen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const blocked = draftCount > 0 || balanced === "N";
  const closed = current === "CLOSED";

  function close() {
    setError(null);
    startTransition(async () => {
      const res = await closePeriodAction(periodId, fyId);
      if (res.error) setError(res.error);
      else setCurrent("CLOSED");
    });
  }

  function reopen() {
    setError(null);
    startTransition(async () => {
      const res = await reopenPeriodAction(periodId, fyId, reason);
      if (res.error) {
        setError(res.error);
      } else {
        setCurrent("OPEN");
        setShowReopen(false);
        setReason("");
      }
    });
  }

  return (
    <>
      <tr>
        <td className={gridStyles.muted}>{periodNo}</td>
        <td className={gridStyles.muted}>{fmtDate(startDate)}</td>
        <td className={gridStyles.muted}>{fmtDate(endDate)}</td>
        <td>
          <span className={closed ? gridStyles.badgeOff : gridStyles.badgeOk}>
            {current}
          </span>
        </td>
        <td className={gridStyles.num}>
          {closed ? (
            <span className={gridStyles.muted}>—</span>
          ) : draftCount > 0 ? (
            <span className={gridStyles.badgeWarn}>{draftCount}</span>
          ) : (
            0
          )}
        </td>
        <td>
          {closed ? (
            <span className={gridStyles.muted}>—</span>
          ) : balanced === "Y" ? (
            <span className={gridStyles.badgeOk}>OK</span>
          ) : (
            <span className={gridStyles.badgeWarn}>Mismatch</span>
          )}
        </td>
        <td style={{ textAlign: "right" }}>
          {canApprove ? (
            closed ? (
              <button
                type="button"
                className={gridStyles.pageLink}
                onClick={() => setShowReopen(true)}
              >
                Reopen
              </button>
            ) : (
              <button
                type="button"
                className={gridStyles.pageLink}
                style={{
                  cursor: pending || blocked ? "default" : "pointer",
                  opacity: blocked ? 0.5 : 1,
                }}
                disabled={pending || blocked}
                title={
                  draftCount > 0
                    ? `${draftCount} draft voucher(s) must be posted or cancelled first`
                    : balanced === "N"
                      ? "Posted entries in this period do not balance"
                      : undefined
                }
                onClick={close}
              >
                {pending ? "…" : "Close"}
              </button>
            )
          ) : (
            <span className={gridStyles.muted} style={{ fontSize: 11 }}>
              No permission
            </span>
          )}
          {error && !showReopen && (
            <div style={{ color: "var(--danger)", fontSize: 11, marginTop: 3 }}>
              {error}
            </div>
          )}
        </td>
      </tr>

      <Modal
        open={showReopen}
        onClose={() => {
          setShowReopen(false);
          setError(null);
        }}
        title={`Reopen period ${periodNo}`}
        subtitle="Vouchers can post into this period again once reopened. A reason is required for the audit trail."
      >
        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor={`reopen-reason-${periodId}`}>
            Reason
          </label>
          <textarea
            id={`reopen-reason-${periodId}`}
            className={formStyles.textarea}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. correcting a posting error found after close"
          />
        </div>
        {error && (
          <p className={formStyles.error} style={{ marginTop: 10 }} role="alert">
            {error}
          </p>
        )}
        <div className={formStyles.actions} style={{ marginTop: 14 }}>
          <div className={formStyles.grow} />
          <button
            type="button"
            className={formStyles.btnTertiary}
            onClick={() => setShowReopen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className={formStyles.btnPrimary}
            disabled={pending || !reason.trim()}
            onClick={reopen}
          >
            {pending ? "Reopening…" : "Reopen period"}
          </button>
        </div>
      </Modal>
    </>
  );
}
