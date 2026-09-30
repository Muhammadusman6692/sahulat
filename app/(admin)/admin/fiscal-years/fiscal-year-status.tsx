"use client";

import { useState, useTransition } from "react";
import { toggleFiscalYearStatusAction } from "./actions";
import styles from "@/components/data-grid/grid.module.css";

export default function FiscalYearStatus({
  fyId,
  status,
  canApprove,
}: {
  fyId: number;
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
        await toggleFiscalYearStatusAction(fyId, next);
        setCurrent(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not change status.");
      }
    });
  }

  const closed = current === "CLOSED";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span className={closed ? styles.badgeOff : styles.badgeOk}>{current}</span>
      {canApprove && (
        <button
          type="button"
          className={styles.btn}
          disabled={pending}
          onClick={toggle}
        >
          {pending ? "…" : closed ? "Reopen fiscal year" : "Close fiscal year"}
        </button>
      )}
      {error && (
        <span style={{ color: "var(--danger)", fontSize: 12 }}>{error}</span>
      )}
    </div>
  );
}
