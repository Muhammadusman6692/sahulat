"use client";

import { useState, useTransition } from "react";
import { togglePeriodStatusAction } from "./actions";
import styles from "@/components/data-grid/grid.module.css";

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
  canApprove,
}: {
  periodId: number;
  fyId: number;
  periodNo: number;
  startDate: Date;
  endDate: Date;
  status: "OPEN" | "CLOSED";
  canApprove: boolean;
}) {
  const [current, setCurrent] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = current === "OPEN" ? "CLOSED" : "OPEN";
    setError(null);
    startTransition(async () => {
      try {
        await togglePeriodStatusAction(periodId, fyId, next);
        setCurrent(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not change status.");
      }
    });
  }

  const closed = current === "CLOSED";

  return (
    <tr>
      <td className={styles.muted}>{periodNo}</td>
      <td className={styles.muted}>{fmtDate(startDate)}</td>
      <td className={styles.muted}>{fmtDate(endDate)}</td>
      <td>
        <span className={closed ? styles.badgeOff : styles.badgeOk}>
          {current}
        </span>
      </td>
      <td style={{ textAlign: "right" }}>
        {canApprove ? (
          <button
            type="button"
            className={styles.pageLink}
            style={{ cursor: pending ? "default" : "pointer" }}
            disabled={pending}
            onClick={toggle}
          >
            {pending ? "…" : closed ? "Reopen" : "Close"}
          </button>
        ) : (
          <span className={styles.muted} style={{ fontSize: 11 }}>
            No permission
          </span>
        )}
        {error && (
          <div style={{ color: "var(--danger)", fontSize: 11, marginTop: 3 }}>
            {error}
          </div>
        )}
      </td>
    </tr>
  );
}
