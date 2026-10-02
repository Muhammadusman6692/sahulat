import { requirePermission, requireScope } from "@/lib/dal";
import { getActiveCompanyId } from "@/lib/active-scope";
import { listFiscalYears } from "@/lib/db/fiscal";
import { getCloseChecklist, getCloseLog } from "@/lib/db/period-close";
import { can } from "@/lib/permissions";
import FySelect from "./fy-select";
import PeriodRow from "./period-row";
import ReopenYearButton from "./reopen-year-button";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "Period Close · Sahulat ERP" };

function fmtDateTime(d: Date) {
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ACTION_LABEL: Record<string, string> = {
  PERIOD_CLOSE: "Closed",
  PERIOD_REOPEN: "Reopened",
  FY_CLOSE: "Year closed",
  FY_REOPEN: "Year reopened",
};

export default async function PeriodClosePage({
  searchParams,
}: PageProps<"/admin/period-close">) {
  const user = await requirePermission("PERIOD_CLOSE", "VIEW");

  const companyId = await getActiveCompanyId(user.access);
  if (!companyId) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Period Close</h1>
        <p className={styles.empty}>You are not scoped to any company.</p>
      </div>
    );
  }
  await requireScope(companyId);

  const years = (await listFiscalYears([companyId])).filter(
    (y) => y.COMPANY_ID === companyId,
  );

  if (years.length === 0) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Period Close</h1>
        <p className={styles.empty}>
          No fiscal years exist yet for this company. Create one under Fiscal
          Years first.
        </p>
      </div>
    );
  }

  const { fy: fyParam } = await searchParams;
  const requested = fyParam ? years.find((y) => y.FY_ID === Number(fyParam)) : undefined;
  const selected = requested ?? years.find((y) => y.STATUS === "OPEN") ?? years[0];

  const [periods, log] = await Promise.all([
    getCloseChecklist(selected.FY_ID),
    getCloseLog(selected.FY_ID),
  ]);

  const mayApprove = can(user.permissions, "PERIOD_CLOSE", "APPROVE");

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <h1 className={styles.title}>Period Close</h1>
          <p className={styles.subtitle}>
            A period can only be closed once every voucher in it is posted or
            cancelled, and its posted debits equal its posted credits. Closing
            and reopening are both logged below.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FySelect years={years} selectedFyId={selected.FY_ID} />
          {selected.STATUS === "CLOSED" && mayApprove && (
            <ReopenYearButton fyId={selected.FY_ID} fyName={selected.FY_NAME} />
          )}
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
              <th style={{ textAlign: "right" }}>Drafts blocking</th>
              <th>Balanced</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {periods.map((p, i) => (
              <PeriodRow
                key={p.PERIOD_ID}
                periodId={p.PERIOD_ID}
                fyId={selected.FY_ID}
                fyName={selected.FY_NAME}
                periodNo={p.PERIOD_NO}
                startDate={p.START_DATE}
                endDate={p.END_DATE}
                status={p.STATUS}
                draftCount={p.DRAFT_COUNT}
                balanced={p.BALANCED}
                canApprove={mayApprove}
                isLastPeriod={i === periods.length - 1}
              />
            ))}
          </tbody>
        </table>
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
          Recent activity
        </div>
        {log.length === 0 ? (
          <p className={styles.empty}>No close/reopen actions yet for this fiscal year.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Action</th>
                <th>Period</th>
                <th>Reason</th>
                <th>By</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.LOG_ID}>
                  <td className={styles.strong}>{ACTION_LABEL[l.ACTION] ?? l.ACTION}</td>
                  <td className={styles.muted}>{l.PERIOD_NO ?? "—"}</td>
                  <td className={styles.muted}>{l.REASON ?? "—"}</td>
                  <td className={styles.muted}>{l.PERFORMED_BY_NAME}</td>
                  <td className={styles.muted}>{fmtDateTime(l.PERFORMED_ON)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
