import { notFound } from "next/navigation";
import { requirePermission, requireScope } from "@/lib/dal";
import { getSeries } from "@/lib/db/numbering";
import { listFiscalYears } from "@/lib/db/fiscal";
import { getCompany } from "@/lib/db/companies";
import SeriesForm from "../series-form";
import BackLink from "@/components/back-link/back-link";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "Edit numbering series · Sahulat ERP" };

export default async function EditSeriesPage({
  params,
}: PageProps<"/admin/numbering-series/[seriesId]">) {
  await requirePermission("NUMBERING_MAINT", "EDIT");

  const { seriesId } = await params;
  const id = Number(seriesId);
  if (!Number.isInteger(id)) notFound();

  const series = await getSeries(id);
  if (!series) notFound();

  // Stops a series in another company being edited by guessing its id.
  await requireScope(series.COMPANY_ID, series.BRANCH_ID);

  const [company, fiscalYears] = await Promise.all([
    getCompany(series.COMPANY_ID),
    listFiscalYears([series.COMPANY_ID]),
  ]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <BackLink href="/admin/numbering-series">Numbering Series</BackLink>
          <h1 className={styles.title} style={{ marginTop: 4 }}>
            {series.DOC_TYPE}
            {series.BRANCH_CODE ? ` · ${series.BRANCH_CODE}` : ""}
            {series.TERMINAL_ID ? ` · Terminal ${series.TERMINAL_ID}` : ""}
          </h1>
          <p className={styles.subtitle}>
            {company ? `${company.COMPANY_CODE} — ${company.COMPANY_NAME}` : ""}
          </p>
        </div>
      </div>

      <SeriesForm
        series={series}
        companyLabel={company ? `${company.COMPANY_CODE} — ${company.COMPANY_NAME}` : ""}
        branches={[]}
        fiscalYears={fiscalYears.map((f) => ({
          value: String(f.FY_ID),
          label: f.FY_NAME,
        }))}
      />
    </div>
  );
}
