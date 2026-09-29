"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import styles from "@/components/data-grid/grid.module.css";

type Option = { id: number; name: string };

export default function ItemsFilters({
  categories,
  brands,
}: {
  categories: Option[];
  brands: Option[];
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
    // Any filter change invalidates the current page number.
    next.delete("page");
    startTransition(() => router.replace(`?${next.toString()}`));
  }

  // Debounced so typing does not fire a query per keystroke.
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
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--ink-3)"
          strokeWidth="2"
          strokeLinecap="round"
          style={{ flexShrink: 0 }}
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <span
          style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}
        >
          Search items
        </span>
        <input
          className={styles.searchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search code, name or barcode"
        />
      </label>

      <select
        className={styles.select}
        aria-label="Filter by category"
        value={params.get("category") ?? ""}
        onChange={(e) => apply({ category: e.target.value })}
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <select
        className={styles.select}
        aria-label="Filter by brand"
        value={params.get("brand") ?? ""}
        onChange={(e) => apply({ brand: e.target.value })}
      >
        <option value="">All brands</option>
        {brands.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>

      <select
        className={styles.select}
        aria-label="Filter by status"
        value={params.get("inactive") ?? ""}
        onChange={(e) => apply({ inactive: e.target.value })}
      >
        <option value="">Active only</option>
        <option value="1">Including inactive</option>
      </select>
    </>
  );
}
