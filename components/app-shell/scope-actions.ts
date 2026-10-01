"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { ACTIVE_COMPANY_COOKIE, ACTIVE_BRANCH_COOKIE, getActiveCompanyId } from "@/lib/active-scope";

/**
 * Switches which of the user's granted companies they're acting as. Re-reads
 * the session rather than trusting the posted id, so a company the caller
 * isn't actually granted can't be set via a crafted request. Redirects to
 * the dashboard because a page scoped to a specific record (e.g. an item
 * belonging to the old company) would otherwise be left showing stale data.
 */
export async function switchCompanyAction(formData: FormData): Promise<void> {
  const user = await verifySession();
  const companyId = Number(formData.get("companyId"));

  if (!user.access.some((a) => a.companyId === companyId)) {
    redirect("/dashboard");
  }

  const jar = await cookies();
  jar.set(ACTIVE_COMPANY_COOKIE, String(companyId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  // The cookie mutation alone isn't reliably picked up by the redirect's own
  // render when the destination is the route the action was invoked from —
  // force the whole layout tree (where the scope pill reads the cookie) to
  // be treated as stale before navigating.
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/**
 * Switches which branch of the user's current company they're acting as.
 * Re-derives the active company server-side (never trusts a posted
 * companyId) and only accepts a branchId the user actually has a row for
 * under that company.
 */
export async function switchBranchAction(formData: FormData): Promise<void> {
  const user = await verifySession();
  const companyId = await getActiveCompanyId(user.access);
  const branchId = Number(formData.get("branchId"));

  if (
    companyId === undefined ||
    !user.access.some((a) => a.companyId === companyId && a.branchId === branchId)
  ) {
    redirect("/dashboard");
  }

  const jar = await cookies();
  jar.set(ACTIVE_BRANCH_COOKIE, String(branchId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
