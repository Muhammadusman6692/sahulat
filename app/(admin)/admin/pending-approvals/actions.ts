"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/dal";
import { actOnApprovalInstance, type ApprovalDecision } from "@/lib/db/approval-instances";

export type ActionFormState = {
  error?: string;
  ok?: boolean;
};

export async function actOnApprovalAction(
  instanceId: number,
  _prev: ActionFormState,
  formData: FormData,
): Promise<ActionFormState> {
  const user = await requirePermission("PENDING_APPROVALS", "VIEW");

  const decision = formData.get("decision");
  if (decision !== "APPROVED" && decision !== "REJECTED") {
    return { error: "Choose Approve or Reject." };
  }
  const remarks = String(formData.get("remarks") ?? "").trim() || null;

  const rowsChanged = await actOnApprovalInstance(
    instanceId,
    user.userId,
    decision as ApprovalDecision,
    remarks,
  );

  if (rowsChanged === 0) {
    return { error: "This item is no longer pending, or you're not its approver." };
  }

  revalidatePath("/admin/pending-approvals");
  return { ok: true };
}
