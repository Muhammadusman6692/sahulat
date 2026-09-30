"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission, requireScope } from "@/lib/dal";
import {
  createCoaAccount,
  updateCoaAccount,
  getCoaAccount,
  type CoaInput,
} from "@/lib/db/coa";
import { describeOracleError } from "@/lib/db/errors";

const natureEnum = z.enum(["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]);
const sideEnum = z.enum(["D", "C"]);
const controlEnum = z.enum(["CUSTOMER", "SUPPLIER", "CASH", "BANK", ""]);

const baseFields = {
  accountCode: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(20, "Cannot exceed 20 characters"),
  accountName: z.string().trim().min(1, "Name is required").max(200),
  accountNature: natureEnum,
  normalSide: sideEnum,
  isControlAc: controlEnum,
  costCenterRequired: z.enum(["Y", "N"]),
  activeYn: z.enum(["Y", "N"]),
};

const newSchema = z.object({
  ...baseFields,
  companyId: z.coerce.number().int().positive("Choose a company"),
  // Empty string means "top-level Group (level 1)".
  parentId: z.string(),
});

const editSchema = z.object(baseFields);

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

function readForm(formData: FormData) {
  return {
    accountCode: formData.get("accountCode"),
    accountName: formData.get("accountName"),
    accountNature: formData.get("accountNature"),
    normalSide: formData.get("normalSide"),
    isControlAc: formData.get("isControlAc") ?? "",
    costCenterRequired: formData.get("costCenterRequired") === "on" ? "Y" : "N",
    activeYn: formData.get("activeYn") === "on" ? "Y" : "N",
  };
}

export async function createCoaAccountAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requirePermission("COA_MAINT", "CREATE");

  const parsed = newSchema.safeParse({
    ...readForm(formData),
    companyId: formData.get("companyId"),
    parentId: formData.get("parentId") ?? "",
  });

  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
      values: submittedValues(formData),
    };
  }

  const { companyId, parentId, ...rest } = parsed.data;
  await requireScope(companyId);

  let parentIdNum: number | null = null;
  let accountLevel = 1;

  if (parentId) {
    parentIdNum = Number(parentId);
    if (!Number.isInteger(parentIdNum) || parentIdNum <= 0) {
      return {
        error: "Choose a valid parent.",
        values: submittedValues(formData),
      };
    }
    const parent = await getCoaAccount(parentIdNum);
    if (!parent || parent.COMPANY_ID !== companyId) {
      return {
        error: "That parent account does not belong to this company.",
        values: submittedValues(formData),
      };
    }
    if (parent.ACCOUNT_LEVEL >= 4) {
      return {
        error: "A posting account (level 4) cannot have children.",
        values: submittedValues(formData),
      };
    }
    accountLevel = parent.ACCOUNT_LEVEL + 1;
  }

  const input: CoaInput = {
    companyId,
    parentId: parentIdNum,
    accountLevel,
    accountCode: rest.accountCode,
    accountName: rest.accountName,
    accountNature: rest.accountNature,
    normalSide: rest.normalSide,
    isControlAc: rest.isControlAc || null,
    costCenterRequired: rest.costCenterRequired,
    activeYn: rest.activeYn,
  };

  try {
    await createCoaAccount(input);
  } catch (e) {
    return {
      error: describeOracleError(e, "The account could not be created."),
      values: submittedValues(formData),
    };
  }

  revalidatePath("/admin/coa");
  redirect("/admin/coa");
}

export async function updateCoaAccountAction(
  coaId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const existing = await getCoaAccount(coaId);
  if (!existing) return { error: "That account no longer exists." };

  await requirePermission("COA_MAINT", "EDIT");
  await requireScope(existing.COMPANY_ID);

  const parsed = editSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
      values: submittedValues(formData),
    };
  }

  try {
    await updateCoaAccount(coaId, {
      accountCode: parsed.data.accountCode,
      accountName: parsed.data.accountName,
      accountNature: parsed.data.accountNature,
      normalSide: parsed.data.normalSide,
      isControlAc: parsed.data.isControlAc || null,
      costCenterRequired: parsed.data.costCenterRequired,
      activeYn: parsed.data.activeYn,
    });
  } catch (e) {
    return {
      error: describeOracleError(e, "The account could not be saved."),
      values: submittedValues(formData),
    };
  }

  revalidatePath("/admin/coa");
  redirect("/admin/coa");
}
