"use client";

import { useRouter } from "next/navigation";
import styles from "@/components/data-grid/grid.module.css";

export default function FySelect({
  years,
  selectedFyId,
}: {
  years: { FY_ID: number; FY_NAME: string; STATUS: "OPEN" | "CLOSED" }[];
  selectedFyId: number;
}) {
  const router = useRouter();

  return (
    <select
      className={styles.select}
      value={selectedFyId}
      onChange={(e) => router.push(`/admin/period-close?fy=${e.target.value}`)}
    >
      {years.map((y) => (
        <option key={y.FY_ID} value={y.FY_ID}>
          {y.FY_NAME} ({y.STATUS})
        </option>
      ))}
    </select>
  );
}
