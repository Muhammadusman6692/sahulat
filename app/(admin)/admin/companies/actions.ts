"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/dal";
import {
  createCompany,
  updateCompany,
  setCompanyActive,
  type CompanyInput,
} from "@/lib/db/companies";
import { describeOracleError } from "@/lib/db/errors";

const schema = z.object({
  companyCode: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(10, "Code cannot exceed 10 characters")
    .regex(/^[A-Za-z0-9_-]+$/, "Use letters, digits, hyphen or underscore only"),
  companyName: z.string().trim().min(1, "Name is required").max(200),
  ntnNo: z.string().trim().max(30).optional(),
  strnNo: z.string().trim().max(30).optional(),
  address: z.string().trim().max(400).optional(),
  fyStartMonth: z.coerce.number().int().min(1).max(12),
  baseCurrency: z
    .string()
    .trim()
    .length(3, "Use a 3-letter currency code")
    .transform((v) => v.toUpperCase()),
  activeYn: z.enum(["Y", "N"]),
});

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  /**
   * What the user had typed. React resets uncontrolled fields once a form
   * action returns, so without echoing these back a failed save would wipe the
   * form.
   */
  values?: Record<string, string>;
};

function submittedValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

function parse(formData: FormData) {
  return schema.safeParse({
    companyCode: formData.get("companyCode"),
    companyName: formData.get("companyName"),
    ntnNo: formData.get("ntnNo"),
    strnNo: formData.get("strnNo"),
    address: formData.get("address"),
    fyStartMonth: formData.get("fyStartMonth"),
    baseCurrency: formData.get("baseCurrency"),
    activeYn: formData.get("activeYn") === "on" ? "Y" : "N",
  });
}

function toInput(data: z.infer<typeof schema>): CompanyInput {
  return {
    companyCode: data.companyCode,
    companyName: data.companyName,
    ntnNo: data.ntnNo || null,
    strnNo: data.strnNo || null,
    address: data.address || null,
    fyStartMonth: data.fyStartMonth,
    baseCurrency: data.baseCurrency,
    activeYn: data.activeYn,
  };
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

export async function saveCompany(
  companyId: number | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // Re-checked inside the action: a Server Action posts to its own route, so
  // it can be reached without the page's own check having run.
  const user = await requirePermission(
    "COMPANY_MAINT",
    companyId ? "EDIT" : "CREATE",
  );

  const parsed = parse(formData);
  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
      values: submittedValues(formData),
    };
  }

  try {
    if (companyId) {
      await updateCompany(companyId, toInput(parsed.data));
    } else {
      await createCompany(toInput(parsed.data), user.userId);
    }
  } catch (e) {
    console.error("saveCompany failed:", e);
    return {
      error: describeOracleError(e, "The company could not be saved."),
      values: submittedValues(formData),
    };
  }

  revalidatePath("/admin/companies");
  redirect("/admin/companies");
}

export async function toggleCompanyActive(companyId: number, active: boolean) {
  await requirePermission("COMPANY_MAINT", "EDIT");
  await setCompanyActive(companyId, active);
  revalidatePath("/admin/companies");
}
