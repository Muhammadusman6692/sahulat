import { notFound } from "next/navigation";
import { requirePermission, requireScope } from "@/lib/dal";
import { getBankVoucher, type BvType, type InstrumentType } from "@/lib/db/bank-vouchers";
import { getCompany } from "@/lib/db/companies";
import { fmtDate } from "@/lib/format";
import VoucherPrintView from "@/components/print/voucher-print-view";

export const metadata = { title: "Print Bank Voucher · Sahulat ERP" };

const TYPE_LABEL: Record<BvType, string> = {
  BPV: "Bank Payment Voucher",
  BRV: "Bank Receipt Voucher",
};

const INSTRUMENT_LABEL: Record<InstrumentType, string> = {
  CHEQUE: "Cheque",
  ONLINE_TRANSFER: "Online Transfer",
  PAY_ORDER: "Pay Order",
  DD: "Demand Draft",
  RTGS: "RTGS",
};

export default async function PrintBankVoucherPage({
  params,
}: PageProps<"/print/bank-vouchers/[voucherId]">) {
  const { voucherId: voucherIdParam } = await params;
  const voucherId = Number(voucherIdParam);
  if (!Number.isInteger(voucherId) || voucherId <= 0) notFound();

  await requirePermission("BANK_VOUCHER", "PRINT");
  const detail = await getBankVoucher(voucherId);
  if (!detail) notFound();

  await requireScope(detail.header.COMPANY_ID, detail.header.BRANCH_ID);

  const company = await getCompany(detail.header.COMPANY_ID);
  const totalDebit = detail.lines.reduce((s, l) => s + l.DEBIT_AMT, 0);
  const totalCredit = detail.lines.reduce((s, l) => s + l.CREDIT_AMT, 0);

  const instrumentValue = [
    INSTRUMENT_LABEL[detail.header.INSTRUMENT_TYPE],
    detail.header.INSTRUMENT_NO,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <VoucherPrintView
      documentTitle={TYPE_LABEL[detail.header.VOUCHER_TYPE]}
      voucherNo={detail.header.VOUCHER_NO}
      statusLabel={detail.header.STATUS}
      info={[
        { label: "Branch", value: detail.header.BRANCH_NAME },
        { label: "Voucher date", value: fmtDate(detail.header.VOUCHER_DATE) },
        {
          label: "Bank account",
          value: `${detail.header.BANK_ACCOUNT_CODE} - ${detail.header.BANK_ACCOUNT_NAME}`,
        },
        {
          label: "Instrument",
          value: instrumentValue,
          sub: detail.header.INSTRUMENT_DATE ? fmtDate(detail.header.INSTRUMENT_DATE) : undefined,
        },
        {
          label: "Created by",
          value: detail.header.CREATED_BY_NAME,
          sub: fmtDate(detail.header.CREATED_ON),
        },
        {
          label: "Posted by",
          value: detail.header.POSTED_BY_NAME ?? "—",
          sub: detail.header.POSTED_BY_NAME ? fmtDate(detail.header.POSTED_ON) : undefined,
        },
      ]}
      narration={detail.header.NARRATION}
      lines={detail.lines.map((l) => ({
        key: l.LINE_ID,
        accountLabel: `${l.ACCOUNT_CODE} - ${l.ACCOUNT_NAME}`,
        narration: l.NARRATION,
        debit: l.DEBIT_AMT,
        credit: l.CREDIT_AMT,
      }))}
      totalDebit={totalDebit}
      totalCredit={totalCredit}
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
