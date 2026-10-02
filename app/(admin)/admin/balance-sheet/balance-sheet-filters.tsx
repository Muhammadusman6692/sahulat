"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import styles from "@/components/data-grid/grid.module.css";

export default function BalanceSheetFilters({
  branches,
  asOf,
  level,
}: {
  branches: { id: number; code: string; name: string }[];
  asOf: string;
  level: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function apply(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    startTransition(() => router.replace(`?${next.toString()}`));
  }

  const labelStyle = { fontSize: 12, color: "var(--ink-3)" };

  return (
    <>
      {branches.length > 1 && (
        <select
          className={styles.select}
          aria-label="Filter by branch"
          value={params.get("branchId") ?? ""}
          onChange={(e) => apply({ branchId: e.target.value })}
        >
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.code} — {b.name}
            </option>
          ))}
        </select>
      )}

      <span style={labelStyle}>As at</span>
      <input
        type="date"
        className={styles.select}
        aria-label="As at date"
        value={asOf}
        onChange={(e) => apply({ asOf: e.target.value })}
      />

      <span style={labelStyle}>Compare with</span>
      <input
        type="date"
        className={styles.select}
        aria-label="Comparative date"
        value={params.get("cmp") ?? ""}
        onChange={(e) => apply({ cmp: e.target.value })}
      />

      <select
        className={styles.select}
        aria-label="Detail level"
        value={String(level)}
        onChange={(e) => apply({ level: e.target.value === "3" ? "" : e.target.value })}
      >
        <option value="2">Level 2 — Control</option>
        <option value="3">Level 3 — Sub-Control</option>
        <option value="4">Level 4 — Accounts</option>
      </select>

      <label style={{ display: "flex", alignItems: "center", gap: 6, ...labelStyle }}>
        <input
          type="checkbox"
          checked={params.get("zero") === "1"}
          onChange={(e) => apply({ zero: e.target.checked ? "1" : "" })}
        />
        Show zero balances
      </label>
    </>
  );
}
