"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission, requireScope } from "@/lib/dal";
import { createBrand, updateBrand, getBrand } from "@/lib/db/item-brand";
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

const nameSchema = z.object({
  name: z.string().trim().min(1, "Required").max(100, "Cannot exceed 100 characters"),
});

export async function createBrandAction(
  companyId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requirePermission("ITEM_BRAND_MAINT", "CREATE");
  await requireScope(companyId);

  const parsed = nameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  }

  try {
    await createBrand(companyId, parsed.data.name);
  } catch (e) {
    return { error: describeOracleError(e, "The brand could not be added.") };
  }

  revalidatePath("/admin/item-brands");
  return {};
}

export async function updateBrandAction(
  brandId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const existing = await getBrand(brandId);
  if (!existing) return { error: "That brand no longer exists." };

  await requirePermission("ITEM_BRAND_MAINT", "EDIT");
  await requireScope(existing.COMPANY_ID);

  const parsed = nameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  }

  try {
    await updateBrand(brandId, parsed.data.name);
  } catch (e) {
    return { error: describeOracleError(e, "The brand could not be saved.") };
  }

  revalidatePath("/admin/item-brands");
  return {};
}
