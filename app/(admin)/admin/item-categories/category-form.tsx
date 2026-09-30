"use client";

import { useActionState, useEffect, useRef } from "react";
import { createCategoryAction, updateCategoryAction, type FormState } from "./actions";
import styles from "@/components/form/form.module.css";

type Category = { id: number; name: string };

export default function CategoryForm({
  mode,
  category,
  onSaved,
  onCancel,
}: {
  mode: "create" | "edit";
  category?: Category;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const action = mode === "edit" ? updateCategoryAction.bind(null, category!.id) : createCategoryAction;
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
        <label className={styles.label}>Category name</label>
        <input
          name="name"
          defaultValue={category?.name}
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
          {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Create category"}
        </button>
      </div>
    </form>
  );
}
