import { requirePermission } from "@/lib/dal";
import { getActiveCompanyId } from "@/lib/active-scope";
import { listMyPendingApprovals } from "@/lib/db/approval-instances";
import ApprovalActionRow from "./approval-action-row";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "Pending Approvals · Sahulat ERP" };

function money(n: number | null) {
  if (n === null) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function timeAgo(d: Date) {
  const minutes = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default async function PendingApprovalsPage() {
  const user = await requirePermission("PENDING_APPROVALS", "VIEW");
  const companyId = await getActiveCompanyId(user.access);

  if (!companyId) {
    return <p className={styles.empty}>Your account is not scoped to any company.</p>;
  }

  const rows = await listMyPendingApprovals(user.userId, companyId);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <h1 className={styles.title}>Pending Approvals</h1>
          <p className={styles.subtitle}>
            Documents waiting on a step where one of your roles is the
            approver.
          </p>
        </div>
      </div>

      <div className={styles.card}>
        {rows.length === 0 ? (
          <p className={styles.empty}>Nothing pending your approval.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Document</th>
                <th>Step</th>
                <th style={{ textAlign: "right" }}>Amount</th>
                <th>Submitted</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.INSTANCE_ID}>
                  <td>
                    {r.MODULE_NAME} <span className={styles.muted}>#{r.DOC_ID}</span>
                  </td>
                  <td className={styles.num}>{r.STEP_NO}</td>
                  <td className={styles.num}>{money(r.DOC_AMOUNT)}</td>
                  <td className={styles.muted}>{timeAgo(r.SUBMITTED_ON)}</td>
                  <td>
                    <ApprovalActionRow instanceId={r.INSTANCE_ID} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
