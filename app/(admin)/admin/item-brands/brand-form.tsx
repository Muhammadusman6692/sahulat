"use client";

import { useActionState, useEffect, useRef } from "react";
import { createBrandAction, updateBrandAction, type FormState } from "./actions";
import styles from "@/components/form/form.module.css";

type Brand = { brandId: number; name: string };

export default function BrandForm({
  mode,
  companyId,
  brand,
  onSaved,
  onCancel,
}: {
  mode: "create" | "edit";
  companyId: number;
  brand?: Brand;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const action =
    mode === "edit" ? updateBrandAction.bind(null, brand!.brandId) : createBrandAction.bind(null, companyId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) onSaved();
    wasPending.current = pending;
  }, [pending, state.error, onSaved]);

  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className={styles.field}>
        <label className={styles.label}>Brand name</label>
        <input
          name="name"
          defaultValue={brand?.name}
          maxLength={100}
          required
          autoFocus
          className={fe.name ? styles.inputInvalid : styles.input}
        />
        {fe.name && <span className={styles.fieldError}>{fe.name}</span>}
      </div>
      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
      <div className={styles.actions} style={{ justifyContent: "flex-end" }}>
        <button type="button" className={styles.btn} onClick={onCancel} disabled={pending}>
          Cancel
        </button>
        <button type="submit" className={styles.btnPrimary} disabled={pending}>
          {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Create brand"}
        </button>
      </div>
    </form>
  );
}
