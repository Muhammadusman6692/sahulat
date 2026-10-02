"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, requireScope } from "@/lib/dal";
import { getFiscalYear } from "@/lib/db/fiscal";
import { closePeriod, reopenPeriod } from "@/lib/db/period-close";
import { describeOracleError } from "@/lib/db/errors";

async function scopeToPeriod(fyId: number) {
  const fy = await getFiscalYear(fyId);
  if (!fy) throw new Error("That fiscal year no longer exists.");
  const user = await requirePermission("PERIOD_CLOSE", "APPROVE");
  await requireScope(fy.COMPANY_ID);
  return user;
}

export async function closePeriodAction(
  periodId: number,
  fyId: number,
): Promise<{ error?: string }> {
  const user = await scopeToPeriod(fyId);
  try {
    await closePeriod(periodId, user.userId, null);
  } catch (e) {
    return { error: describeOracleError(e, "The period could not be closed.") };
  }
  revalidatePath("/admin/period-close");
  return {};
}

export async function reopenPeriodAction(
  periodId: number,
  fyId: number,
  reason: string,
): Promise<{ error?: string }> {
  const trimmed = reason.trim();
  if (!trimmed) return { error: "A reason is required to reopen a period." };

  const user = await scopeToPeriod(fyId);
  try {
    await reopenPeriod(periodId, user.userId, trimmed);
  } catch (e) {
    return { error: describeOracleError(e, "The period could not be reopened.") };
  }
  revalidatePath("/admin/period-close");
  return {};
}
