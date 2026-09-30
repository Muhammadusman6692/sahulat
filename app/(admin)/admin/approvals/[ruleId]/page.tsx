import { notFound } from "next/navigation";
import { requirePermission, requireScope } from "@/lib/dal";
import { getApprovalRule, listApproverRoles } from "@/lib/db/approvals";
import { getCompany } from "@/lib/db/companies";
import ApprovalRuleForm from "../approval-rule-form";
import BackLink from "@/components/back-link/back-link";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "Edit approval rule · Sahulat ERP" };

export default async function EditApprovalRulePage({
  params,
}: PageProps<"/admin/approvals/[ruleId]">) {
  await requirePermission("APPROVAL_MAINT", "EDIT");

  const { ruleId } = await params;
  const id = Number(ruleId);
  if (!Number.isInteger(id)) notFound();

  const rule = await getApprovalRule(id);
  if (!rule) notFound();

  // Stops a rule in another company being edited by guessing its id.
  await requireScope(rule.COMPANY_ID);

  const [company, roles] = await Promise.all([
    getCompany(rule.COMPANY_ID),
    listApproverRoles(rule.COMPANY_ID),
  ]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <BackLink href="/admin/approvals">Approval Rules</BackLink>
          <h1 className={styles.title} style={{ marginTop: 4 }}>
            {rule.MODULE_NAME} · Step {rule.STEP_NO}
          </h1>
          <p className={styles.subtitle}>
            {company ? `${company.COMPANY_CODE} — ${company.COMPANY_NAME}` : ""}
          </p>
        </div>
      </div>

      <ApprovalRuleForm
        rule={rule}
        companyLabel={company ? `${company.COMPANY_CODE} — ${company.COMPANY_NAME}` : ""}
        modules={[]}
        roles={roles}
      />
    </div>
  );
}
