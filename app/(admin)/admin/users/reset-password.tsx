"use client";

import { useActionState } from "react";
import { setPasswordAction, type PasswordFormState } from "./actions";
import formStyles from "@/components/form/form.module.css";
import gridStyles from "@/components/data-grid/grid.module.css";

export default function ResetPassword({ userId }: { userId: number }) {
  const action = setPasswordAction.bind(null, userId);
  const [state, formAction, pending] = useActionState<PasswordFormState, FormData>(action, {});

  return (
    <div className={gridStyles.card} style={{ padding: 16 }}>
      <h2 className={formStyles.sectionTitle}>Reset password</h2>
      <form action={formAction} style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div className={formStyles.field} style={{ width: 190 }}>
          <label className={formStyles.label} htmlFor="password">
            New password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className={formStyles.input}
            minLength={8}
            required
          />
        </div>
        <div className={formStyles.field} style={{ width: 190 }}>
          <label className={formStyles.label} htmlFor="confirmPassword">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            className={formStyles.input}
            minLength={8}
            required
          />
        </div>
        <button type="submit" className={formStyles.btnPrimary} disabled={pending}>
          {pending ? "Saving…" : "Set password"}
        </button>
        {state.error && (
          <span style={{ color: "var(--danger)", fontSize: 12 }}>{state.error}</span>
        )}
        {state.ok && (
          <span style={{ color: "var(--primary)", fontSize: 12 }}>Password updated.</span>
        )}
      </form>
    </div>
  );
}
