"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { postDraftAction, deleteDraftAction, cancelPostedAction } from "./actions";
import Modal from "@/components/ui/modal";
import formStyles from "@/components/form/form.module.css";

export default function VoucherActions({
  voucherId,
  status,
  mayEdit,
  mayPost,
  mayCancel,
  mayPrint,
}: {
  voucherId: number;
  status: "DRAFT" | "POSTED" | "CANCELLED";
  mayEdit: boolean;
  mayPost: boolean;
  mayCancel: boolean;
  mayPrint: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"post" | "delete" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");

  function post() {
    setError(null);
    setBusy("post");
    startTransition(async () => {
      try {
        await postDraftAction(voucherId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not post this voucher.");
      }
    });
  }

  function del() {
    setError(null);
    setBusy("delete");
    startTransition(async () => {
      try {
        await deleteDraftAction(voucherId);
        router.push("/admin/journal-vouchers");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not delete this voucher.");
      }
    });
  }

  function confirmCancel() {
    setError(null);
    setBusy("cancel");
    startTransition(async () => {
      try {
        await cancelPostedAction(voucherId, reason);
        setCancelOpen(false);
        setReason("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not cancel this voucher.");
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
      <div style={{ display: "flex", gap: 8 }}>
        {mayPrint && (
          <Link
            href={`/print/journal-vouchers/${voucherId}`}
            target="_blank"
            rel="noopener noreferrer"
            className={formStyles.btn}
          >
            <svg className={formStyles.btnIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-2M6 14h12v7H6z" />
            </svg>
            Print
          </Link>
        )}
        {status === "DRAFT" && mayEdit && (
          <button type="button" className={formStyles.btnDanger} onClick={del} disabled={pending}>
            <svg className={formStyles.btnIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
            </svg>
            {pending && busy === "delete" ? "Deleting…" : "Delete draft"}
          </button>
        )}
        {status === "DRAFT" && mayPost && (
          <button type="button" className={formStyles.btnPrimary} onClick={post} disabled={pending}>
            <svg className={formStyles.btnIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            {pending && busy === "post" ? "Posting…" : "Post"}
          </button>
        )}
        {status === "POSTED" && mayCancel && (
          <button type="button" className={formStyles.btn} onClick={() => setCancelOpen(true)} disabled={pending}>
            Cancel voucher
          </button>
        )}
      </div>
      {error && <span style={{ color: "var(--danger)", fontSize: 12, maxWidth: 360, textAlign: "right" }}>{error}</span>}

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel voucher"
        subtitle="This cannot be undone. The voucher stays on record as CANCELLED, not deleted."
      >
        <div className={formStyles.wrap}>
          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor="cancelReason">
              Reason
            </label>
            <textarea
              id="cancelReason"
              className={formStyles.textarea}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className={formStyles.actions}>
            <button type="button" className={formStyles.btn} onClick={() => setCancelOpen(false)}>
              Close
            </button>
            <div className={formStyles.grow} />
            <button
              type="button"
              className={formStyles.btnPrimary}
              onClick={confirmCancel}
              disabled={pending || !reason.trim()}
            >
              {pending && busy === "cancel" ? "Cancelling…" : "Confirm cancel"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
