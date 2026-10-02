"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import styles from "@/components/data-grid/grid.module.css";

export default function ProfitLossFilters({
  branches,
  fiscalYears,
}: {
  branches: { id: number; code: string; name: string }[];
  fiscalYears: { id: number; name: string; startDate: string; endDate: string }[];
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

      {fiscalYears.length > 0 && (
        <select
          className={styles.select}
          aria-label="Quick-select fiscal year"
          value=""
          onChange={(e) => {
            const fy = fiscalYears.find((f) => String(f.id) === e.target.value);
            if (fy) apply({ from: fy.startDate, to: fy.endDate });
          }}
        >
          <option value="">Fiscal year…</option>
          {fiscalYears.map((fy) => (
            <option key={fy.id} value={fy.id}>
              {fy.name}
            </option>
          ))}
        </select>
      )}

      <input
        type="date"
        className={styles.select}
        aria-label="From date"
        value={params.get("from") ?? ""}
        onChange={(e) => apply({ from: e.target.value })}
      />
      <span style={{ fontSize: 12, color: "var(--ink-3)" }}>to</span>
      <input
        type="date"
        className={styles.select}
        aria-label="To date"
        value={params.get("to") ?? ""}
        onChange={(e) => apply({ to: e.target.value })}
      />

      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-3)" }}>
        <input
          type="checkbox"
          checked={params.get("zero") === "1"}
          onChange={(e) => apply({ zero: e.target.checked ? "1" : "" })}
        />
        Show zero-balance accounts
      </label>
    </>
  );
}
