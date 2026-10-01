"use client";

import { switchBranchAction } from "./scope-actions";
import type { BranchOption } from "@/lib/db/scope";
import styles from "./shell.module.css";

export default function BranchSwitcher({
  branches,
  activeBranchId,
}: {
  branches: BranchOption[];
  activeBranchId: number;
}) {
  return (
    <form action={switchBranchAction}>
      <select
        name="branchId"
        className={styles.scopeSelect}
        defaultValue={activeBranchId}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        aria-label="Switch branch"
      >
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </form>
  );
}
