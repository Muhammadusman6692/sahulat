"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateUomAction, type FormState } from "./actions";
import styles from "@/components/form/form.module.css";
import gridStyles from "@/components/data-grid/grid.module.css";

export default function UomRow({
  code,
  name,
  allowDecimal,
  mayEdit,
}: {
  code: string;
  name: string;
  allowDecimal: string;
  mayEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const action = updateUomAction.bind(null, code);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) setEditing(false);
    wasPending.current = pending;
  }, [pending, state.error]);

  if (!editing) {
    return (
      <tr>
        <td className={gridStyles.code}>{code}</td>
        <td>{name}</td>
        <td>
          {allowDecimal === "Y" ? (
            <span style={{ color: "var(--primary)", fontWeight: 600 }}>Yes</span>
          ) : (
            <span className={gridStyles.muted}>No</span>
          )}
        </td>
        <td style={{ textAlign: "right" }}>
          {mayEdit && (
            <button type="button" className={gridStyles.pageLink} onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className={gridStyles.code}>{code}</td>
      <td colSpan={3}>
        <form action={formAction} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            name="name"
            defaultValue={name}
            maxLength={50}
            required
            className={styles.input}
            style={{ maxWidth: 220 }}
          />
          <label className={styles.checkRow}>
            <input type="checkbox" name="allowDecimal" defaultChecked={allowDecimal === "Y"} />
            Allow decimal
          </label>
          <button type="submit" className={styles.btnPrimary} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
          <button type="button" className={styles.btn} onClick={() => setEditing(false)}>
            Cancel
          </button>
          {state.error && (
            <span className={styles.fieldError} role="alert">
              {state.error}
            </span>
          )}
        </form>
      </td>
    </tr>
  );
}
