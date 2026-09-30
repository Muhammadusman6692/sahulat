"use client";

import { useActionState, useEffect, useRef } from "react";
import { createUomAction, updateUomAction, type FormState } from "./actions";
import styles from "@/components/form/form.module.css";

type Uom = { code: string; name: string; allowDecimal: string };

export default function UomForm({
  mode,
  uom,
  onSaved,
  onCancel,
}: {
  mode: "create" | "edit";
  uom?: Uom;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const action = mode === "edit" ? updateUomAction.bind(null, uom!.code) : createUomAction;
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
          defaultValue={uom?.code}
          maxLength={10}
          required
          disabled={mode === "edit"}
          className={fe.code ? styles.inputInvalid : styles.input}
          style={{ textTransform: "uppercase" }}
        />
        {fe.code && <span className={styles.fieldError}>{fe.code}</span>}
        {mode === "edit" && (
          <span className={styles.hint}>Fixed once the unit exists.</span>
        )}
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Unit name</label>
        <input
          name="name"
          defaultValue={uom?.name}
          maxLength={50}
          required
          className={fe.name ? styles.inputInvalid : styles.input}
        />
        {fe.name && <span className={styles.fieldError}>{fe.name}</span>}
      </div>
      <label className={styles.checkRow}>
        <input
          type="checkbox"
          name="allowDecimal"
          defaultChecked={mode === "edit" ? uom!.allowDecimal === "Y" : true}
        />
        Allow decimal
      </label>
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
          {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Create unit"}
        </button>
      </div>
    </form>
  );
}
