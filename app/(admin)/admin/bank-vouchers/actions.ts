"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission, requireScope } from "@/lib/dal";
import { getActiveCompanyId } from "@/lib/active-scope";
import { listPostableAccounts } from "@/lib/db/coa";
import { getPartyIdsByLedgerCoaIds } from "@/lib/db/parties";
import {
  createBankVoucherDraft,
  updateBankVoucherDraft,
  deleteBankVoucherDraft,
  postBankVoucher,
  cancelPostedBankVoucher,
  getBankVoucher,
  type BvType,
  type BvFreeLineInput,
  type InstrumentType,
} from "@/lib/db/bank-vouchers";
import { describeOracleError } from "@/lib/db/errors";

const INSTRUMENT_TYPES = ["CHEQUE", "ONLINE_TRANSFER", "PAY_ORDER", "DD", "RTGS"] as const;
// A cheque, pay order or demand draft is a physical instrument — no number,
// no voucher. An online transfer / RTGS clears against a bank-issued
// reference the payer may not have in hand yet, so it stays optional.
const INSTRUMENT_NO_REQUIRED: Record<InstrumentType, boolean> = {
  CHEQUE: true,
  PAY_ORDER: true,
  DD: true,
  ONLINE_TRANSFER: false,
  RTGS: false,
};

const lineSchema = z.object({
  coaId: z.coerce.number().int().positive("Select an account for every line."),
  narration: z.string().trim().max(400).nullable(),
  amount: z.coerce.number().positive("Each line needs an amount greater than zero."),
});

type LineDraft = Omit<BvFreeLineInput, "partyId">;

const linesArraySchema = z.array(lineSchema).min(1, "A voucher needs at least one line.");

const headerSchema = z
  .object({
    branchId: z.coerce.number().int().positive("Choose a branch."),
    voucherDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a voucher date."),
    bankCoaId: z.coerce.number().int().positive("Choose a bank account."),
    narration: z.string().trim().min(1, "Narration is required.").max(400),
    instrumentType: z.enum(INSTRUMENT_TYPES, { message: "Choose an instrument type." }),
    instrumentNo: z
      .string()
      .trim()
      .max(30)
      .nullable()
      .transform((v) => v || null),
    instrumentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose an instrument date."),
  })
  .superRefine((data, ctx) => {
    if (INSTRUMENT_NO_REQUIRED[data.instrumentType] && !data.instrumentNo) {
      ctx.addIssue({
        code: "custom",
        path: ["instrumentNo"],
        message: "Enter the instrument number.",
      });
    }
  });

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

/**
 * Re-validates against the live COA, never the client's copy: the bank
 * account must still be a BANK control account, and no free leg may be
 * coded to a CASH or BANK control account (that would be a contra entry,
 * out of scope for this module). Party is derived straight from a
 * Customer/Supplier free-leg account, same as Journal Voucher and Cash
 * Voucher — there is no separate party field to trust or mismatch.
 */
async function resolveFreeLines(
  companyId: number,
  bankCoaId: number,
  lines: LineDraft[],
): Promise<{ lines?: BvFreeLineInput[]; error?: string }> {
  const accounts = await listPostableAccounts(companyId);
  const controlType = new Map(accounts.map((a) => [a.COA_ID, a.IS_CONTROL_AC]));

  if (controlType.get(bankCoaId) !== "BANK") {
    return { error: "The selected bank account is no longer valid — choose a bank account." };
  }

  const partyCoaIds = lines
    .map((l) => l.coaId)
    .filter((coaId) => {
      const type = controlType.get(coaId);
      return type === "CUSTOMER" || type === "SUPPLIER";
    });
  const partyByCoaId = await getPartyIdsByLedgerCoaIds(companyId, partyCoaIds);

  const resolved: BvFreeLineInput[] = [];
  for (const l of lines) {
    if (!controlType.has(l.coaId)) return { error: "One of the selected accounts is no longer valid." };
    if (l.coaId === bankCoaId) {
      return { error: "A line cannot be coded to the same bank account used for this voucher." };
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
  voucherType: BvType,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requirePermission("BANK_VOUCHER", "CREATE");
  const companyId = await getActiveCompanyId(user.access);
  if (!companyId) return { error: "Your account is not scoped to any company." };

  const parsedHeader = headerSchema.safeParse({
    branchId: formData.get("branchId"),
    voucherDate: formData.get("voucherDate"),
    bankCoaId: formData.get("bankCoaId"),
    narration: formData.get("narration"),
    instrumentType: formData.get("instrumentType"),
    instrumentNo: formData.get("instrumentNo"),
    instrumentDate: formData.get("instrumentDate"),
  });
  if (!parsedHeader.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsedHeader.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Check the highlighted fields.", fieldErrors };
  }
  const { branchId, voucherDate, bankCoaId, narration, instrumentType, instrumentNo, instrumentDate } =
    parsedHeader.data;
  await requireScope(companyId, branchId);

  const { lines: draftLines, total, error: linesError } = parseLines(formData);
  if (linesError || !draftLines || total === undefined) return { error: linesError };
  if (total <= 0) return { error: "Enter at least one line with an amount greater than zero." };

  const { lines, error: resolveError } = await resolveFreeLines(companyId, bankCoaId, draftLines);
  if (resolveError || !lines) return { error: resolveError };

  let voucherId: number;
  let voucherNo: string;
  try {
    const created = await createBankVoucherDraft(
      {
        companyId,
        branchId,
        voucherType,
        voucherDate,
        bankCoaId,
        narration,
        userId: user.userId,
        instrumentType,
        instrumentNo,
        instrumentDate,
      },
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
      await postBankVoucher(voucherId, user.userId);
    } catch (e) {
      revalidatePath("/admin/bank-vouchers");
      return {
        error: `Saved as draft ${voucherNo}, but it could not be posted: ${describeOracleError(e, "unknown error")} Open it from the list to try posting again.`,
      };
    }
  }

  revalidatePath("/admin/bank-vouchers");
  redirect(`/admin/bank-vouchers/${voucherId}`);
}

export async function updateDraftAction(
  voucherId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const existing = await getBankVoucher(voucherId);
  if (!existing) return { error: "This voucher no longer exists." };

  const user = await requirePermission("BANK_VOUCHER", "EDIT");
  await requireScope(existing.header.COMPANY_ID, existing.header.BRANCH_ID);
  if (existing.header.STATUS !== "DRAFT") {
    return { error: "Only a draft voucher can be edited." };
  }

  const narration = String(formData.get("narration") ?? "").trim();
  if (!narration) return { error: "Narration is required." };

  const instrumentParsed = headerSchema
    .pick({ instrumentType: true, instrumentNo: true, instrumentDate: true })
    .safeParse({
      instrumentType: formData.get("instrumentType"),
      instrumentNo: formData.get("instrumentNo"),
      instrumentDate: formData.get("instrumentDate"),
    });
  if (!instrumentParsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of instrumentParsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Check the highlighted fields.", fieldErrors };
  }

  const { lines: draftLines, total, error: linesError } = parseLines(formData);
  if (linesError || !draftLines || total === undefined) return { error: linesError };
  if (total <= 0) return { error: "Enter at least one line with an amount greater than zero." };

  const { lines, error: resolveError } = await resolveFreeLines(
    existing.header.COMPANY_ID,
    existing.header.BANK_COA_ID,
    draftLines,
  );
  if (resolveError || !lines) return { error: resolveError };

  try {
    await updateBankVoucherDraft(voucherId, narration, lines, total, instrumentParsed.data);
  } catch (e) {
    return { error: describeOracleError(e, "The voucher could not be saved.") };
  }

  if (formData.get("intent") === "post") {
    try {
      await postBankVoucher(voucherId, user.userId);
    } catch (e) {
      revalidatePath("/admin/bank-vouchers");
      return {
        error: `Saved, but it could not be posted: ${describeOracleError(e, "unknown error")}`,
      };
    }
  }

  revalidatePath("/admin/bank-vouchers");
  redirect(`/admin/bank-vouchers/${voucherId}`);
}

export async function deleteDraftAction(voucherId: number): Promise<void> {
  const existing = await getBankVoucher(voucherId);
  if (!existing) throw new Error("This voucher no longer exists.");

  await requirePermission("BANK_VOUCHER", "EDIT");
  await requireScope(existing.header.COMPANY_ID, existing.header.BRANCH_ID);

  try {
    await deleteBankVoucherDraft(voucherId);
  } catch (e) {
    throw new Error(describeOracleError(e, "The voucher could not be deleted."));
  }
  revalidatePath("/admin/bank-vouchers");
}

export async function postDraftAction(voucherId: number): Promise<void> {
  const existing = await getBankVoucher(voucherId);
  if (!existing) throw new Error("This voucher no longer exists.");

  const user = await requirePermission("BANK_VOUCHER", "POST");
  await requireScope(existing.header.COMPANY_ID, existing.header.BRANCH_ID);

  try {
    await postBankVoucher(voucherId, user.userId);
  } catch (e) {
    throw new Error(describeOracleError(e, "The voucher could not be posted."));
  }
  revalidatePath("/admin/bank-vouchers");
  revalidatePath(`/admin/bank-vouchers/${voucherId}`);
}

export async function cancelPostedAction(voucherId: number, reason: string): Promise<void> {
  const existing = await getBankVoucher(voucherId);
  if (!existing) throw new Error("This voucher no longer exists.");

  const user = await requirePermission("BANK_VOUCHER", "CANCEL");
  await requireScope(existing.header.COMPANY_ID, existing.header.BRANCH_ID);

  if (!reason.trim()) throw new Error("A cancellation reason is required.");

  try {
    await cancelPostedBankVoucher(voucherId, user.userId, reason.trim());
  } catch (e) {
    throw new Error(describeOracleError(e, "The voucher could not be cancelled."));
  }
  revalidatePath("/admin/bank-vouchers");
  revalidatePath(`/admin/bank-vouchers/${voucherId}`);
}
