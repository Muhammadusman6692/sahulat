"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission, requireScope } from "@/lib/dal";
import { getActiveCompanyId } from "@/lib/active-scope";
import { listPostableAccounts } from "@/lib/db/coa";
import { getPartyIdsByLedgerCoaIds } from "@/lib/db/parties";
import {
  createCashVoucherDraft,
  updateCashVoucherDraft,
  deleteCashVoucherDraft,
  postCashVoucher,
  cancelPostedCashVoucher,
  getCashVoucher,
  type CvType,
  type CvFreeLineInput,
} from "@/lib/db/cash-vouchers";
import { describeOracleError } from "@/lib/db/errors";

const lineSchema = z.object({
  coaId: z.coerce.number().int().positive("Select an account for every line."),
  narration: z.string().trim().max(400).nullable(),
  amount: z.coerce.number().positive("Each line needs an amount greater than zero."),
});

type LineDraft = Omit<CvFreeLineInput, "partyId">;

const linesArraySchema = z.array(lineSchema).min(1, "A voucher needs at least one line.");

const headerSchema = z.object({
  branchId: z.coerce.number().int().positive("Choose a branch."),
  voucherDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a voucher date."),
  cashCoaId: z.coerce.number().int().positive("Choose a cash account."),
  narration: z.string().trim().min(1, "Narration is required.").max(400),
});

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

/**
 * Re-validates against the live COA, never the client's copy: the cash
 * account must still be a CASH control account, and no free leg may be
 * coded to a CASH or BANK control account (that would be a contra entry,
 * out of scope for this module). Party is derived straight from a
 * Customer/Supplier free-leg account, same as Journal Voucher — there is no
 * separate party field to trust or mismatch.
 */
async function resolveFreeLines(
  companyId: number,
  cashCoaId: number,
  lines: LineDraft[],
): Promise<{ lines?: CvFreeLineInput[]; error?: string }> {
  const accounts = await listPostableAccounts(companyId);
  const controlType = new Map(accounts.map((a) => [a.COA_ID, a.IS_CONTROL_AC]));

  if (controlType.get(cashCoaId) !== "CASH") {
    return { error: "The selected cash account is no longer valid — choose a cash account." };
  }

  const partyCoaIds = lines
    .map((l) => l.coaId)
    .filter((coaId) => {
      const type = controlType.get(coaId);
      return type === "CUSTOMER" || type === "SUPPLIER";
    });
  const partyByCoaId = await getPartyIdsByLedgerCoaIds(companyId, partyCoaIds);

  const resolved: CvFreeLineInput[] = [];
  for (const l of lines) {
    if (!controlType.has(l.coaId)) return { error: "One of the selected accounts is no longer valid." };
    if (l.coaId === cashCoaId) {
      return { error: "A line cannot be coded to the same cash account used for this voucher." };
    }
    const type = controlType.get(l.coaId);
    if (type === "CASH" || type === "BANK") {
      return { error: "A line cannot be coded to a cash or bank account — that would be a contra entry." };
    }
    const needsParty = type === "CUSTOMER" || type === "SUPPLIER";
    if (!needsParty) {
      resolved.push({ ...l, partyId: null });
      continue;
    }
    const partyId = partyByCoaId.get(l.coaId) ?? null;
    if (!partyId) {
      return {
        error: `No party is linked to the selected ${type.toLowerCase()} account — contact an administrator.`,
      };
    }
    resolved.push({ ...l, partyId });
  }
  return { lines: resolved };
}

function parseLines(formData: FormData): { lines?: LineDraft[]; total?: number; error?: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("linesJson") ?? "[]"));
  } catch {
    return { error: "The lines grid could not be read — please try again." };
  }

  const parsed = linesArraySchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the lines grid." };
  }

  const total = Math.round(parsed.data.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  return {
    lines: parsed.data.map((l) => ({ ...l, narration: l.narration || null })),
    total,
  };
}

export async function createDraftAction(
  voucherType: CvType,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requirePermission("CASH_VOUCHER", "CREATE");
  const companyId = await getActiveCompanyId(user.access);
  if (!companyId) return { error: "Your account is not scoped to any company." };

  const parsedHeader = headerSchema.safeParse({
    branchId: formData.get("branchId"),
    voucherDate: formData.get("voucherDate"),
    cashCoaId: formData.get("cashCoaId"),
    narration: formData.get("narration"),
  });
  if (!parsedHeader.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsedHeader.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Check the highlighted fields.", fieldErrors };
  }
  const { branchId, voucherDate, cashCoaId, narration } = parsedHeader.data;
  await requireScope(companyId, branchId);

  const { lines: draftLines, total, error: linesError } = parseLines(formData);
  if (linesError || !draftLines || total === undefined) return { error: linesError };
  if (total <= 0) return { error: "Enter at least one line with an amount greater than zero." };

  const { lines, error: resolveError } = await resolveFreeLines(companyId, cashCoaId, draftLines);
  if (resolveError || !lines) return { error: resolveError };

  let voucherId: number;
  let voucherNo: string;
  try {
    const created = await createCashVoucherDraft(
      { companyId, branchId, voucherType, voucherDate, cashCoaId, narration, userId: user.userId },
      lines,
      total,
    );
    voucherId = created.voucherId;
    voucherNo = created.voucherNo;
  } catch (e) {
    return { error: describeOracleError(e, "The voucher could not be saved.") };
  }

  if (formData.get("intent") === "post") {
    try {
      await postCashVoucher(voucherId, user.userId);
    } catch (e) {
      revalidatePath("/admin/cash-vouchers");
      return {
        error: `Saved as draft ${voucherNo}, but it could not be posted: ${describeOracleError(e, "unknown error")} Open it from the list to try posting again.`,
      };
    }
  }

  revalidatePath("/admin/cash-vouchers");
  redirect(`/admin/cash-vouchers/${voucherId}`);
}

export async function updateDraftAction(
  voucherId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const existing = await getCashVoucher(voucherId);
  if (!existing) return { error: "This voucher no longer exists." };

  const user = await requirePermission("CASH_VOUCHER", "EDIT");
  await requireScope(existing.header.COMPANY_ID, existing.header.BRANCH_ID);
  if (existing.header.STATUS !== "DRAFT") {
    return { error: "Only a draft voucher can be edited." };
  }

  const narration = String(formData.get("narration") ?? "").trim();
  if (!narration) return { error: "Narration is required." };

  const { lines: draftLines, total, error: linesError } = parseLines(formData);
  if (linesError || !draftLines || total === undefined) return { error: linesError };
  if (total <= 0) return { error: "Enter at least one line with an amount greater than zero." };

  const { lines, error: resolveError } = await resolveFreeLines(
    existing.header.COMPANY_ID,
    existing.header.CASH_COA_ID,
    draftLines,
  );
  if (resolveError || !lines) return { error: resolveError };

  try {
    await updateCashVoucherDraft(voucherId, narration, lines, total);
  } catch (e) {
    return { error: describeOracleError(e, "The voucher could not be saved.") };
  }

  if (formData.get("intent") === "post") {
    try {
      await postCashVoucher(voucherId, user.userId);
    } catch (e) {
      revalidatePath("/admin/cash-vouchers");
      return {
        error: `Saved, but it could not be posted: ${describeOracleError(e, "unknown error")}`,
      };
    }
  }

  revalidatePath("/admin/cash-vouchers");
  redirect(`/admin/cash-vouchers/${voucherId}`);
}

export async function deleteDraftAction(voucherId: number): Promise<void> {
  const existing = await getCashVoucher(voucherId);
  if (!existing) throw new Error("This voucher no longer exists.");

  await requirePermission("CASH_VOUCHER", "EDIT");
  await requireScope(existing.header.COMPANY_ID, existing.header.BRANCH_ID);

  try {
    await deleteCashVoucherDraft(voucherId);
  } catch (e) {
    throw new Error(describeOracleError(e, "The voucher could not be deleted."));
  }
  revalidatePath("/admin/cash-vouchers");
}

export async function postDraftAction(voucherId: number): Promise<void> {
  const existing = await getCashVoucher(voucherId);
  if (!existing) throw new Error("This voucher no longer exists.");

  const user = await requirePermission("CASH_VOUCHER", "POST");
  await requireScope(existing.header.COMPANY_ID, existing.header.BRANCH_ID);

  try {
    await postCashVoucher(voucherId, user.userId);
  } catch (e) {
    throw new Error(describeOracleError(e, "The voucher could not be posted."));
  }
  revalidatePath("/admin/cash-vouchers");
  revalidatePath(`/admin/cash-vouchers/${voucherId}`);
}

export async function cancelPostedAction(voucherId: number, reason: string): Promise<void> {
  const existing = await getCashVoucher(voucherId);
  if (!existing) throw new Error("This voucher no longer exists.");

  const user = await requirePermission("CASH_VOUCHER", "CANCEL");
  await requireScope(existing.header.COMPANY_ID, existing.header.BRANCH_ID);

  if (!reason.trim()) throw new Error("A cancellation reason is required.");

  try {
    await cancelPostedCashVoucher(voucherId, user.userId, reason.trim());
  } catch (e) {
    throw new Error(describeOracleError(e, "The voucher could not be cancelled."));
  }
  revalidatePath("/admin/cash-vouchers");
  revalidatePath(`/admin/cash-vouchers/${voucherId}`);
}
