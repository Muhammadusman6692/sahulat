"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission, requireScope } from "@/lib/dal";
import { getActiveCompanyId } from "@/lib/active-scope";
import { listPostableAccounts } from "@/lib/db/coa";
import {
  createJournalVoucherDraft,
  updateJournalVoucherDraft,
  deleteJournalVoucherDraft,
  postJournalVoucher,
  cancelPostedJournalVoucher,
  getJournalVoucher,
  type JvLineInput,
} from "@/lib/db/journal-vouchers";
import { describeOracleError } from "@/lib/db/errors";
import { fmtMoney } from "@/lib/format";

const lineSchema = z
  .object({
    coaId: z.coerce.number().int().positive("Select an account for every line."),
    partyId: z.coerce.number().int().positive().nullable(),
    narration: z.string().trim().max(400).nullable(),
    debit: z.coerce.number().min(0),
    credit: z.coerce.number().min(0),
  })
  .refine((l) => (l.debit > 0) !== (l.credit > 0), {
    message: "Each line needs an amount on exactly one side (debit or credit).",
  });

const linesArraySchema = z
  .array(lineSchema)
  .min(2, "A voucher needs at least two lines.");

const headerSchema = z.object({
  branchId: z.coerce.number().int().positive("Choose a branch."),
  voucherDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a voucher date."),
  narration: z.string().trim().min(1, "Narration is required.").max(400),
});

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

/** Re-validates against the live COA, never the client's copy: a line on a
 *  Customer/Supplier control account must carry a party, any other line must
 *  not. Returns null on success, an error string otherwise. */
async function checkPartyRules(
  companyId: number,
  lines: JvLineInput[],
): Promise<string | null> {
  const accounts = await listPostableAccounts(companyId);
  const controlType = new Map(accounts.map((a) => [a.COA_ID, a.IS_CONTROL_AC]));

  for (const l of lines) {
    if (!controlType.has(l.coaId)) return "One of the selected accounts is no longer valid.";
    const type = controlType.get(l.coaId);
    const needsParty = type === "CUSTOMER" || type === "SUPPLIER";
    if (needsParty && !l.partyId) {
      return `A party is required on every ${type.toLowerCase()} control-account line.`;
    }
    if (!needsParty && l.partyId) {
      return "A party can only be set on a Customer or Supplier control-account line.";
    }
  }
  return null;
}

function parseLines(formData: FormData): { lines?: JvLineInput[]; error?: string } {
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

  const totalDebit = parsed.data.reduce((s, l) => s + l.debit, 0);
  const totalCredit = parsed.data.reduce((s, l) => s + l.credit, 0);
  if (Math.round((totalDebit - totalCredit) * 100) !== 0) {
    return {
      error: `Total debit (${fmtMoney(totalDebit)}) must equal total credit (${fmtMoney(totalCredit)}) before this voucher can be saved.`,
    };
  }

  return { lines: parsed.data.map((l) => ({ ...l, narration: l.narration || null })) };
}

export async function createDraftAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requirePermission("JV_ENTRY", "CREATE");
  const companyId = await getActiveCompanyId(user.access);
  if (!companyId) return { error: "Your account is not scoped to any company." };

  const parsedHeader = headerSchema.safeParse({
    branchId: formData.get("branchId"),
    voucherDate: formData.get("voucherDate"),
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
  const { branchId, voucherDate, narration } = parsedHeader.data;
  await requireScope(companyId, branchId);

  const { lines, error: linesError } = parseLines(formData);
  if (linesError || !lines) return { error: linesError };

  const partyError = await checkPartyRules(companyId, lines);
  if (partyError) return { error: partyError };

  let voucherId: number;
  let voucherNo: string;
  try {
    const created = await createJournalVoucherDraft(
      { companyId, branchId, voucherDate, narration, userId: user.userId },
      lines,
    );
    voucherId = created.voucherId;
    voucherNo = created.voucherNo;
  } catch (e) {
    return { error: describeOracleError(e, "The voucher could not be saved.") };
  }

  if (formData.get("intent") === "post") {
    try {
      await postJournalVoucher(voucherId, user.userId);
    } catch (e) {
      revalidatePath("/admin/journal-vouchers");
      return {
        error: `Saved as draft ${voucherNo}, but it could not be posted: ${describeOracleError(e, "unknown error")} Open it from the list to try posting again.`,
      };
    }
  }

  revalidatePath("/admin/journal-vouchers");
  redirect(`/admin/journal-vouchers/${voucherId}`);
}

export async function updateDraftAction(
  voucherId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const existing = await getJournalVoucher(voucherId);
  if (!existing) return { error: "This voucher no longer exists." };

  const user = await requirePermission("JV_ENTRY", "EDIT");
  await requireScope(existing.header.COMPANY_ID, existing.header.BRANCH_ID);
  if (existing.header.STATUS !== "DRAFT") {
    return { error: "Only a draft voucher can be edited." };
  }

  const narration = String(formData.get("narration") ?? "").trim();
  if (!narration) return { error: "Narration is required." };

  const { lines, error: linesError } = parseLines(formData);
  if (linesError || !lines) return { error: linesError };

  const partyError = await checkPartyRules(existing.header.COMPANY_ID, lines);
  if (partyError) return { error: partyError };

  try {
    await updateJournalVoucherDraft(voucherId, narration, lines);
  } catch (e) {
    return { error: describeOracleError(e, "The voucher could not be saved.") };
  }

  if (formData.get("intent") === "post") {
    try {
      await postJournalVoucher(voucherId, user.userId);
    } catch (e) {
      revalidatePath("/admin/journal-vouchers");
      return {
        error: `Saved, but it could not be posted: ${describeOracleError(e, "unknown error")}`,
      };
    }
  }

  revalidatePath("/admin/journal-vouchers");
  redirect(`/admin/journal-vouchers/${voucherId}`);
}

export async function deleteDraftAction(voucherId: number): Promise<void> {
  const existing = await getJournalVoucher(voucherId);
  if (!existing) throw new Error("This voucher no longer exists.");

  await requirePermission("JV_ENTRY", "EDIT");
  await requireScope(existing.header.COMPANY_ID, existing.header.BRANCH_ID);

  try {
    await deleteJournalVoucherDraft(voucherId);
  } catch (e) {
    throw new Error(describeOracleError(e, "The voucher could not be deleted."));
  }
  revalidatePath("/admin/journal-vouchers");
}

export async function postDraftAction(voucherId: number): Promise<void> {
  const existing = await getJournalVoucher(voucherId);
  if (!existing) throw new Error("This voucher no longer exists.");

  const user = await requirePermission("JV_ENTRY", "POST");
  await requireScope(existing.header.COMPANY_ID, existing.header.BRANCH_ID);

  try {
    await postJournalVoucher(voucherId, user.userId);
  } catch (e) {
    throw new Error(describeOracleError(e, "The voucher could not be posted."));
  }
  revalidatePath("/admin/journal-vouchers");
  revalidatePath(`/admin/journal-vouchers/${voucherId}`);
}

export async function cancelPostedAction(
  voucherId: number,
  reason: string,
): Promise<void> {
  const existing = await getJournalVoucher(voucherId);
  if (!existing) throw new Error("This voucher no longer exists.");

  const user = await requirePermission("JV_ENTRY", "CANCEL");
  await requireScope(existing.header.COMPANY_ID, existing.header.BRANCH_ID);

  if (!reason.trim()) throw new Error("A cancellation reason is required.");

  try {
    await cancelPostedJournalVoucher(voucherId, user.userId, reason.trim());
  } catch (e) {
    throw new Error(describeOracleError(e, "The voucher could not be cancelled."));
  }
  revalidatePath("/admin/journal-vouchers");
  revalidatePath(`/admin/journal-vouchers/${voucherId}`);
}
