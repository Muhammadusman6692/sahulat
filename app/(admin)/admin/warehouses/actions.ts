"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission, requireScope } from "@/lib/dal";
import {
  createWarehouse,
  updateWarehouse,
  getWarehouse,
  type WarehouseInput,
} from "@/lib/db/warehouses";
import { describeOracleError } from "@/lib/db/errors";

const schema = z.object({
  companyId: z.coerce.number().int().positive("Choose a company"),
  branchId: z.coerce.number().int().positive("Choose an owning branch"),
  warehouseCode: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(10, "Code cannot exceed 10 characters")
    .regex(/^[A-Za-z0-9_-]+$/, "Use letters, digits, hyphen or underscore only"),
  warehouseName: z.string().trim().min(1, "Name is required").max(200),
  isShared: z.enum(["Y", "N"]),
  activeYn: z.enum(["Y", "N"]),
});

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  linked?: number[];
};

function submittedValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && key !== "linkedBranchIds") out[key] = value;
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

export async function saveWarehouse(
  warehouseId: number | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requirePermission("WAREHOUSE_MAINT", warehouseId ? "EDIT" : "CREATE");

  const parsed = schema.safeParse({
    companyId: formData.get("companyId"),
    branchId: formData.get("branchId"),
    warehouseCode: formData.get("warehouseCode"),
    warehouseName: formData.get("warehouseName"),
    isShared: formData.get("isShared") === "on" ? "Y" : "N",
    activeYn: formData.get("activeYn") === "on" ? "Y" : "N",
  });

  const submittedLinks = formData
    .getAll("linkedBranchIds")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);

  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
      values: submittedValues(formData),
      linked: submittedLinks,
    };
  }

  // The owning branch always has access, whether or not it was ticked, and a
  // warehouse that is not shared is linked to that branch alone.
  const linkedBranchIds =
    parsed.data.isShared === "Y"
      ? [...new Set([parsed.data.branchId, ...submittedLinks])]
      : [parsed.data.branchId];

  const input: WarehouseInput = {
    companyId: parsed.data.companyId,
    branchId: parsed.data.branchId,
    warehouseCode: parsed.data.warehouseCode,
    warehouseName: parsed.data.warehouseName,
    isShared: parsed.data.isShared,
    activeYn: parsed.data.activeYn,
    linkedBranchIds,
  };

  if (warehouseId) {
    const existing = await getWarehouse(warehouseId);
    if (!existing) return { error: "That warehouse no longer exists." };
    await requireScope(existing.COMPANY_ID, existing.BRANCH_ID);
    input.companyId = existing.COMPANY_ID;
    input.branchId = existing.BRANCH_ID;
  } else {
    await requireScope(input.companyId, input.branchId);
  }

  try {
    if (warehouseId) {
      await updateWarehouse(warehouseId, input);
    } else {
      await createWarehouse(input);
    }
  } catch (e) {
    console.error("saveWarehouse failed:", e);
    return {
      error: describeOracleError(e, "The warehouse could not be saved."),
      values: submittedValues(formData),
      linked: submittedLinks,
    };
  }

  revalidatePath("/admin/warehouses");
  redirect("/admin/warehouses");
}
