"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission, requireScope } from "@/lib/dal";
import {
  createFiscalYear,
  renameFiscalYear,
  setPeriodStatus,
  setFiscalYearStatus,
  getFiscalYear,
  listCompanyFiscalYears,
} from "@/lib/db/fiscal";
import { buildPeriods, fiscalYearEnd, rangesOverlap } from "@/lib/fiscal-calendar";
import { describeOracleError } from "@/lib/db/errors";

const newSchema = z.object({
  companyId: z.coerce.number().int().positive("Choose a company"),
  fyName: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(20, "Cannot exceed 20 characters"),
  startDate: z.coerce.date({ message: "Choose a start date" }),
});

export type NewFormState = {
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

export async function createFiscalYearAction(
  _prev: NewFormState,
  formData: FormData,
): Promise<NewFormState> {
  await requirePermission("FISCAL_MAINT", "CREATE");

  const parsed = newSchema.safeParse({
    companyId: formData.get("companyId"),
    fyName: formData.get("fyName"),
    startDate: formData.get("startDate"),
  });

  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
      values: submittedValues(formData),
    };
  }

  const { companyId, fyName, startDate } = parsed.data;
  await requireScope(companyId);

  const endDate = fiscalYearEnd(startDate);

  // A voucher's period lookup matches on date range alone; an overlapping
  // fiscal year would make that lookup ambiguous, so this is checked before
  // anything is written rather than relying on the unique fy_name constraint.
  const existing = await listCompanyFiscalYears(companyId);
  const overlap = existing.some((fy) =>
    rangesOverlap(startDate, endDate, fy.START_DATE, fy.END_DATE),
  );
  if (overlap) {
    return {
      error:
        "That date range overlaps an existing fiscal year for this company.",
      values: submittedValues(formData),
    };
  }

  try {
    await createFiscalYear({
      companyId,
      fyName,
      startDate,
      endDate,
      periods: buildPeriods(startDate),
    });
  } catch (e) {
    return {
      error: describeOracleError(e, "The fiscal year could not be created."),
      values: submittedValues(formData),
    };
  }

  revalidatePath("/admin/fiscal-years");
  redirect("/admin/fiscal-years");
}

export async function renameFiscalYearAction(fyId: number, fyName: string) {
  const fy = await getFiscalYear(fyId);
  if (!fy) throw new Error("That fiscal year no longer exists.");
  await requirePermission("FISCAL_MAINT", "EDIT");
  await requireScope(fy.COMPANY_ID);

  const trimmed = fyName.trim();
  if (!trimmed || trimmed.length > 20) {
    throw new Error("Name must be 1–20 characters.");
  }

  await renameFiscalYear(fyId, trimmed);
  revalidatePath(`/admin/fiscal-years/${fyId}`);
  revalidatePath("/admin/fiscal-years");
}

/**
 * The control that actually matters operationally: pkg_gl.create_voucher
 * refuses to post into a closed period, so this toggle is what closing the
 * books really does. Gated on PERIOD_CLOSE/APPROVE rather than FISCAL_MAINT,
 * matching the original REST contract's intent that closing a period is a
 * distinct, more sensitive action than fiscal-year maintenance.
 */
export async function togglePeriodStatusAction(
  periodId: number,
  fyId: number,
  nextStatus: "OPEN" | "CLOSED",
) {
  const fy = await getFiscalYear(fyId);
  if (!fy) throw new Error("That fiscal year no longer exists.");
  await requirePermission("PERIOD_CLOSE", "APPROVE");
  await requireScope(fy.COMPANY_ID);

  await setPeriodStatus(periodId, nextStatus);
  revalidatePath(`/admin/fiscal-years/${fyId}`);
  revalidatePath("/admin/fiscal-years");
}

export async function toggleFiscalYearStatusAction(
  fyId: number,
  nextStatus: "OPEN" | "CLOSED",
) {
  const fy = await getFiscalYear(fyId);
  if (!fy) throw new Error("That fiscal year no longer exists.");
  await requirePermission("PERIOD_CLOSE", "APPROVE");
  await requireScope(fy.COMPANY_ID);

  try {
    await setFiscalYearStatus(fyId, nextStatus);
  } catch (e) {
    throw new Error(
      e instanceof Error ? e.message : "The fiscal year status could not be changed.",
    );
  }
  revalidatePath(`/admin/fiscal-years/${fyId}`);
  revalidatePath("/admin/fiscal-years");
}
