"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission, requireScope } from "@/lib/dal";
import { createCategory, updateCategory, getCategory } from "@/lib/db/item-categories";
import { describeOracleError } from "@/lib/db/errors";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

const nameSchema = z.string().trim().min(1, "Required").max(100, "Cannot exceed 100 characters");

export async function createCategoryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requirePermission("ITEM_CAT_MAINT", "CREATE");
  const companyId = user.access[0]?.companyId;
  if (!companyId) return { error: "Your account is not scoped to any company." };
  await requireScope(companyId);

  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  }

  try {
    await createCategory(companyId, parsed.data);
  } catch (e) {
    return { error: describeOracleError(e, "The category could not be added.") };
  }

  revalidatePath("/admin/item-categories");
  return {};
}

export async function updateCategoryAction(
  categoryId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const existing = await getCategory(categoryId);
  if (!existing) return { error: "That category no longer exists." };

  await requirePermission("ITEM_CAT_MAINT", "EDIT");
  await requireScope(existing.COMPANY_ID);

  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  }

  try {
    await updateCategory(categoryId, parsed.data);
  } catch (e) {
    return { error: describeOracleError(e, "The category could not be saved.") };
  }

  revalidatePath("/admin/item-categories");
  return {};
}
