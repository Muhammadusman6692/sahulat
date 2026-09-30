"use client";

import { useActionState } from "react";
import { actOnApprovalAction, type ActionFormState } from "./actions";
import formStyles from "@/components/form/form.module.css";
import gridStyles from "@/components/data-grid/grid.module.css";

export default function ApprovalActionRow({ instanceId }: { instanceId: number }) {
  const action = actOnApprovalAction.bind(null, instanceId);
  const [state, formAction, pending] = useActionState<ActionFormState, FormData>(action, {});

  if (state.ok) {
    return <span className={gridStyles.muted}>Done.</span>;
  }

  return (
    <form
      action={formAction}
      style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}
    >
      <input
        name="remarks"
        placeholder="Remarks (optional)"
        className={formStyles.input}
        style={{ width: 200 }}
        disabled={pending}
      />
      {state.error && (
        <span style={{ color: "var(--danger)", fontSize: 11 }}>{state.error}</span>
      )}
      <button
        type="submit"
        name="decision"
        value="REJECTED"
        className={formStyles.btn}
        disabled={pending}
      >
        Reject
      </button>
      <button
        type="submit"
        name="decision"
        value="APPROVED"
        className={formStyles.btnPrimary}
        disabled={pending}
      >
        {pending ? "Saving…" : "Approve"}
      </button>
    </form>
  );
}
