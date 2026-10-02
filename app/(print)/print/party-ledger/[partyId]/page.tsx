import { notFound } from "next/navigation";
import { requirePermission, requireScope } from "@/lib/dal";
import { getActiveCompanyId } from "@/lib/active-scope";
import { getPartyLedger } from "@/lib/db/party-ledger";
import { getCompany } from "@/lib/db/companies";
import { fmtDate } from "@/lib/format";
import LedgerPrintView from "@/components/print/ledger-print-view";

export const metadata = { title: "Print Party Ledger · Sahulat ERP" };

function roleLabel(isCustomer: "Y" | "N", isSupplier: "Y" | "N"): string {
  if (isCustomer === "Y" && isSupplier === "Y") return "Customer & Supplier (combined)";
  if (isCustomer === "Y") return "Customer";
  if (isSupplier === "Y") return "Supplier";
  return "—";
}

export default async function PrintPartyLedgerPage({
  params,
  searchParams,
}: PageProps<"/print/party-ledger/[partyId]">) {
  const { partyId: partyIdParam } = await params;
  const partyId = Number(partyIdParam);
  if (!Number.isInteger(partyId) || partyId <= 0) notFound();

  const user = await requirePermission("PARTY_LEDGER", "PRINT");

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const dateFrom = one(sp.from);
  const dateTo = one(sp.to);
  const branchId = Number(one(sp.branchId)) || undefined;
  if (!dateFrom || !dateTo) notFound();

  const companyId = await getActiveCompanyId(user.access);
  if (!companyId) notFound();

  await requireScope(companyId, branchId ?? null);

  const ledger = await getPartyLedger({ companyId, partyId, branchId, dateFrom, dateTo });
  if (!ledger) notFound();

  const company = await getCompany(companyId);

  return (
    <LedgerPrintView
      docTitle="Party Ledger"
      accountLabel={`${ledger.party.PARTY_CODE} - ${ledger.party.PARTY_NAME}`}
      natureLabel={roleLabel(ledger.party.IS_CUSTOMER, ledger.party.IS_SUPPLIER)}
      dateFromLabel={fmtDate(new Date(dateFrom))}
      dateToLabel={fmtDate(new Date(dateTo))}
      openingBalance={ledger.openingBalance}
      lineLabel="Ledger"
      lines={ledger.lines.map((l) => ({
        key: `${l.VOUCHER_ID}-${l.VOUCHER_DATE.toISOString()}`,
        date: l.VOUCHER_DATE,
        voucherNo: l.VOUCHER_NO,
        voucherType: l.VOUCHER_TYPE,
        narration: l.NARRATION,
        partyName: l.LEDGER_SIDE === "AR" ? "Receivable" : "Payable",
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
