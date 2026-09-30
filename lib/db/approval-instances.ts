import "server-only";
import { query, execute } from "@/lib/oracle";

export type PendingApprovalRow = {
  INSTANCE_ID: number;
  MODULE_CODE: string;
  MODULE_NAME: string;
  DOC_ID: number;
  STEP_NO: number;
  DOC_AMOUNT: number | null;
  SUBMITTED_ON: Date;
};

/**
 * A row only comes back if one of the caller's roles is the approver role
 * for that (company, module, step) in approval_rule — this join is the
 * authorization, not just a display filter.
 */
export async function listMyPendingApprovals(userId: number, companyId: number) {
  return query<PendingApprovalRow>(
    `SELECT ai.instance_id, ai.module_code, m.module_name, ai.doc_id, ai.step_no,
            ai.doc_amount, ai.submitted_on
       FROM approval_instance ai
       JOIN module_function m ON m.module_code = ai.module_code
       JOIN approval_rule ar ON ar.company_id = ai.company_id
                             AND ar.module_code = ai.module_code
                             AND ar.step_no = ai.step_no
       JOIN user_role ur ON ur.role_id = ar.approver_role_id AND ur.user_id = :userId
      WHERE ai.status = 'PENDING' AND ai.company_id = :companyId
      ORDER BY ai.submitted_on`,
    { userId, companyId },
  );
}

export type ApprovalDecision = "APPROVED" | "REJECTED";

/**
 * Enforces "still pending" and "this user is an eligible approver" in the
 * same statement as the update, so there is no separate fetch-then-update
 * race. Returns the number of rows changed — 0 means someone else already
 * acted on it, or the caller isn't its approver.
 */
export async function actOnApprovalInstance(
  instanceId: number,
  userId: number,
  decision: ApprovalDecision,
  remarks: string | null,
) {
  return execute(
    `UPDATE approval_instance ai
        SET status = :decision, acted_by = :userId, acted_on = SYSTIMESTAMP,
            remarks = :remarks
      WHERE instance_id = :instanceId
        AND status = 'PENDING'
        AND EXISTS (
          SELECT 1 FROM approval_rule ar
            JOIN user_role ur ON ur.role_id = ar.approver_role_id
           WHERE ar.company_id = ai.company_id AND ar.module_code = ai.module_code
             AND ar.step_no = ai.step_no AND ur.user_id = :userId)`,
    { instanceId, userId, decision, remarks },
  );
}
