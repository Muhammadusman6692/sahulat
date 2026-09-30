import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { getScopeLabels } from "@/lib/db/scope";
import { getMenu } from "@/lib/db/menu";
import SidebarNav from "@/components/app-shell/sidebar-nav";
import SignOutButton from "@/components/app-shell/sign-out-button";
import AdminLayoutWrapper from "@/components/app-shell/admin-layout-wrapper";
import styles from "@/components/app-shell/shell.module.css";

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  // Loads the user for the chrome below. This is NOT the access gate: layouts
  // do not re-render on navigation and cannot stop a child segment from
  // running, so each page calls requirePermission for itself.
  const user = await verifySession();
  const [scope, menu] = await Promise.all([
    getScopeLabels(user.access),
    getMenu(user.permissions),
  ]);

  const initials = user.fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <AdminLayoutWrapper
      scope={scope}
      user={user}
      initials={initials}
      menu={menu}
      styles={styles}
    >
      {children}
    </AdminLayoutWrapper>
  );
}
