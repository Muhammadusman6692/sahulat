import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { canView } from "@/lib/permissions";
import { NAV } from "@/components/app-shell/nav-config";
import SidebarNav from "@/components/app-shell/sidebar-nav";
import SignOutButton from "@/components/app-shell/sign-out-button";
import styles from "@/components/app-shell/shell.module.css";

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  // Loads the user for the chrome below. This is NOT the access gate: layouts
  // do not re-render on navigation and cannot stop a child segment from
  // running, so each page calls requirePermission for itself.
  const user = await verifySession();

  const allowed = NAV.flatMap((g) => g.items)
    .map((i) => i.module)
    .filter((m): m is string => !!m && canView(user.permissions, m));

  const initials = user.fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/dashboard" className={styles.brand}>
          <span className={styles.mark}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <path d="M3 9h18M3 15h18M9 3v18" />
            </svg>
          </span>
          <span>
            <span className={styles.wordmark}>SAHULAT</span>
            <span className={styles.tagline}>TRADING · POS · DIST</span>
          </span>
        </Link>

        <SidebarNav allowed={allowed} />

        <p className={styles.sidebarFoot}>
          Menu reflects your role. Hidden items are also blocked server-side.
        </p>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.scopeGroup}>
            <span className={styles.scopeLabel}>SCOPE</span>
            <span className={styles.scopeField}>
              <span className={styles.scopeName}>Company</span>
              <span className={styles.scopeValue}>Jahangir Trading Co.</span>
            </span>
            <span className={styles.scopeField}>
              <span className={styles.scopeName}>Branch</span>
              <span className={styles.scopeValue}>Lahore — Badami Bagh</span>
            </span>
            <span className={styles.scopeField}>
              <span className={styles.scopeName}>Warehouse</span>
              <span className={styles.scopeValue}>Main Store</span>
            </span>
          </div>

          <div className={styles.spacer} />

          <div className={styles.userBox}>
            <span className={styles.avatar}>{initials}</span>
            <span>
              <span className={styles.userName} style={{ display: "block" }}>
                {user.fullName}
              </span>
              <span className={styles.userRole}>
                {user.roles.join(", ") || "No role"}
              </span>
            </span>
            <SignOutButton />
          </div>
        </header>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
