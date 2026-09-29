import "server-only";
import { cache } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { loadUserAccess } from "@/lib/db/access";
import { can, inScope } from "@/lib/permissions";
import type { Action, SessionUser } from "@/lib/permissions";

/**
 * The real authentication gate. proxy.ts only checks that a session cookie
 * exists; this runs per page, route handler and Server Action.
 *
 * Permissions and scope are read from the database here rather than taken from
 * the token, so a revoked permission, a removed company or a deactivated
 * account stops working on the very next request. cache() keeps that to one
 * read per render no matter how many callers ask.
 */
export const verifySession = cache(async (): Promise<SessionUser> => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.userId) redirect("/login");

  const live = await loadUserAccess(session.user.userId);
  if (!live || !live.isActive) redirect("/login");

  return {
    userId: session.user.userId,
    username: live.username,
    fullName: live.fullName,
    roles: live.roles,
    permissions: live.permissions,
    access: live.access,
  };
});

/**
 * Gate a page or action on one module/action pair. This is the app-side half
 * only — every posting procedure calls pkg_security again, so a direct call
 * that skips this is still refused by the database.
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
