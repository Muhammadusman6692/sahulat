"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import styles from "@/components/data-grid/grid.module.css";

export default function JvFilters({
  branches,
}: {
  branches: { id: number; code: string; name: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(params.get("q") ?? "");

  function apply(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    startTransition(() => router.replace(`?${next.toString()}`));
  }

  useEffect(() => {
    const current = params.get("q") ?? "";
    if (search === current) return;
    const t = setTimeout(() => apply({ q: search }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <>
      <label className={styles.search}>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round"
          style={{ flexShrink: 0 }}
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <span
          style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}
        >
          Search journal vouchers
        </span>
        <input
          className={styles.searchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search voucher no. or narration"
        />
      </label>

      <select
        className={styles.select}
        aria-label="Filter by status"
        value={params.get("status") ?? ""}
        onChange={(e) => apply({ status: e.target.value })}
      >
        <option value="">All statuses</option>
        <option value="DRAFT">Draft</option>
        <option value="POSTED">Posted</option>
        <option value="CANCELLED">Cancelled</option>
      </select>

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
