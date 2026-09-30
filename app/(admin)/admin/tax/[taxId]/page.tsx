import { notFound } from "next/navigation";
import { requirePermission, requireScope } from "@/lib/dal";
import { getTaxCode, listAuthorities } from "@/lib/db/tax";
import { listPostableAccounts } from "@/lib/db/default-accounts";
import { getCompany } from "@/lib/db/companies";
import TaxCodeForm from "../tax-code-form";
import BackLink from "@/components/back-link/back-link";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "Edit tax code · Sahulat ERP" };

export default async function EditTaxCodePage({
  params,
}: PageProps<"/admin/tax/[taxId]">) {
  await requirePermission("TAX_MAINT", "EDIT");

  const { taxId } = await params;
  const id = Number(taxId);
  if (!Number.isInteger(id)) notFound();

  const taxCode = await getTaxCode(id);
  if (!taxCode) notFound();

  // Stops a tax code in another company being edited by guessing its id.
  await requireScope(taxCode.COMPANY_ID);

  const [company, authorities, accounts] = await Promise.all([
    getCompany(taxCode.COMPANY_ID),
    listAuthorities(),
    listPostableAccounts(taxCode.COMPANY_ID),
  ]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <BackLink href="/admin/tax">Tax Authority &amp; Master</BackLink>
          <h1 className={styles.title} style={{ marginTop: 4 }}>
            {taxCode.TAX_CODE}
          </h1>
          <p className={styles.subtitle}>
            {company ? `${company.COMPANY_CODE} — ${company.COMPANY_NAME}` : ""}
          </p>
        </div>
      </div>

      <TaxCodeForm
        taxCode={taxCode}
        companyLabel={company ? `${company.COMPANY_CODE} — ${company.COMPANY_NAME}` : ""}
        authorities={authorities.map((a) => ({
          value: a.AUTHORITY_CODE,
          label: `${a.AUTHORITY_CODE} — ${a.AUTHORITY_NAME}`,
        }))}
        accounts={accounts.map((a) => ({
          value: String(a.COA_ID),
          label: `${a.ACCOUNT_CODE} — ${a.ACCOUNT_NAME}`,
        }))}
      />
    </div>
  );
}
