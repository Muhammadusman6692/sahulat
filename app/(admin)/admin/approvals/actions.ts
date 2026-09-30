"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission, requireScope } from "@/lib/dal";
import {
  createApprovalRule,
  updateApprovalRule,
  getApprovalRule,
  type ApprovalRuleIdentity,
  type ApprovalRuleSettings,
} from "@/lib/db/approvals";
import { describeOracleError } from "@/lib/db/errors";

const settingsFields = {
  approverRoleId: z.coerce.number().int().positive("Choose an approver role"),
  minAmount: z.coerce.number().min(0, "Cannot be negative"),
};

const newSchema = z.object({
  ...settingsFields,
  companyId: z.coerce.number().int().positive("Choose a company"),
  moduleCode: z.string().trim().min(1, "Choose a document"),
  stepNo: z.coerce.number().int().min(1, "Must be at least 1"),
});

const editSchema = z.object(settingsFields);

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

function submittedValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

function readSettings(formData: FormData) {
  return {
    approverRoleId: formData.get("approverRoleId"),
    minAmount: formData.get("minAmount") || 0,
  };
}

export async function createApprovalRuleAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requirePermission("APPROVAL_MAINT", "CREATE");

  const parsed = newSchema.safeParse({
    ...readSettings(formData),
    companyId: formData.get("companyId"),
    moduleCode: formData.get("moduleCode"),
    stepNo: formData.get("stepNo"),
  });

  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
      values: submittedValues(formData),
    };
  }

  const { companyId, moduleCode, stepNo, ...settings } = parsed.data;
  await requireScope(companyId);

  const identity: ApprovalRuleIdentity = { companyId, moduleCode, stepNo };
  const settingsInput: ApprovalRuleSettings = settings;

  try {
    await createApprovalRule(identity, settingsInput);
  } catch (e) {
    return {
      error: describeOracleError(e, "The approval rule could not be created."),
      values: submittedValues(formData),
    };
  }

  revalidatePath("/admin/approvals");
  redirect("/admin/approvals");
}

export async function updateApprovalRuleAction(
  ruleId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const existing = await getApprovalRule(ruleId);
  if (!existing) return { error: "That approval rule no longer exists." };

  await requirePermission("APPROVAL_MAINT", "EDIT");
  await requireScope(existing.COMPANY_ID);

  const parsed = editSchema.safeParse(readSettings(formData));
  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
      values: submittedValues(formData),
    };
  }

  try {
    await updateApprovalRule(ruleId, parsed.data);
  } catch (e) {
    return {
      error: describeOracleError(e, "The approval rule could not be saved."),
      values: submittedValues(formData),
    };
  }

  revalidatePath("/admin/approvals");
  redirect("/admin/approvals");
}
