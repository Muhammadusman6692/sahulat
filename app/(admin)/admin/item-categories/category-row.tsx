"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateCategoryAction, type FormState } from "./actions";
import styles from "@/components/form/form.module.css";
import gridStyles from "@/components/data-grid/grid.module.css";

export default function CategoryRow({
  id,
  name,
  itemCount,
  mayEdit,
}: {
  id: number;
  name: string;
  itemCount: number;
  mayEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const action = updateCategoryAction.bind(null, id);
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
        <td className={gridStyles.num}>{itemCount}</td>
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
      <td colSpan={3}>
        <form action={formAction} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            name="name"
            defaultValue={name}
            maxLength={100}
            required
            className={styles.input}
            style={{ maxWidth: 260 }}
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
