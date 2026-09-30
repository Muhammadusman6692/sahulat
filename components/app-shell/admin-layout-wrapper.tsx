"use client";

import { useState } from "react";
import Link from "next/link";
import type { MenuGroup } from "@/lib/db/menu";
import type { ScopeLabels } from "@/lib/db/scope";
import type { SessionUser } from "@/lib/permissions";
import SidebarNav from "./sidebar-nav";
import SignOutButton from "./sign-out-button";

interface Props {
  scope: ScopeLabels | null;
  user: SessionUser;
  initials: string;
  menu: MenuGroup[];
  styles: any;
  children: React.ReactNode;
}

export default function AdminLayoutWrapper({
  scope,
  user,
  initials,
  menu,
  styles,
  children,
}: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={styles.shell}>
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.open : ""}`}>
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

        <SidebarNav menu={menu} />

        <p className={styles.sidebarFoot}>
          Menu reflects your role. Hidden items are also blocked server-side.
          Dots track build progress and come out once the ERP is finished.
        </p>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <button
            className={styles.hamburgerButton}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            ☰
          </button>

          {scope && (
            <div className={styles.scopeGroup}>
              <span className={styles.scopeLabel}>SCOPE</span>
              <span className={styles.scopeField}>
                <span className={styles.scopeName}>Company</span>
                <span className={styles.scopeValue}>{scope.company}</span>
              </span>
              <span className={styles.scopeField}>
                <span className={styles.scopeName}>Branch</span>
                <span className={styles.scopeValue}>{scope.branch}</span>
              </span>
              <span className={styles.scopeField}>
                <span className={styles.scopeName}>Warehouse</span>
                <span className={styles.scopeValue}>{scope.warehouse}</span>
              </span>
            </div>
          )}

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
