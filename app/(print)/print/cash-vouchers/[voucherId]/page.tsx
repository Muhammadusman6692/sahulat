import { notFound } from "next/navigation";
import { requirePermission, requireScope } from "@/lib/dal";
import { getCashVoucher, type CvType } from "@/lib/db/cash-vouchers";
import { getCompany } from "@/lib/db/companies";
import { fmtDate } from "@/lib/format";
import VoucherPrintView from "@/components/print/voucher-print-view";

export const metadata = { title: "Print Cash Voucher · Sahulat ERP" };

const TYPE_LABEL: Record<CvType, string> = {
  CPV: "Cash Payment Voucher",
  CRV: "Cash Receipt Voucher",
};

export default async function PrintCashVoucherPage({
  params,
}: PageProps<"/print/cash-vouchers/[voucherId]">) {
  const { voucherId: voucherIdParam } = await params;
  const voucherId = Number(voucherIdParam);
  if (!Number.isInteger(voucherId) || voucherId <= 0) notFound();

  await requirePermission("CASH_VOUCHER", "PRINT");
  const detail = await getCashVoucher(voucherId);
  if (!detail) notFound();

  await requireScope(detail.header.COMPANY_ID, detail.header.BRANCH_ID);

  const company = await getCompany(detail.header.COMPANY_ID);
  const totalDebit = detail.lines.reduce((s, l) => s + l.DEBIT_AMT, 0);
  const totalCredit = detail.lines.reduce((s, l) => s + l.CREDIT_AMT, 0);

  return (
    <VoucherPrintView
      documentTitle={TYPE_LABEL[detail.header.VOUCHER_TYPE]}
      voucherNo={detail.header.VOUCHER_NO}
      statusLabel={detail.header.STATUS}
      info={[
        { label: "Branch", value: detail.header.BRANCH_NAME },
        { label: "Voucher date", value: fmtDate(detail.header.VOUCHER_DATE) },
        {
          label: "Cash account",
          value: `${detail.header.CASH_ACCOUNT_CODE} - ${detail.header.CASH_ACCOUNT_NAME}`,
        },
        {
          label: "Created by",
          value: `${detail.header.CREATED_BY_NAME} · ${fmtDate(detail.header.CREATED_ON)}`,
        },
        {
          label: "Posted by",
          value: detail.header.POSTED_BY_NAME
            ? `${detail.header.POSTED_BY_NAME} · ${fmtDate(detail.header.POSTED_ON)}`
            : "—",
        },
      ]}
      narration={detail.header.NARRATION}
      lines={detail.lines.map((l) => ({
        key: l.LINE_ID,
        accountLabel: `${l.ACCOUNT_CODE} - ${l.ACCOUNT_NAME}`,
        partyName: l.PARTY_NAME,
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
        }
      }
    />
  );
}
