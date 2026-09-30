"use client";

import { useActionState, useEffect, useRef } from "react";
import { createBrandAction, type FormState } from "./actions";
import BrandRow from "./brand-row";
import styles from "@/components/form/form.module.css";
import gridStyles from "@/components/data-grid/grid.module.css";

export default function BrandPanel({
  companyId,
  brands,
  mayCreate,
  mayEdit,
}: {
  companyId: number;
  brands: { brandId: number; name: string }[];
  mayCreate: boolean;
  mayEdit: boolean;
}) {
  const action = createBrandAction.bind(null, companyId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
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
        Brands
      </h2>
      <p className={styles.hint} style={{ marginBottom: 14 }}>
        Each company keeps its own brand list. No delete — items reference
        brands by id, so rename instead.
      </p>

      <table className={gridStyles.table}>
        <thead>
          <tr>
            <th>Brand</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {brands.map((b) => (
            <BrandRow key={b.brandId} brandId={b.brandId} name={b.name} mayEdit={mayEdit} />
          ))}
        </tbody>
      </table>

      {mayCreate && (
        <form
          ref={formRef}
          action={formAction}
          style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 14 }}
        >
          <div className={styles.field} style={{ flex: 1, maxWidth: 340 }}>
            <input
              name="name"
              placeholder="Brand name"
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
        <p className={styles.error} role="alert" style={{ marginTop: 10 }}>
          {state.error}
        </p>
      )}
    </div>
  );
}
