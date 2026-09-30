"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateBrandAction, type FormState } from "./actions";
import styles from "@/components/form/form.module.css";
import gridStyles from "@/components/data-grid/grid.module.css";

export default function BrandRow({
  brandId,
  name,
  mayEdit,
}: {
  brandId: number;
  name: string;
  mayEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const action = updateBrandAction.bind(null, brandId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) setEditing(false);
    wasPending.current = pending;
  }, [pending, state.error]);

  if (!editing) {
    return (
      <tr>
        <td>{name}</td>
        <td style={{ textAlign: "right" }}>
          {mayEdit && (
            <button type="button" className={gridStyles.pageLink} onClick={() => setEditing(true)}>
              Rename
            </button>
          )}
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={2}>
        <form action={formAction} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            name="name"
            defaultValue={name}
            maxLength={100}
            required
            className={styles.input}
            style={{ maxWidth: 280 }}
          />
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
