import { requirePermission } from "@/lib/dal";
import { getActiveCompanyId } from "@/lib/active-scope";
import { getCompany } from "@/lib/db/companies";
import { listBranches } from "@/lib/db/branches";
import { listPostableAccounts } from "@/lib/db/coa";
import JvForm from "../jv-form";
import BackLink from "@/components/back-link/back-link";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "New Journal Voucher · Sahulat ERP" };

export default async function NewJournalVoucherPage() {
  const user = await requirePermission("JV_ENTRY", "CREATE");
  const companyId = await getActiveCompanyId(user.access);

  if (!companyId) {
    return <p className={styles.empty}>Your account is not scoped to any company.</p>;
  }

  const [company, branches, accounts] = await Promise.all([
    getCompany(companyId),
    listBranches([companyId], false),
    listPostableAccounts(companyId),
  ]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <BackLink href="/admin/journal-vouchers">Journal Vouchers</BackLink>
          <h1 className={styles.title} style={{ marginTop: 4 }}>
            New Journal Voucher
          </h1>
          <p className={styles.subtitle}>
            Debit and credit totals must match before it can be saved.
          </p>
        </div>
      </div>

      <JvForm
        mode="create"
        companyLabel={company ? `${company.COMPANY_CODE} — ${company.COMPANY_NAME}` : ""}
        branches={branches.map((b) => ({ id: b.BRANCH_ID, code: b.BRANCH_CODE, name: b.BRANCH_NAME }))}
        accounts={accounts.map((a) => ({
          id: a.COA_ID,
          code: a.ACCOUNT_CODE,
          name: a.ACCOUNT_NAME,
          controlType: a.IS_CONTROL_AC,
          parentName: a.PARENT_NAME,
        }))}
        initial={{
          branchId: branches[0]?.BRANCH_ID ?? 0,
          branchLabel: "",
          voucherDate: new Date().toISOString().slice(0, 10),
          voucherNo: null,
          narration: "",
          lines: [],
        }}
      />
    </div>
  );
}
