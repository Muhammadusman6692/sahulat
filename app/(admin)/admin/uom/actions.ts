"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/dal";
import { createUom, updateUom } from "@/lib/db/uom";
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

const uomSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Required")
    .max(10, "Cannot exceed 10 characters")
    .regex(/^[A-Z0-9_]+$/, "Use letters, digits and underscore only"),
  name: z.string().trim().min(1, "Required").max(50, "Cannot exceed 50 characters"),
  allowDecimal: z.enum(["Y", "N"]),
});

export async function createUomAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requirePermission("UOM_MAINT", "CREATE");

  const parsed = uomSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    allowDecimal: formData.get("allowDecimal") === "on" ? "Y" : "N",
  });
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  }

  try {
    await createUom(parsed.data.code, parsed.data.name, parsed.data.allowDecimal);
  } catch (e) {
    return { error: describeOracleError(e, "The unit could not be added.") };
  }

  revalidatePath("/admin/uom");
  return {};
}

export async function updateUomAction(
  code: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requirePermission("UOM_MAINT", "EDIT");

  const parsed = z
    .object({
      name: z.string().trim().min(1, "Required").max(50, "Cannot exceed 50 characters"),
      allowDecimal: z.enum(["Y", "N"]),
    })
    .safeParse({
      name: formData.get("name"),
      allowDecimal: formData.get("allowDecimal") === "on" ? "Y" : "N",
    });
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  }

  try {
    await updateUom(code, parsed.data.name, parsed.data.allowDecimal);
  } catch (e) {
    return { error: describeOracleError(e, "The unit could not be saved.") };
  }

  revalidatePath("/admin/uom");
  return {};
}
