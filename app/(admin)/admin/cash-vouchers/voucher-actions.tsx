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
        router.push("/admin/cash-vouchers");
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
            href={`/print/cash-vouchers/${voucherId}`}
            target="_blank"
            rel="noopener noreferrer"
            className={formStyles.btn}
          >
            Print
          </Link>
        )}
        {status === "DRAFT" && mayEdit && (
          <button type="button" className={formStyles.btn} onClick={del} disabled={pending}>
            {pending && busy === "delete" ? "Deleting…" : "Delete draft"}
          </button>
        )}
        {status === "DRAFT" && mayPost && (
          <button type="button" className={formStyles.btnPrimary} onClick={post} disabled={pending}>
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
