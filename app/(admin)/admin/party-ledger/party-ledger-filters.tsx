"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import PartyCombobox from "@/components/form/party-combobox";
import type { PartyLovOption } from "@/components/form/party-lov";
import styles from "@/components/data-grid/grid.module.css";

export default function PartyLedgerFilters({
  parties,
  branches,
}: {
  parties: PartyLovOption[];
  branches: { id: number; code: string; name: string }[];
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
      <div style={{ width: 300, flexShrink: 0 }}>
        <PartyCombobox
          parties={parties}
          value={params.get("partyId") ?? ""}
          onChange={(value) => apply({ partyId: value })}
          placeholder="Select party"
        />
      </div>

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
    </>
  );
}
