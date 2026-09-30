"use client";

import { useActionState, useEffect, useRef } from "react";
import { createCategoryAction, type FormState } from "./actions";
import CategoryRow from "./category-row";
import styles from "@/components/form/form.module.css";
import gridStyles from "@/components/data-grid/grid.module.css";

export default function CategoryPanel({
  categories,
  mayCreate,
  mayEdit,
}: {
  categories: { id: number; name: string; itemCount: number }[];
  mayCreate: boolean;
  mayEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createCategoryAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) formRef.current?.reset();
    wasPending.current = pending;
  }, [pending, state.error]);

  const fe = state.fieldErrors ?? {};

  return (
    <div className={gridStyles.card}>
      {categories.length === 0 ? (
        <p className={gridStyles.empty}>No item categories yet.</p>
      ) : (
        <table className={gridStyles.table}>
          <thead>
            <tr>
              <th>Category</th>
              <th style={{ textAlign: "right" }}>Items</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <CategoryRow
                key={c.id}
                id={c.id}
                name={c.name}
                itemCount={c.itemCount}
                mayEdit={mayEdit}
              />
            ))}
          </tbody>
        </table>
      )}

      {mayCreate && (
        <form
          ref={formRef}
          action={formAction}
          style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: 14, flexWrap: "wrap" }}
        >
          <div className={styles.field} style={{ flex: 1, minWidth: 200 }}>
            <input
              name="name"
              placeholder="Category name"
              maxLength={100}
              required
              className={fe.name ? styles.inputInvalid : styles.input}
            />
            {fe.name && <span className={styles.fieldError}>{fe.name}</span>}
          </div>
          <button type="submit" className={styles.btnPrimary} disabled={pending}>
            {pending ? "Adding…" : "Add"}
          </button>
        </form>
      )}
      {state.error && (
        <p className={styles.error} role="alert" style={{ margin: "0 14px 14px" }}>
          {state.error}
        </p>
      )}
    </div>
  );
}
