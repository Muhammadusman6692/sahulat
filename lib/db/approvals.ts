import "server-only";
import { query, execute } from "@/lib/oracle";

export type ApprovalRuleRow = {
  RULE_ID: number;
  COMPANY_ID: number;
  MODULE_CODE: string;
  MODULE_NAME: string;
  STEP_NO: number;
  APPROVER_ROLE_ID: number;
  APPROVER_ROLE_NAME: string;
  MIN_AMOUNT: number;
};

const SELECT_RULE = `
  SELECT ar.rule_id, ar.company_id, ar.module_code, m.module_name,
         ar.step_no, ar.approver_role_id, r.role_name AS approver_role_name,
         ar.min_amount
    FROM approval_rule ar
    JOIN module_function m ON m.module_code = ar.module_code
    JOIN role r ON r.role_id = ar.approver_role_id
`;

export async function listApprovalRules(companyId: number) {
  return query<ApprovalRuleRow>(
    `${SELECT_RULE} WHERE ar.company_id = :companyId ORDER BY m.sort_order, ar.step_no`,
    { companyId },
  );
}

export async function getApprovalRule(ruleId: number) {
  const rows = await query<ApprovalRuleRow>(`${SELECT_RULE} WHERE ar.rule_id = :id`, {
    id: ruleId,
  });
  return rows[0] ?? null;
}

export type ApprovableModule = {
  MODULE_CODE: string;
  MODULE_NAME: string;
};

/**
 * Approval rules only make sense on documents, not on master-data or report
 * screens. module_function has no explicit flag for that, so this is a
 * naming-convention filter (judgment call) — adjust here if a module should
 * or shouldn't offer an approval rule.
 */
export async function listApprovableModules() {
  return query<ApprovableModule>(
    `SELECT module_code, module_name
       FROM module_function
      WHERE module_group IN ('ACCOUNTING','TRADING','POS','DISTRIBUTION')
        AND module_code NOT LIKE '%MAINT%'
        AND module_code NOT LIKE '%\\_RPT' ESCAPE '\\'
        AND module_code NOT LIKE '%STATUS%'
        AND module_code NOT IN ('GL_REPORT','TRIAL_BALANCE','PROFIT_LOSS',
                                 'BALANCE_SHEET','PARTY_LEDGER','AGING_REPORT','PERIOD_CLOSE')
      ORDER BY sort_order`,
  );
}

export type ApproverRole = {
  ROLE_ID: number;
  ROLE_NAME: string;
};

export async function listApproverRoles(companyId: number) {
  return query<ApproverRole>(
    `SELECT role_id, role_name
       FROM role
      WHERE (company_id = :companyId OR company_id IS NULL)
        AND active_yn = 'Y'
      ORDER BY role_name`,
    { companyId },
  );
}

export type ApprovalRuleIdentity = {
  companyId: number;
  moduleCode: string;
  stepNo: number;
};

export type ApprovalRuleSettings = {
  approverRoleId: number;
  minAmount: number;
};

export async function createApprovalRule(
  identity: ApprovalRuleIdentity,
  settings: ApprovalRuleSettings,
) {
  await execute(
    `INSERT INTO approval_rule (company_id, module_code, step_no, approver_role_id, min_amount)
     VALUES (:companyId, :moduleCode, :stepNo, :approverRoleId, :minAmount)`,
    { ...identity, ...settings },
  );
}

/**
 * Identity (company/module/step) is fixed once a rule exists — the same
 * rationale as numbering series: a document already evaluated under this
 * identity must keep resolving to it.
 */
export async function updateApprovalRule(ruleId: number, settings: ApprovalRuleSettings) {
  await execute(
    `UPDATE approval_rule
        SET approver_role_id = :approverRoleId,
            min_amount       = :minAmount
      WHERE rule_id = :ruleId`,
    { ...settings, ruleId },
  );
}
