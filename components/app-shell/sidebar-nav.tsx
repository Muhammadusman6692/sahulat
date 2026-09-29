"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "./nav-config";
import styles from "./shell.module.css";

/**
 * Client component only so the active item can follow the URL. Which items
 * exist is decided on the server and passed in as `allowed`, so an unauthorised
 * route name is never shipped to the browser.
 */
export default function SidebarNav({ allowed }: { allowed: string[] }) {
  const pathname = usePathname();
  const allow = new Set(allowed);

  return (
    <nav className={styles.nav}>
      {NAV.map((group, gi) => {
        const items = group.items.filter((i) => !i.module || allow.has(i.module));
        if (items.length === 0) return null;

        return (
          <div key={group.label ?? `g${gi}`}>
            {group.label && <div className={styles.groupLabel}>{group.label}</div>}
            {items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={active ? styles.itemActive : styles.item}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
