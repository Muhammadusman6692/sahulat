"use client";

import { useActionState, useEffect, useRef } from "react";
import { createAuthorityAction, type FormState } from "./actions";
import AuthorityRow from "./authority-row";
import styles from "@/components/form/form.module.css";
import gridStyles from "@/components/data-grid/grid.module.css";

export default function AuthoritiesPanel({
  authorities,
  mayCreate,
  mayEdit,
}: {
  authorities: { code: string; name: string }[];
  mayCreate: boolean;
  mayEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createAuthorityAction,
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
      <h2 className={gridStyles.title} style={{ fontSize: 16 }}>
        Tax Authorities
      </h2>
      <p className={styles.hint} style={{ marginBottom: 14 }}>
        The revenue bodies documents are filed with — shared across every
        company on this instance.
      </p>

      <table className={gridStyles.table}>
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {authorities.map((a) => (
            <AuthorityRow key={a.code} code={a.code} name={a.name} mayEdit={mayEdit} />
          ))}
        </tbody>
      </table>

      {mayCreate && (
        <form
          ref={formRef}
          action={formAction}
          style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 14 }}
        >
          <div className={styles.field} style={{ width: 120 }}>
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
          <div className={styles.field} style={{ flex: 1 }}>
            <input
              name="name"
              placeholder="Authority name"
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
