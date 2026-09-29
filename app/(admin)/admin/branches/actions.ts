"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission, requireScope } from "@/lib/dal";
import { createBranch, updateBranch, getBranch, type BranchInput } from "@/lib/db/branches";
import { describeOracleError } from "@/lib/db/errors";

const schema = z.object({
  companyId: z.coerce.number().int().positive("Choose a company"),
  branchCode: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(10, "Code cannot exceed 10 characters")
    .regex(/^[A-Za-z0-9_-]+$/, "Use letters, digits, hyphen or underscore only"),
  branchName: z.string().trim().min(1, "Name is required").max(200),
  address: z.string().trim().max(400).optional(),
  strnNo: z.string().trim().max(30).optional(),
  activeYn: z.enum(["Y", "N"]),
});

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

export async function saveBranch(
  branchId: number | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requirePermission("BRANCH_MAINT", branchId ? "EDIT" : "CREATE");

  const parsed = schema.safeParse({
    companyId: formData.get("companyId"),
    branchCode: formData.get("branchCode"),
    branchName: formData.get("branchName"),
    address: formData.get("address"),
    strnNo: formData.get("strnNo"),
    activeYn: formData.get("activeYn") === "on" ? "Y" : "N",
  });

  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
      values: submittedValues(formData),
    };
  }

  const input: BranchInput = {
    companyId: parsed.data.companyId,
    branchCode: parsed.data.branchCode,
    branchName: parsed.data.branchName,
    address: parsed.data.address || null,
    strnNo: parsed.data.strnNo || null,
    activeYn: parsed.data.activeYn,
  };

  // The company must be one the user is scoped to, whether creating a branch
  // under it or editing a branch that already belongs to it.
  if (branchId) {
    const existing = await getBranch(branchId);
    if (!existing) return { error: "That branch no longer exists." };
    await requireScope(existing.COMPANY_ID);
  } else {
    await requireScope(input.companyId);
  }

  try {
    if (branchId) {
      await updateBranch(branchId, input);
    } else {
      await createBranch(input);
    }
  } catch (e) {
    return {
      error: describeOracleError(e, "The branch could not be saved."),
      values: submittedValues(formData),
    };
  }

  revalidatePath("/admin/branches");
  redirect("/admin/branches");
}
