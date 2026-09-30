"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission, requireScope } from "@/lib/dal";
import { createParty, updateParty, getParty, type PartyInput } from "@/lib/db/parties";
import { describeOracleError } from "@/lib/db/errors";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

const partyFields = {
  partyCode: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(20, "Cannot exceed 20 characters"),
  partyName: z.string().trim().min(1, "Name is required").max(200),
  ntnNo: optionalText(30),
  strnNo: optionalText(30),
  phone: optionalText(20),
  address: optionalText(400),
  creditLimit: z.coerce.number().min(0, "Cannot be negative").default(0),
  creditDays: z.coerce.number().int().min(0, "Cannot be negative").default(0),
  isCustomer: z.enum(["Y", "N"]),
  isSupplier: z.enum(["Y", "N"]),
  activeYn: z.enum(["Y", "N"]),
};

const newSchema = z
  .object({ ...partyFields, companyId: z.coerce.number().int().positive("Choose a company") })
  .refine((v) => v.isCustomer === "Y" || v.isSupplier === "Y", {
    message: "Select Customer, Supplier, or both.",
    path: ["isCustomer"],
  });

const editSchema = z
  .object(partyFields)
  .refine((v) => v.isCustomer === "Y" || v.isSupplier === "Y", {
    message: "Select Customer, Supplier, or both.",
    path: ["isCustomer"],
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

function readPartyForm(formData: FormData) {
  return {
    partyCode: formData.get("partyCode"),
    partyName: formData.get("partyName"),
    ntnNo: formData.get("ntnNo"),
    strnNo: formData.get("strnNo"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    creditLimit: formData.get("creditLimit"),
    creditDays: formData.get("creditDays"),
    isCustomer: formData.get("isCustomer") === "on" ? "Y" : "N",
    isSupplier: formData.get("isSupplier") === "on" ? "Y" : "N",
    activeYn: formData.get("activeYn") === "on" ? "Y" : "N",
  };
}

export async function createPartyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requirePermission("PARTY_MAINT", "CREATE");

  const parsed = newSchema.safeParse({
    ...readPartyForm(formData),
    companyId: formData.get("companyId"),
  });

  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
      values: submittedValues(formData),
    };
  }

  const { companyId, ...rest } = parsed.data;
  await requireScope(companyId);

  const input: PartyInput = { companyId, ...rest };

  try {
    await createParty(input);
  } catch (e) {
    return {
      error: describeOracleError(e, "The party could not be created."),
      values: submittedValues(formData),
    };
  }

  revalidatePath("/admin/parties");
  redirect("/admin/parties");
}

export async function updatePartyAction(
  partyId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const existing = await getParty(partyId);
  if (!existing) return { error: "That party no longer exists." };

  await requirePermission("PARTY_MAINT", "EDIT");
  await requireScope(existing.COMPANY_ID);

  const parsed = editSchema.safeParse(readPartyForm(formData));
  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
      values: submittedValues(formData),
    };
  }

  try {
    await updateParty(partyId, existing, parsed.data);
  } catch (e) {
    return {
      error: describeOracleError(e, "The party could not be saved."),
      values: submittedValues(formData),
    };
  }

  revalidatePath("/admin/parties");
  revalidatePath(`/admin/parties/${partyId}`);
  redirect(`/admin/parties/${partyId}`);
}
