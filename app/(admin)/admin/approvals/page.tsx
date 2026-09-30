import Link from "next/link";
import { requirePermission } from "@/lib/dal";
import { listApprovalRules } from "@/lib/db/approvals";
import { can } from "@/lib/permissions";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "Approval Rules · Sahulat ERP" };

function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function ApprovalRulesPage() {
  const user = await requirePermission("APPROVAL_MAINT", "VIEW");
  const companyId = user.access[0]?.companyId;

  if (!companyId) {
    return <p className={styles.empty}>Your account is not scoped to any company.</p>;
  }

  const rows = await listApprovalRules(companyId);
  const mayCreate = can(user.permissions, "APPROVAL_MAINT", "CREATE");
  const mayEdit = can(user.permissions, "APPROVAL_MAINT", "EDIT");

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <h1 className={styles.title}>Approval Rules</h1>
          <p className={styles.subtitle}>
            Which role must approve which document, and above what amount.
            Steps for the same document run in order, lowest first.
          </p>
        </div>
        {mayCreate && (
          <Link href="/admin/approvals/new" className={styles.btnPrimary}>
            <svg
              width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            New rule
          </Link>
        )}
      </div>

      <div className={styles.card}>
        {rows.length === 0 ? (
          <p className={styles.empty}>No approval rules for this company yet.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Document</th>
                <th>Step</th>
                <th>Approver Role</th>
                <th style={{ textAlign: "right" }}>Min Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.RULE_ID}>
                  <td>{r.MODULE_NAME}</td>
                  <td className={styles.num}>{r.STEP_NO}</td>
                  <td className={styles.muted}>{r.APPROVER_ROLE_NAME}</td>
                  <td className={styles.num}>{money(r.MIN_AMOUNT)}</td>
                  <td style={{ textAlign: "right" }}>
                    {mayEdit && (
                      <Link href={`/admin/approvals/${r.RULE_ID}`} className={styles.pageLink}>
                        Edit
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className={styles.note}>
        Document, step number and company together identify a rule and are
        fixed once it exists — only the approver role and minimum amount can
        be changed afterwards.
      </p>
    </div>
  );
}
