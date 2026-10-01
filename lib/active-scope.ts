import "server-only";
import { cookies } from "next/headers";
import type { ScopeRow } from "@/lib/permissions";

export const ACTIVE_COMPANY_COOKIE = "active_company_id";
export const ACTIVE_BRANCH_COOKIE = "active_branch_id";

/**
 * Which company the signed-in user is currently acting as. Honors the
 * active_company_id cookie set by the scope switcher, but only when it names
 * a company the user actually has an access row for — otherwise falls back
 * to their lowest-numbered granted company, since loadUserAccess has no
 * stable row order of its own.
 */
export async function getActiveCompanyId(
  access: ScopeRow[],
): Promise<number | undefined> {
  const granted = [...new Set(access.map((a) => a.companyId))].sort((a, b) => a - b);
  if (granted.length === 0) return undefined;

  const jar = await cookies();
  const picked = Number(jar.get(ACTIVE_COMPANY_COOKIE)?.value);
  return granted.includes(picked) ? picked : granted[0];
}

/**
 * Which branch the user is currently acting as within `companyId`. `null`
 * means unrestricted ("all branches") — any access row for this company with
 * a NULL branch_id wins outright, since that grants every branch already.
 * Otherwise honors the active_branch_id cookie when it names a branch the
 * user actually has a row for under this company, falling back to the
 * lowest-numbered one.
 */
export async function getActiveBranchId(
  access: ScopeRow[],
  companyId: number,
): Promise<number | null> {
  const rowsForCompany = access.filter((a) => a.companyId === companyId);
  if (rowsForCompany.some((r) => r.branchId === null)) return null;

  const granted = [...new Set(rowsForCompany.map((r) => r.branchId as number))].sort(
    (a, b) => a - b,
  );
  if (granted.length === 0) return null;

  const jar = await cookies();
  const picked = Number(jar.get(ACTIVE_BRANCH_COOKIE)?.value);
  return granted.includes(picked) ? picked : granted[0];
}
