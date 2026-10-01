"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { ACTIVE_COMPANY_COOKIE } from "@/lib/active-scope";

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

  redirect("/dashboard");
}
