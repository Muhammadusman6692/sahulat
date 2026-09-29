import "server-only";
import { cache } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { can, inScope } from "@/lib/permissions";
import type { Action, SessionUser } from "@/lib/permissions";

/**
 * The real authentication gate. proxy.ts only checks that a cookie exists;
 * this runs per page, route handler and Server Action. Wrapped in cache() so
 * several calls in one render share a single verification.
 */
export const verifySession = cache(async (): Promise<SessionUser> => {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  return session.user;
});

/**
 * Gate a page or action on one module/action pair. Note this is the app-side
 * half only — every posting procedure calls pkg_security again, so a direct
 * API call that skips this is still refused by the database.
 */
export async function requirePermission(
  moduleCode: string,
  action: Action,
): Promise<SessionUser> {
  const user = await verifySession();
  if (!can(user.permissions, moduleCode, action)) {
    redirect("/forbidden");
  }
  return user;
}

/** Gate on the company/branch/warehouse the request is trying to act in. */
export async function requireScope(
  companyId: number,
  branchId?: number | null,
  warehouseId?: number | null,
): Promise<SessionUser> {
  const user = await verifySession();
  if (!inScope(user.access, companyId, branchId, warehouseId)) {
    redirect("/forbidden");
  }
  return user;
}
