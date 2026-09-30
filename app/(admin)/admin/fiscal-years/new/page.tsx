import { requirePermission } from "@/lib/dal";
import {
  listScopedCompaniesForFiscal,
  listCompanyFiscalYears,
} from "@/lib/db/fiscal";
import { suggestNextStart } from "@/lib/fiscal-calendar";
import NewFiscalYearForm from "../new-fiscal-year-form";
import BackLink from "@/components/back-link/back-link";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "New fiscal year · Sahulat ERP" };

export default async function NewFiscalYearPage() {
  const user = await requirePermission("FISCAL_MAINT", "CREATE");

  const companyIds = [...new Set(user.access.map((a) => a.companyId))];
  const companies = await listScopedCompaniesForFiscal(companyIds);

  const suggestedStarts: Record<number, string> = {};
  for (const c of companies) {
    const existing = await listCompanyFiscalYears(c.COMPANY_ID);
    const start = suggestNextStart(
      existing.map((fy) => ({ startDate: fy.START_DATE, endDate: fy.END_DATE })),
      c.FY_START_MONTH,
    );
    suggestedStarts[c.COMPANY_ID] = start.toISOString().slice(0, 10);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <BackLink href="/admin/fiscal-years">Fiscal Years</BackLink>
          <h1 className={styles.title} style={{ marginTop: 4 }}>
            New fiscal year
          </h1>
          <p className={styles.subtitle}>
            Creates the year and its twelve monthly periods together — a
            fiscal year is never left without periods.
          </p>
        </div>
      </div>

      {companies.length === 0 ? (
        <p className={styles.empty}>
          Your account is not scoped to any active company, so there is
          nothing to create a fiscal year under.
        </p>
      ) : (
        <NewFiscalYearForm
          companies={companies.map((c) => ({
            id: c.COMPANY_ID,
            code: c.COMPANY_CODE,
            name: c.COMPANY_NAME,
            fyStartMonth: c.FY_START_MONTH,
          }))}
          suggestedStarts={suggestedStarts}
        />
      )}
    </div>
  );
}
