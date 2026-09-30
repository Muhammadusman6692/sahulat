"use client";

import { useState, useTransition } from "react";
import { renameFiscalYearAction } from "./actions";
import styles from "@/components/form/form.module.css";

export default function RenameForm({
  fyId,
  fyName,
  canEdit,
}: {
  fyId: number;
  fyName: string;
  canEdit: boolean;
}) {
  const [value, setValue] = useState(fyName);
  const [saved, setSaved] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canEdit) {
    return <span className={styles.mono}>{fyName}</span>;
  }

  function save() {
    if (value === fyName) return;
    setError(null);
    startTransition(async () => {
      try {
        await renameFiscalYearAction(fyId, value);
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not rename.");
      }
    });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input
        className={`${styles.input} ${styles.mono}`}
        style={{ width: 160 }}
        value={value}
        maxLength={20}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        onBlur={save}
      />
      {pending && <span className={styles.hint}>Saving…</span>}
      {!pending && !saved && !error && (
        <span className={styles.hint}>Unsaved</span>
      )}
      {error && (
        <span style={{ color: "var(--danger)", fontSize: 11 }}>{error}</span>
      )}
    </div>
  );
}
