"use client";

import { useActionState, useEffect, useRef } from "react";
import { createUomAction, type FormState } from "./actions";
import UomRow from "./uom-row";
import styles from "@/components/form/form.module.css";
import gridStyles from "@/components/data-grid/grid.module.css";

export default function UomPanel({
  uoms,
  mayCreate,
  mayEdit,
}: {
  uoms: { code: string; name: string; allowDecimal: string }[];
  mayCreate: boolean;
  mayEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createUomAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) formRef.current?.reset();
    wasPending.current = pending;
  }, [pending, state.error]);

  const fe = state.fieldErrors ?? {};

  return (
    <div className={gridStyles.card}>
      <h2 className={gridStyles.title} style={{ fontSize: 16 }}>
        Units of Measure
      </h2>
      <p className={styles.hint} style={{ marginBottom: 14 }}>
        The units items are stocked and sold in — shared across every company
        on this instance. A code already used by an item can still have its
        name and decimal setting changed, just not be renamed away.
      </p>

      <table className={gridStyles.table}>
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Allows decimal qty</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {uoms.map((u) => (
            <UomRow key={u.code} code={u.code} name={u.name} allowDecimal={u.allowDecimal} mayEdit={mayEdit} />
          ))}
        </tbody>
      </table>

      {mayCreate && (
        <form
          ref={formRef}
          action={formAction}
          style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 14, flexWrap: "wrap" }}
        >
          <div className={styles.field} style={{ width: 110 }}>
            <input
              name="code"
              placeholder="Code"
              maxLength={10}
              required
              className={fe.code ? styles.inputInvalid : styles.input}
              style={{ textTransform: "uppercase" }}
            />
            {fe.code && <span className={styles.fieldError}>{fe.code}</span>}
          </div>
          <div className={styles.field} style={{ flex: 1, minWidth: 160 }}>
            <input
              name="name"
              placeholder="Unit name"
              maxLength={50}
              required
              className={fe.name ? styles.inputInvalid : styles.input}
            />
            {fe.name && <span className={styles.fieldError}>{fe.name}</span>}
          </div>
          <label className={styles.checkRow} style={{ paddingTop: 8 }}>
            <input type="checkbox" name="allowDecimal" defaultChecked />
            Allow decimal
          </label>
          <button type="submit" className={styles.btnPrimary} disabled={pending}>
            {pending ? "Adding…" : "Add"}
          </button>
        </form>
      )}
      {state.error && (
        <p className={styles.error} role="alert" style={{ marginTop: 10 }}>
          {state.error}
        </p>
      )}
    </div>
  );
}
