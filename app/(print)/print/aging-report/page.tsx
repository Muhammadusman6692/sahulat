import { notFound } from "next/navigation";
import { requirePermission, requireScope } from "@/lib/dal";
import { getActiveCompanyId } from "@/lib/active-scope";
import { getAgingSummary } from "@/lib/db/aging-report";
import { getCompany } from "@/lib/db/companies";
import { fmtDate } from "@/lib/format";
import AgingPrintView from "@/components/print/aging-print-view";

export const metadata = { title: "Print Aging Report · Sahulat ERP" };

export default async function PrintAgingReportPage({
  searchParams,
}: PageProps<"/print/aging-report">) {
  const user = await requirePermission("AGING_REPORT", "PRINT");

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const asOfDate = one(sp.asOf);
  const branchId = Number(one(sp.branchId)) || undefined;
  if (!asOfDate) notFound();

  const companyId = await getActiveCompanyId(user.access);
  if (!companyId) notFound();

  await requireScope(companyId, branchId ?? null);

  const summary = await getAgingSummary({ companyId, branchId, asOfDate });
  const company = await getCompany(companyId);

  return (
    <AgingPrintView
      asOfLabel={fmtDate(new Date(asOfDate))}
      rows={summary.rows.map((r) => ({
        key: r.PARTY_ID,
        code: r.PARTY_CODE,
        name: r.PARTY_NAME,
        buckets: r.buckets,
        advance: r.advance,
        total: r.total,
      }))}
      grandTotal={summary.grandTotal}
      company={
        company && {
          code: company.COMPANY_CODE,
          name: company.COMPANY_NAME,
          address: company.ADDRESS,
          ntnNo: company.NTN_NO,
          strnNo: company.STRN_NO,
          baseCurrency: company.BASE_CURRENCY,
        }
      }
    />
  );
}
