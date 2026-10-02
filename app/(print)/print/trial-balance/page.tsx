import { notFound } from "next/navigation";
import { requirePermission, requireScope } from "@/lib/dal";
import { getActiveCompanyId } from "@/lib/active-scope";
import { getTrialBalance, NATURE_ORDER } from "@/lib/db/trial-balance";
import { getCompany } from "@/lib/db/companies";
import { listBranches } from "@/lib/db/branches";
import { fmtDate } from "@/lib/format";
import TrialBalancePrintView from "@/components/print/trial-balance-print-view";

export const metadata = { title: "Print Trial Balance · Sahulat ERP" };

export default async function PrintTrialBalancePage({
  searchParams,
}: PageProps<"/print/trial-balance">) {
  const user = await requirePermission("TRIAL_BALANCE", "PRINT");

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const dateFrom = one(sp.from);
  const dateTo = one(sp.to);
  if (!dateFrom || !dateTo) notFound();

  const branchId = Number(one(sp.branchId)) || undefined;
  const includeZero = one(sp.zero) === "1";
  const includeClosing = one(sp.closing) !== "0";

  const companyId = await getActiveCompanyId(user.access);
  if (!companyId) notFound();

  await requireScope(companyId, branchId ?? null);

  const [tb, company, branches] = await Promise.all([
    getTrialBalance({ companyId, branchId, dateFrom, dateTo, includeClosing, includeZero }),
    getCompany(companyId),
    listBranches([companyId], false),
  ]);

  const branchLabel = branchId
    ? (() => {
        const b = branches.find((x) => x.BRANCH_ID === branchId);
        return b ? `${b.BRANCH_CODE} — ${b.BRANCH_NAME}` : "—";
      })()
    : "All branches";

  const groups = NATURE_ORDER.map((nature) => ({
    nature,
    rows: tb.rows
      .filter((r) => r.ACCOUNT_NATURE === nature)
      .map((r) => ({
        coaId: r.COA_ID,
        accountCode: r.ACCOUNT_CODE,
        accountName: r.ACCOUNT_NAME,
        openingDr: r.OPENING_DR,
        openingCr: r.OPENING_CR,
        periodDr: r.PERIOD_DR,
        periodCr: r.PERIOD_CR,
        closingDr: r.CLOSING_DR,
        closingCr: r.CLOSING_CR,
      })),
    subtotal: tb.subtotals.find((s) => s.nature === nature) ?? {
      openingDr: 0,
      openingCr: 0,
      periodDr: 0,
      periodCr: 0,
      closingDr: 0,
      closingCr: 0,
    },
  })).filter((g) => g.rows.length > 0);

  return (
    <TrialBalancePrintView
      branchLabel={branchLabel}
      dateFromLabel={fmtDate(new Date(dateFrom))}
      dateToLabel={fmtDate(new Date(dateTo))}
      groups={groups}
      totalOpeningDr={tb.totalOpeningDr}
      totalOpeningCr={tb.totalOpeningCr}
      totalPeriodDr={tb.totalPeriodDr}
      totalPeriodCr={tb.totalPeriodCr}
      totalClosingDr={tb.totalClosingDr}
      totalClosingCr={tb.totalClosingCr}
      inBalance={tb.inBalance}
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
