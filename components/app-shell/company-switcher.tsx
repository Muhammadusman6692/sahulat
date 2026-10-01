"use client";

import { switchCompanyAction } from "./scope-actions";
import type { CompanyOption } from "@/lib/db/scope";
import styles from "./shell.module.css";

export default function CompanySwitcher({
  companies,
  activeCompanyId,
}: {
  companies: CompanyOption[];
  activeCompanyId: number;
}) {
  return (
    <form action={switchCompanyAction}>
      <select
        name="companyId"
        className={styles.scopeSelect}
        defaultValue={activeCompanyId}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        aria-label="Switch company"
      >
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </form>
  );
}
