"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission, requireScope } from "@/lib/dal";
import {
  createSeries,
  updateSeries,
  getSeries,
  type SeriesIdentity,
  type SeriesSettings,
} from "@/lib/db/numbering";
import { describeOracleError } from "@/lib/db/errors";

const optionalId = z
  .string()
  .optional()
  .transform((v) => (v ? Number(v) : null));

const settingsFields = {
  prefix: z.string().trim().max(15).optional(),
  nextNumber: z.coerce.number().int().min(1, "Must be at least 1"),
  padLength: z.coerce.number().int().min(1, "Must be at least 1").max(15),
  resetYearly: z.enum(["Y", "N"]),
  fyId: optionalId,
};

const newSchema = z.object({
  ...settingsFields,
  companyId: z.coerce.number().int().positive("Choose a company"),
  branchId: optionalId,
  terminalId: optionalId,
  docType: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Document type is required")
    .max(15, "Cannot exceed 15 characters")
    .regex(/^[A-Z0-9_]+$/, "Use letters, digits and underscore only"),
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
    prefix: formData.get("prefix"),
    nextNumber: formData.get("nextNumber"),
    padLength: formData.get("padLength"),
    resetYearly: formData.get("resetYearly") === "on" ? "Y" : "N",
    fyId: formData.get("fyId") || undefined,
  };
}

export async function createSeriesAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requirePermission("NUMBERING_MAINT", "CREATE");

  const parsed = newSchema.safeParse({
    ...readSettings(formData),
    companyId: formData.get("companyId"),
    branchId: formData.get("branchId") || undefined,
    terminalId: formData.get("terminalId") || undefined,
    docType: formData.get("docType"),
  });

  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
      values: submittedValues(formData),
    };
  }

  const { companyId, branchId, terminalId, docType, ...settings } = parsed.data;
  await requireScope(companyId, branchId);

  const identity: SeriesIdentity = { companyId, branchId, terminalId, docType };
  const settingsInput: SeriesSettings = {
    prefix: settings.prefix || null,
    nextNumber: settings.nextNumber,
    padLength: settings.padLength,
    resetYearly: settings.resetYearly,
    fyId: settings.fyId,
  };

  try {
    await createSeries(identity, settingsInput);
  } catch (e) {
    return {
      error: describeOracleError(e, "The numbering series could not be created."),
      values: submittedValues(formData),
    };
  }

  revalidatePath("/admin/numbering-series");
  redirect("/admin/numbering-series");
}

export async function updateSeriesAction(
  seriesId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const existing = await getSeries(seriesId);
  if (!existing) return { error: "That numbering series no longer exists." };

  await requirePermission("NUMBERING_MAINT", "EDIT");
  await requireScope(existing.COMPANY_ID, existing.BRANCH_ID);

  const parsed = editSchema.safeParse(readSettings(formData));
  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
      values: submittedValues(formData),
    };
  }

  try {
    await updateSeries(seriesId, {
      prefix: parsed.data.prefix || null,
      nextNumber: parsed.data.nextNumber,
      padLength: parsed.data.padLength,
      resetYearly: parsed.data.resetYearly,
      fyId: parsed.data.fyId,
    });
  } catch (e) {
    return {
      error: describeOracleError(e, "The numbering series could not be saved."),
      values: submittedValues(formData),
    };
  }

  revalidatePath("/admin/numbering-series");
  redirect("/admin/numbering-series");
}
