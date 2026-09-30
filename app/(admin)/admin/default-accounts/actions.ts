"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, requireScope } from "@/lib/dal";
import { listRoles, saveDefaultAccounts } from "@/lib/db/default-accounts";
import { describeOracleError } from "@/lib/db/errors";

export type FormState = { error?: string; saved?: boolean };

export async function saveDefaultAccountsAction(
  companyId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requirePermission("DEFAULT_ACCT_MAINT", "EDIT");
  await requireScope(companyId);

  const roles = await listRoles();
  const mappings = roles.map((r) => {
    const raw = formData.get(`role_${r.ROLE_CODE}`);
    const coaId = typeof raw === "string" && raw ? Number(raw) : null;
    return { roleCode: r.ROLE_CODE, coaId };
  });

  try {
    await saveDefaultAccounts(companyId, mappings);
  } catch (e) {
    return { error: describeOracleError(e, "The default accounts could not be saved.") };
  }

  revalidatePath("/admin/default-accounts");
  return { saved: true };
}
