"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reopenFiscalYearAction } from "./actions";
import Modal from "@/components/ui/modal";
import styles from "@/components/data-grid/grid.module.css";
import formStyles from "@/components/form/form.module.css";

export default function ReopenYearButton({ fyId, fyName }: { fyId: number; fyName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reopen() {
    setError(null);
    startTransition(async () => {
      const res = await reopenFiscalYearAction(fyId, reason);
      if (res.error) {
        setError(res.error);
      } else {
        setOpen(false);
        setReason("");
        router.refresh();
      }
    });
  }

  return (
    <>
      <button type="button" className={styles.btn} onClick={() => setOpen(true)}>
        Reopen year
      </button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setError(null);
        }}
        title={`Reopen ${fyName}`}
        subtitle="Cancels the year-end closing entry and reopens the last period. A reason is required for the audit trail."
      >
        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="reopen-year-reason">
            Reason
          </label>
          <textarea
            id="reopen-year-reason"
            className={formStyles.textarea}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. a posting error was found after year-end close"
          />
        </div>
        {error && (
          <p className={formStyles.error} style={{ marginTop: 10 }} role="alert">
            {error}
          </p>
        )}
        <div className={formStyles.actions} style={{ marginTop: 14 }}>
          <div className={formStyles.grow} />
          <button type="button" className={formStyles.btnTertiary} onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button
            type="button"
            className={formStyles.btnPrimary}
            disabled={pending || !reason.trim()}
            onClick={reopen}
          >
            {pending ? "Reopening…" : "Reopen fiscal year"}
          </button>
        </div>
      </Modal>
    </>
  );
}
