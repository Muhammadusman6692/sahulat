"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission, requireScope } from "@/lib/dal";
import {
  createAuthority,
  updateAuthority,
  createTaxCode,
  updateTaxCode,
  getTaxCode,
} from "@/lib/db/tax";
import { describeOracleError } from "@/lib/db/errors";

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

const authoritySchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Required")
    .max(10, "Cannot exceed 10 characters")
    .regex(/^[A-Z0-9_]+$/, "Use letters, digits and underscore only"),
  name: z.string().trim().min(1, "Required").max(100, "Cannot exceed 100 characters"),
});

export async function createAuthorityAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requirePermission("TAX_MAINT", "CREATE");

  const parsed = authoritySchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  }

  try {
    await createAuthority(parsed.data.code, parsed.data.name);
  } catch (e) {
    return { error: describeOracleError(e, "The authority could not be added.") };
  }

  revalidatePath("/admin/tax");
  return {};
}

export async function renameAuthorityAction(
  code: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requirePermission("TAX_MAINT", "EDIT");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };
  if (name.length > 100) return { error: "Cannot exceed 100 characters." };

  try {
    await updateAuthority(code, name);
  } catch (e) {
    return { error: describeOracleError(e, "The authority could not be renamed.") };
  }

  revalidatePath("/admin/tax");
  return {};
}

const taxCodeFields = {
  authorityCode: z.string().trim().min(1, "Choose an authority"),
  taxName: z.string().trim().min(1, "Required").max(100, "Cannot exceed 100 characters"),
  taxRate: z.coerce.number().min(0, "Cannot be negative").max(100, "Cannot exceed 100"),
  taxType: z.enum(["SALES_TAX", "WITHHOLDING", "FURTHER_TAX", "EXTRA_TAX"]),
  taxCoaId: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null)),
  activeYn: z.enum(["Y", "N"]),
};

const newTaxCodeSchema = z.object({
  ...taxCodeFields,
  taxCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Required")
    .max(20, "Cannot exceed 20 characters")
    .regex(/^[A-Z0-9_-]+$/, "Use letters, digits, underscore and dash only"),
});

const editTaxCodeSchema = z.object(taxCodeFields);

function readTaxCodeFields(formData: FormData) {
  return {
    authorityCode: formData.get("authorityCode"),
    taxName: formData.get("taxName"),
    taxRate: formData.get("taxRate"),
    taxType: formData.get("taxType"),
    taxCoaId: formData.get("taxCoaId") || undefined,
    activeYn: formData.get("activeYn") === "on" ? "Y" : "N",
  };
}

export async function createTaxCodeAction(
  companyId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requirePermission("TAX_MAINT", "CREATE");
  await requireScope(companyId);

  const parsed = newTaxCodeSchema.safeParse({
    ...readTaxCodeFields(formData),
    taxCode: formData.get("taxCode"),
  });
  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
      values: submittedValues(formData),
    };
  }

  const { taxCode, ...fields } = parsed.data;

  try {
    await createTaxCode(companyId, taxCode, fields);
  } catch (e) {
    return {
      error: describeOracleError(e, "The tax code could not be created."),
      values: submittedValues(formData),
    };
  }

  revalidatePath("/admin/tax");
  redirect("/admin/tax");
}

export async function updateTaxCodeAction(
  taxId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const existing = await getTaxCode(taxId);
  if (!existing) return { error: "That tax code no longer exists." };

  await requirePermission("TAX_MAINT", "EDIT");
  await requireScope(existing.COMPANY_ID);

  const parsed = editTaxCodeSchema.safeParse(readTaxCodeFields(formData));
  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
      values: submittedValues(formData),
    };
  }

  try {
    await updateTaxCode(taxId, parsed.data);
  } catch (e) {
    return {
      error: describeOracleError(e, "The tax code could not be saved."),
      values: submittedValues(formData),
    };
  }

  revalidatePath("/admin/tax");
  redirect("/admin/tax");
}
