import { notFound } from "next/navigation";
import { requirePermission, requireScope } from "@/lib/dal";
import { getFiscalYear, getFiscalPeriods } from "@/lib/db/fiscal";
import { can } from "@/lib/permissions";
import BackLink from "@/components/back-link/back-link";
import RenameForm from "../rename-form";
import FiscalYearStatus from "../fiscal-year-status";
import PeriodRow from "../period-row";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "Fiscal year · Sahulat ERP" };

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function FiscalYearDetailPage({
  params,
}: PageProps<"/admin/fiscal-years/[fyId]">) {
  const user = await requirePermission("FISCAL_MAINT", "VIEW");

  const { fyId } = await params;
  const id = Number(fyId);
  if (!Number.isInteger(id)) notFound();

  const fy = await getFiscalYear(id);
  if (!fy) notFound();

  // Stops a fiscal year in another company being viewed by guessing its id.
  await requireScope(fy.COMPANY_ID);

  const periods = await getFiscalPeriods(id);
  const mayEdit = can(user.permissions, "FISCAL_MAINT", "EDIT");
  const mayApprove = can(user.permissions, "PERIOD_CLOSE", "APPROVE");

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <BackLink href="/admin/fiscal-years">Fiscal Years</BackLink>
          <h1 className={styles.title} style={{ marginTop: 4 }}>
            {fy.FY_NAME}
          </h1>
          <p className={styles.subtitle}>
            {fy.COMPANY_CODE} — {fy.COMPANY_NAME} · {fmtDate(fy.START_DATE)} to{" "}
            {fmtDate(fy.END_DATE)}
          </p>
        </div>
      </div>

      <div
        className={styles.card}
        style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 24 }}
      >
        <div>
          <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 5 }}>
            Fiscal year name
          </div>
          <RenameForm fyId={fy.FY_ID} fyName={fy.FY_NAME} canEdit={mayEdit} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 5 }}>
            Status
          </div>
          <FiscalYearStatus fyId={fy.FY_ID} status={fy.STATUS} canApprove={mayApprove} />
        </div>
      </div>

      <div className={styles.card}>
        <div
          style={{
            padding: "11px 14px",
            borderBottom: "1px solid var(--rule)",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Periods
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Start</th>
              <th>End</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <PeriodRow
                key={p.PERIOD_ID}
                periodId={p.PERIOD_ID}
                fyId={fy.FY_ID}
                periodNo={p.PERIOD_NO}
                startDate={p.START_DATE}
                endDate={p.END_DATE}
                status={p.STATUS}
                canApprove={mayApprove}
              />
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.note}>
        A voucher dated inside a closed period is refused at posting, whatever
        the fiscal year&apos;s own status shows. The fiscal year can only be
        marked closed once every period here is already closed.
      </p>
    </div>
  );
}
