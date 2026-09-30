"use client";

import { useActionState, useEffect, useRef } from "react";
import { createAuthorityAction, renameAuthorityAction, type FormState } from "./actions";
import styles from "@/components/form/form.module.css";

type Authority = { code: string; name: string };

export default function AuthorityForm({
  mode,
  authority,
  onSaved,
  onCancel,
}: {
  mode: "create" | "edit";
  authority?: Authority;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const action =
    mode === "edit" ? renameAuthorityAction.bind(null, authority!.code) : createAuthorityAction;
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
        <label className={styles.label}>Code</label>
        <input
          name="code"
          defaultValue={authority?.code}
          maxLength={10}
          required
          disabled={mode === "edit"}
          className={fe.code ? styles.inputInvalid : styles.input}
          style={{ textTransform: "uppercase" }}
        />
        {fe.code && <span className={styles.fieldError}>{fe.code}</span>}
        {mode === "edit" && (
          <span className={styles.hint}>Fixed once the authority exists.</span>
        )}
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Authority name</label>
        <input
          name="name"
          defaultValue={authority?.name}
          maxLength={100}
          required
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
          {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Create authority"}
        </button>
      </div>
    </form>
  );
}
