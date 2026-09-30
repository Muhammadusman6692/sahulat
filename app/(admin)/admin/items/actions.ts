"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission, requireScope } from "@/lib/dal";
import {
  createItem,
  updateItem,
  getItem,
  getCurrentOpenPrice,
  addItemPrice,
  type ItemInput,
} from "@/lib/db/items";
import { describeOracleError } from "@/lib/db/errors";

const optionalId = z
  .string()
  .optional()
  .transform((v) => (v ? Number(v) : null));

const itemFields = {
  itemCode: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(30, "Cannot exceed 30 characters"),
  itemName: z.string().trim().min(1, "Name is required").max(200),
  categoryId: optionalId,
  brandId: optionalId,
  uomCode: z.string().trim().min(1, "Choose a unit of measure"),
  barcode: z.string().trim().max(50).optional(),
  reorderLevel: z.coerce.number().min(0, "Cannot be negative").default(0),
  taxId: optionalId,
  activeYn: z.enum(["Y", "N"]),
};

const newSchema = z.object({
  ...itemFields,
  companyId: z.coerce.number().int().positive("Choose a company"),
  salePrice: z.coerce.number().min(0, "Cannot be negative"),
  effectiveFrom: z.coerce.date({ message: "Choose a start date" }),
});

const editSchema = z.object(itemFields);

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

function readItemForm(formData: FormData) {
  return {
    itemCode: formData.get("itemCode"),
    itemName: formData.get("itemName"),
    categoryId: formData.get("categoryId") || undefined,
    brandId: formData.get("brandId") || undefined,
    uomCode: formData.get("uomCode"),
    barcode: formData.get("barcode"),
    reorderLevel: formData.get("reorderLevel"),
    taxId: formData.get("taxId") || undefined,
    activeYn: formData.get("activeYn") === "on" ? "Y" : "N",
  };
}

export async function createItemAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requirePermission("ITEM_MAINT", "CREATE");

  const parsed = newSchema.safeParse({
    ...readItemForm(formData),
    companyId: formData.get("companyId"),
    salePrice: formData.get("salePrice"),
    effectiveFrom: formData.get("effectiveFrom"),
  });

  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
      values: submittedValues(formData),
    };
  }

  const { companyId, salePrice, effectiveFrom, ...rest } = parsed.data;
  await requireScope(companyId);

  const input: ItemInput = {
    companyId,
    itemCode: rest.itemCode,
    itemName: rest.itemName,
    categoryId: rest.categoryId,
    brandId: rest.brandId,
    uomCode: rest.uomCode,
    barcode: rest.barcode || null,
    reorderLevel: rest.reorderLevel,
    taxId: rest.taxId,
    activeYn: rest.activeYn,
  };

  try {
    await createItem(input, salePrice, effectiveFrom);
  } catch (e) {
    return {
      error: describeOracleError(e, "The item could not be created."),
      values: submittedValues(formData),
    };
  }

  revalidatePath("/admin/items");
  redirect("/admin/items");
}

export async function updateItemAction(
  itemId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const existing = await getItem(itemId);
  if (!existing) return { error: "That item no longer exists." };

  await requirePermission("ITEM_MAINT", "EDIT");
  await requireScope(existing.COMPANY_ID);

  const parsed = editSchema.safeParse(readItemForm(formData));
  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
      values: submittedValues(formData),
    };
  }

  try {
    await updateItem(itemId, {
      itemCode: parsed.data.itemCode,
      itemName: parsed.data.itemName,
      categoryId: parsed.data.categoryId,
      brandId: parsed.data.brandId,
      uomCode: parsed.data.uomCode,
      barcode: parsed.data.barcode || null,
      reorderLevel: parsed.data.reorderLevel,
      taxId: parsed.data.taxId,
      activeYn: parsed.data.activeYn,
    });
  } catch (e) {
    return {
      error: describeOracleError(e, "The item could not be saved."),
      values: submittedValues(formData),
    };
  }

  revalidatePath("/admin/items");
  revalidatePath(`/admin/items/${itemId}`);
  redirect(`/admin/items/${itemId}`);
}

const priceSchema = z.object({
  salePrice: z.coerce.number().min(0, "Cannot be negative"),
  effectiveFrom: z.coerce.date({ message: "Choose a start date" }),
});

export type PriceFormState = { error?: string };

/**
 * Never touches an existing item_price row's sale_price — only closes its
 * effective_to and opens a new row, so history stays intact.
 */
export async function addItemPriceAction(
  itemId: number,
  _prev: PriceFormState,
  formData: FormData,
): Promise<PriceFormState> {
  const item = await getItem(itemId);
  if (!item) return { error: "That item no longer exists." };

  const user = await requirePermission("ITEM_MAINT", "EDIT");
  await requireScope(item.COMPANY_ID);

  const parsed = priceSchema.safeParse({
    salePrice: formData.get("salePrice"),
    effectiveFrom: formData.get("effectiveFrom"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the price and date." };
  }

  const current = await getCurrentOpenPrice(itemId);
  if (current && parsed.data.effectiveFrom <= current.EFFECTIVE_FROM) {
    return {
      error: `The new price must take effect after the current price's start date (${current.EFFECTIVE_FROM.toISOString().slice(0, 10)}).`,
    };
  }

  try {
    await addItemPrice(
      item.COMPANY_ID,
      itemId,
      parsed.data.salePrice,
      parsed.data.effectiveFrom,
      user.userId,
    );
  } catch (e) {
    return { error: describeOracleError(e, "The price could not be saved.") };
  }

  revalidatePath(`/admin/items/${itemId}`);
  revalidatePath("/admin/items");
  return {};
}
