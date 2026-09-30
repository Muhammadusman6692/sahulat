import { requirePermission } from "@/lib/dal";
import { listApprovableModules, listApproverRoles } from "@/lib/db/approvals";
import { getCompany } from "@/lib/db/companies";
import ApprovalRuleForm from "../approval-rule-form";
import BackLink from "@/components/back-link/back-link";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "New approval rule · Sahulat ERP" };

export default async function NewApprovalRulePage() {
  const user = await requirePermission("APPROVAL_MAINT", "CREATE");
  const companyId = user.access[0]?.companyId;

  if (!companyId) {
    return <p className={styles.empty}>Your account is not scoped to any company.</p>;
  }

  const [company, modules, roles] = await Promise.all([
    getCompany(companyId),
    listApprovableModules(),
    listApproverRoles(companyId),
  ]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <BackLink href="/admin/approvals">Approval Rules</BackLink>
          <h1 className={styles.title} style={{ marginTop: 4 }}>
            New approval rule
          </h1>
          <p className={styles.subtitle}>
            {company ? `${company.COMPANY_CODE} — ${company.COMPANY_NAME}` : ""}
          </p>
        </div>
      </div>

      <ApprovalRuleForm
        rule={null}
        companyId={companyId}
        companyLabel={company ? `${company.COMPANY_CODE} — ${company.COMPANY_NAME}` : ""}
        modules={modules}
        roles={roles}
      />
    </div>
  );
}
