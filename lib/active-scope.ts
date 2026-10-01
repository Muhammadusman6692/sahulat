import "server-only";
import { cookies } from "next/headers";
import type { ScopeRow } from "@/lib/permissions";

export const ACTIVE_COMPANY_COOKIE = "active_company_id";

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
