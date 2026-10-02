import { notFound } from "next/navigation";
import { requirePermission, requireScope } from "@/lib/dal";
import { getActiveCompanyId } from "@/lib/active-scope";
import { getBalanceSheet } from "@/lib/db/balance-sheet";
import { getCompany } from "@/lib/db/companies";
import { listBranches } from "@/lib/db/branches";
import { fmtDate } from "@/lib/format";
import BalanceSheetPrintView from "@/components/print/balance-sheet-print-view";

export const metadata = { title: "Print Balance Sheet · Sahulat ERP" };

const LEVEL_LABEL = { 2: "Control", 3: "Sub-Control", 4: "Accounts" } as const;

export default async function PrintBalanceSheetPage({
  searchParams,
}: PageProps<"/print/balance-sheet">) {
  const user = await requirePermission("BALANCE_SHEET", "PRINT");

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const asOf = one(sp.asOf);
  if (!asOf) notFound();

  const compareAsOf = one(sp.cmp) || undefined;
  const branchId = Number(one(sp.branchId)) || undefined;
  const levelParam = one(sp.level);
  const level = levelParam === "2" ? 2 : levelParam === "4" ? 4 : 3;
  const includeZero = one(sp.zero) === "1";

  const companyId = await getActiveCompanyId(user.access);
  if (!companyId) notFound();

  await requireScope(companyId, branchId ?? null);

  const [bs, company, branches] = await Promise.all([
    getBalanceSheet({ companyId, branchId, asOf, compareAsOf, level, includeZero }),
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
    <BalanceSheetPrintView
      branchLabel={branchLabel}
      columnLabels={bs.columns.map((c) => fmtDate(new Date(c.asOf)))}
      lines={bs.lines}
      inBalance={bs.columns.every((c) => c.inBalance)}
      levelLabel={LEVEL_LABEL[level]}
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
