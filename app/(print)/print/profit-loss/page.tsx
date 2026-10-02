import { notFound } from "next/navigation";
import { requirePermission, requireScope } from "@/lib/dal";
import { getActiveCompanyId } from "@/lib/active-scope";
import { getProfitLoss, type PLSection } from "@/lib/db/profit-loss";
import { getCompany } from "@/lib/db/companies";
import { listBranches } from "@/lib/db/branches";
import { fmtDate } from "@/lib/format";
import ProfitLossPrintView from "@/components/print/profit-loss-print-view";

export const metadata = { title: "Print Profit & Loss · Sahulat ERP" };

function toSection(s: PLSection) {
  return {
    code: s.code,
    name: s.name,
    total: s.total,
    groups: s.groups.map((g) => ({
      code: g.code,
      name: g.name,
      subtotal: g.subtotal,
      rows: g.rows.map((r) => ({
        coaId: r.COA_ID,
        accountCode: r.ACCOUNT_CODE,
        accountName: r.ACCOUNT_NAME,
        amount: r.AMOUNT,
      })),
    })),
  };
}

export default async function PrintProfitLossPage({
  searchParams,
}: PageProps<"/print/profit-loss">) {
  const user = await requirePermission("PROFIT_LOSS", "PRINT");

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const dateFrom = one(sp.from);
  const dateTo = one(sp.to);
  if (!dateFrom || !dateTo) notFound();

  const branchId = Number(one(sp.branchId)) || undefined;
  const includeZero = one(sp.zero) === "1";

  const companyId = await getActiveCompanyId(user.access);
  if (!companyId) notFound();

  await requireScope(companyId, branchId ?? null);

  const [pl, company, branches] = await Promise.all([
    getProfitLoss({ companyId, branchId, dateFrom, dateTo, includeZero }),
    getCompany(companyId),
    listBranches([companyId], false),
  ]);

  const branchLabel = branchId
    ? (() => {
        const b = branches.find((x) => x.BRANCH_ID === branchId);
        return b ? `${b.BRANCH_CODE} — ${b.BRANCH_NAME}` : "—";
      })()
    : "All branches";

  return (
    <ProfitLossPrintView
      branchLabel={branchLabel}
      dateFromLabel={fmtDate(new Date(dateFrom))}
      dateToLabel={fmtDate(new Date(dateTo))}
      revenueSections={pl.revenueSections.map(toSection)}
      totalRevenue={pl.totalRevenue}
      cogsMapped={pl.cogsMapped}
      costOfSalesSections={pl.costOfSalesSections.map(toSection)}
      totalCostOfSales={pl.totalCostOfSales}
      grossProfit={pl.grossProfit}
      operatingExpenseSections={pl.operatingExpenseSections.map(toSection)}
      totalOperatingExpenses={pl.totalOperatingExpenses}
      netProfit={pl.netProfit}
      spansFiscalYears={pl.spansFiscalYears}
      company={
        company && {
          code: company.COMPANY_CODE,
          name: company.COMPANY_NAME,
          address: company.ADDRESS,
          ntnNo: company.NTN_NO,
          strnNo: company.STRN_NO,
        }
      }
    />
  );
}
