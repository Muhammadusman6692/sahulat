import { notFound } from "next/navigation";
import { requirePermission, requireScope } from "@/lib/dal";
import { getCoaAccount } from "@/lib/db/coa";
import { getCompany } from "@/lib/db/companies";
import CoaForm from "../coa-form";
import BackLink from "@/components/back-link/back-link";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "Edit account · Sahulat ERP" };

export default async function EditCoaAccountPage({
  params,
}: PageProps<"/admin/coa/[coaId]">) {
  await requirePermission("COA_MAINT", "EDIT");

  const { coaId } = await params;
  const id = Number(coaId);
  if (!Number.isInteger(id)) notFound();

  const account = await getCoaAccount(id);
  if (!account) notFound();

  // Stops an account in another company being edited by guessing its id.
  await requireScope(account.COMPANY_ID);

  const company = await getCompany(account.COMPANY_ID);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <BackLink href="/admin/coa">Chart of Accounts</BackLink>
          <h1 className={styles.title} style={{ marginTop: 4 }}>
            {account.ACCOUNT_CODE} — {account.ACCOUNT_NAME}
          </h1>
          <p className={styles.subtitle}>
            {company ? `${company.COMPANY_CODE} — ${company.COMPANY_NAME}` : ""}
          </p>
        </div>
      </div>

      <CoaForm
        account={account}
        companyLabel={company ? `${company.COMPANY_CODE} — ${company.COMPANY_NAME}` : ""}
      />
    </div>
  );
}
