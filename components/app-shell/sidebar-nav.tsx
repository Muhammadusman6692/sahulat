"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MenuGroup } from "@/lib/db/menu";
import { ModuleIcon, MODULE_ICON, SECTION_ICON } from "./module-icons";
import styles from "./shell.module.css";

// A <title> child is only valid inside <svg>; inside a <span> the browser
// treats it as the document title and renames the tab.
function StatusBadge({ status }: { status: string }) {
  if (status === "COMPLETED") {
    return (
      <svg
        className={styles.badgeDone}
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        role="img"
        aria-label="Completed"
      >
        <path d="M20 6L9 17l-5-5" />
      </svg>
    );
  }
  if (status === "IN_PROGRESS") {
    return (
      <span className={styles.dotProgress} role="img" aria-label="In progress" />
    );
  }
  return <span className={styles.dotPending} role="img" aria-label="Not started" />;
}

/**
 * Which items exist is decided on the server from the permission matrix, so a
 * module the user may not view never reaches the browser at all.
 */
export default function SidebarNav({ menu }: { menu: MenuGroup[] }) {
  const pathname = usePathname();

  return (
    <nav className={styles.nav}>
      {menu.map((group) => (
        <div key={group.group}>
          <div className={styles.groupLabel}>{group.label}</div>
          {group.sections.map((section) => (
            <div key={section.type}>
              {section.label && (
                <div className={styles.sectionLabel}>
                  <ModuleIcon icon={SECTION_ICON[section.type]} className={styles.sectionIcon} />
                  {section.label}
                </div>
              )}
              {section.items.map((item) => {
                const active =
                  item.href &&
                  (pathname === item.href || pathname.startsWith(`${item.href}/`));

                const label = (
                  <>
                    <ModuleIcon icon={MODULE_ICON[item.moduleCode]} className={styles.itemIcon} />
                    <span className={styles.itemLabel}>{item.label}</span>
                    <StatusBadge status={item.status} />
                  </>
                );

                if (!item.href) {
                  return (
                    <span
                      key={item.moduleCode}
                      className={styles.itemTodo}
                      title={item.notes ?? "Not built yet"}
                    >
                      {label}
                    </span>
                  );
                }

                return (
                  <Link
                    key={item.moduleCode}
                    href={item.href}
                    className={active ? styles.itemActive : styles.item}
                    title={item.notes ?? undefined}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      ))}
    </nav>
  );
}
