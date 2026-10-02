import { notFound } from "next/navigation";
import { requirePermission, requireScope } from "@/lib/dal";
import { getJournalVoucher } from "@/lib/db/journal-vouchers";
import { getCompany } from "@/lib/db/companies";
import { fmtDate } from "@/lib/format";
import VoucherPrintView from "@/components/print/voucher-print-view";

export const metadata = { title: "Print Journal Voucher · Sahulat ERP" };

export default async function PrintJournalVoucherPage({
  params,
}: PageProps<"/print/journal-vouchers/[voucherId]">) {
  const { voucherId: voucherIdParam } = await params;
  const voucherId = Number(voucherIdParam);
  if (!Number.isInteger(voucherId) || voucherId <= 0) notFound();

  await requirePermission("JV_ENTRY", "PRINT");
  const detail = await getJournalVoucher(voucherId);
  if (!detail) notFound();

  await requireScope(detail.header.COMPANY_ID, detail.header.BRANCH_ID);

  const company = await getCompany(detail.header.COMPANY_ID);
  const totalDebit = detail.lines.reduce((s, l) => s + l.DEBIT_AMT, 0);
  const totalCredit = detail.lines.reduce((s, l) => s + l.CREDIT_AMT, 0);

  return (
    <VoucherPrintView
      documentTitle="Journal Voucher"
      voucherNo={detail.header.VOUCHER_NO}
      statusLabel={detail.header.STATUS}
      info={[
        { label: "Branch", value: detail.header.BRANCH_NAME },
        { label: "Voucher date", value: fmtDate(detail.header.VOUCHER_DATE) },
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
