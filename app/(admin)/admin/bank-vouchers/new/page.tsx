import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/dal";
import { getActiveCompanyId } from "@/lib/active-scope";
import { getCompany } from "@/lib/db/companies";
import { listBranches } from "@/lib/db/branches";
import { listPostableAccounts } from "@/lib/db/coa";
import type { BvType } from "@/lib/db/bank-vouchers";
import BvForm from "../bv-form";
import BackLink from "@/components/back-link/back-link";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "New Bank Voucher · Sahulat ERP" };

const TITLE: Record<BvType, string> = { BPV: "New Bank Payment Voucher", BRV: "New Bank Receipt Voucher" };
const SUBTITLE: Record<BvType, string> = {
  BPV: "Pick the bank account being paid out of, then the expense or party being paid.",
  BRV: "Pick the bank account being received into, then the income or party it came from.",
};

export default async function NewBankVoucherPage({
  searchParams,
}: PageProps<"/admin/bank-vouchers/new">) {
  const sp = await searchParams;
  const typeRaw = Array.isArray(sp.type) ? sp.type[0] : sp.type;
  const voucherType: BvType | null = typeRaw === "BPV" || typeRaw === "BRV" ? typeRaw : null;
  if (!voucherType) notFound();

  const user = await requirePermission("BANK_VOUCHER", "CREATE");
  const companyId = await getActiveCompanyId(user.access);

  if (!companyId) {
    return <p className={styles.empty}>Your account is not scoped to any company.</p>;
  }

  const [company, branches, accounts] = await Promise.all([
    getCompany(companyId),
    listBranches([companyId], false),
    listPostableAccounts(companyId),
  ]);

  const allAccounts = accounts.map((a) => ({
    id: a.COA_ID,
    code: a.ACCOUNT_CODE,
    name: a.ACCOUNT_NAME,
    controlType: a.IS_CONTROL_AC,
    parentName: a.PARENT_NAME,
  }));
  const bankAccounts = allAccounts.filter((a) => a.controlType === "BANK");
  const freeLegAccounts = allAccounts.filter((a) => a.controlType !== "CASH" && a.controlType !== "BANK");

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <BackLink href="/admin/bank-vouchers">Bank Payment / Receipt</BackLink>
          <h1 className={styles.title} style={{ marginTop: 4 }}>
            {TITLE[voucherType]}
          </h1>
          <p className={styles.subtitle}>{SUBTITLE[voucherType]}</p>
        </div>
      </div>

      <BvForm
        mode="create"
        voucherType={voucherType}
        companyLabel={company ? `${company.COMPANY_CODE} — ${company.COMPANY_NAME}` : ""}
        branches={branches.map((b) => ({ id: b.BRANCH_ID, code: b.BRANCH_CODE, name: b.BRANCH_NAME }))}
        bankAccounts={bankAccounts}
        freeLegAccounts={freeLegAccounts}
        initial={{
          branchId: branches[0]?.BRANCH_ID ?? 0,
          branchLabel: "",
          voucherDate: new Date().toISOString().slice(0, 10),
          voucherNo: null,
          bankCoaId: 0,
          bankAccountLabel: "",
          narration: "",
          instrumentType: "CHEQUE",
          instrumentNo: "",
          instrumentDate: new Date().toISOString().slice(0, 10),
          lines: [],
        }}
      />
    </div>
  );
}
