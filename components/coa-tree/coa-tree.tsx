"use client";

import { useState } from "react";
import Link from "next/link";
import type { CoaNode } from "@/lib/db/coa";
import styles from "./coa-tree.module.css";

const LEVEL_CLASS = ["", styles.level1, styles.level2, styles.level3, styles.level4];

function TreeRow({ node, depth }: { node: CoaNode; depth: number }) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  const inactive = node.ACTIVE_YN !== "Y";

  return (
    <>
      {/* A <button> cannot nest inside the <a> a Link renders — invalid HTML
          that makes click handling on the button unreliable across browsers.
          The toggle is a sibling here, not a descendant of the link. */}
      <div
        className={inactive ? styles.rowInactive : styles.row}
        style={{ paddingLeft: 14 + depth * 22 }}
      >
        {hasChildren ? (
          <button
            type="button"
            className={styles.toggle}
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Collapse" : "Expand"}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.1s" }}
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        ) : (
          <span className={styles.toggleSpacer} />
        )}

        <Link href={`/admin/coa/${node.COA_ID}`} className={styles.rowLink}>
          <span className={styles.code}>{node.ACCOUNT_CODE}</span>
          <span className={styles.name}>{node.ACCOUNT_NAME}</span>
          <span className={LEVEL_CLASS[node.ACCOUNT_LEVEL]}>L{node.ACCOUNT_LEVEL}</span>
          {node.IS_CONTROL_AC && (
            <span className={styles.controlTag}>{node.IS_CONTROL_AC}</span>
          )}
          <span className={styles.natureTag}>{node.ACCOUNT_NATURE}</span>
          {inactive && <span className={styles.inactiveBadge}>INACTIVE</span>}
        </Link>
      </div>
      {hasChildren && open && (
        <div>
          {node.children.map((child) => (
            <TreeRow key={child.COA_ID} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </>
  );
}

export default function CoaTree({ roots }: { roots: CoaNode[] }) {
  return (
    <div className={styles.wrap}>
      {roots.map((r) => (
        <TreeRow key={r.COA_ID} node={r} depth={0} />
      ))}
    </div>
  );
}
