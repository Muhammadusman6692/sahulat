import { notFound } from "next/navigation";
import { requirePermission, requireScope } from "@/lib/dal";
import { getActiveCompanyId } from "@/lib/active-scope";
import { getAccountLedger } from "@/lib/db/general-ledger";
import { getCompany } from "@/lib/db/companies";
import { fmtDate } from "@/lib/format";
import LedgerPrintView from "@/components/print/ledger-print-view";

export const metadata = { title: "Print General Ledger · Sahulat ERP" };

export default async function PrintGeneralLedgerPage({
  params,
  searchParams,
}: PageProps<"/print/gl-report/[coaId]">) {
  const { coaId: coaIdParam } = await params;
  const coaId = Number(coaIdParam);
  if (!Number.isInteger(coaId) || coaId <= 0) notFound();

  const user = await requirePermission("GL_REPORT", "PRINT");

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const dateFrom = one(sp.from);
  const dateTo = one(sp.to);
  const branchId = Number(one(sp.branchId)) || undefined;
  if (!dateFrom || !dateTo) notFound();

  const companyId = await getActiveCompanyId(user.access);
  if (!companyId) notFound();

  await requireScope(companyId, branchId ?? null);

  const ledger = await getAccountLedger({ companyId, coaId, branchId, dateFrom, dateTo });
  if (!ledger) notFound();

  const company = await getCompany(companyId);

  return (
    <LedgerPrintView
      accountLabel={`${ledger.account.ACCOUNT_CODE} - ${ledger.account.ACCOUNT_NAME}`}
      natureLabel={`${ledger.account.ACCOUNT_NATURE} (${ledger.account.NORMAL_SIDE === "D" ? "Debit" : "Credit"})`}
      dateFromLabel={fmtDate(new Date(dateFrom))}
      dateToLabel={fmtDate(new Date(dateTo))}
      openingBalance={ledger.openingBalance}
      lines={ledger.lines.map((l) => ({
        key: `${l.VOUCHER_ID}-${l.VOUCHER_DATE.toISOString()}`,
        date: l.VOUCHER_DATE,
        voucherNo: l.VOUCHER_NO,
        voucherType: l.VOUCHER_TYPE,
        narration: l.NARRATION,
        partyName: l.PARTY_NAME,
        debit: l.DEBIT_AMT,
        credit: l.CREDIT_AMT,
        balance: l.RUNNING_BALANCE,
      }))}
      totalDebit={ledger.totalDebit}
      totalCredit={ledger.totalCredit}
      closingBalance={ledger.closingBalance}
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
