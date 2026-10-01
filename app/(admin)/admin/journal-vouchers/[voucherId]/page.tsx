import { notFound } from "next/navigation";
import { requirePermission, requireScope } from "@/lib/dal";
import { getJournalVoucher } from "@/lib/db/journal-vouchers";
import { getCompany } from "@/lib/db/companies";
import { listBranches } from "@/lib/db/branches";
import { listPostableAccounts } from "@/lib/db/coa";
import { can } from "@/lib/permissions";
import { fmtMoney } from "@/lib/format";
import JvForm from "../jv-form";
import VoucherActions from "../voucher-actions";
import BackLink from "@/components/back-link/back-link";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "Journal Voucher · Sahulat ERP" };

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function JournalVoucherDetailPage({
  params,
}: PageProps<"/admin/journal-vouchers/[voucherId]">) {
  const { voucherId: voucherIdParam } = await params;
  const voucherId = Number(voucherIdParam);
  if (!Number.isInteger(voucherId) || voucherId <= 0) notFound();

  const user = await requirePermission("JV_ENTRY", "VIEW");
  const detail = await getJournalVoucher(voucherId);
  if (!detail) notFound();

  await requireScope(detail.header.COMPANY_ID, detail.header.BRANCH_ID);

  const mayEdit = can(user.permissions, "JV_ENTRY", "EDIT");
  const mayPost = can(user.permissions, "JV_ENTRY", "POST");
  const mayCancel = can(user.permissions, "JV_ENTRY", "CANCEL");

  if (detail.header.STATUS === "DRAFT" && mayEdit) {
    const [company, branches, accounts] = await Promise.all([
      getCompany(detail.header.COMPANY_ID),
      listBranches([detail.header.COMPANY_ID], false),
      listPostableAccounts(detail.header.COMPANY_ID),
    ]);

    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.grow}>
            <BackLink href="/admin/journal-vouchers">Journal Vouchers</BackLink>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
              <h1 className={styles.title}>Edit Journal Voucher</h1>
              <span className={styles.badgeOff}>DRAFT</span>
            </div>
          </div>
          <VoucherActions
            voucherId={voucherId}
            status={detail.header.STATUS}
            mayEdit={mayEdit}
            mayPost={mayPost}
            mayCancel={mayCancel}
          />
        </div>

        <JvForm
          mode="edit"
          voucherId={voucherId}
          companyLabel={company ? `${company.COMPANY_CODE} — ${company.COMPANY_NAME}` : ""}
          branches={branches.map((b) => ({ id: b.BRANCH_ID, code: b.BRANCH_CODE, name: b.BRANCH_NAME }))}
          accounts={accounts.map((a) => ({
            id: a.COA_ID,
            code: a.ACCOUNT_CODE,
            name: a.ACCOUNT_NAME,
            controlType: a.IS_CONTROL_AC,
            parentName: a.PARENT_NAME,
          }))}
          initial={{
            branchId: detail.header.BRANCH_ID,
            branchLabel: detail.header.BRANCH_NAME,
            voucherDate: detail.header.VOUCHER_DATE.toISOString().slice(0, 10),
            voucherNo: detail.header.VOUCHER_NO,
            narration: detail.header.NARRATION ?? "",
            lines: detail.lines.map((l) => ({
              coaId: String(l.COA_ID),
              narration: l.NARRATION ?? "",
              debit: l.DEBIT_AMT ? String(l.DEBIT_AMT) : "",
              credit: l.CREDIT_AMT ? String(l.CREDIT_AMT) : "",
            })),
          }}
        />
      </div>
    );
  }

  const totalDebit = detail.lines.reduce((s, l) => s + l.DEBIT_AMT, 0);
  const totalCredit = detail.lines.reduce((s, l) => s + l.CREDIT_AMT, 0);
  const statusBadgeClass =
    detail.header.STATUS === "POSTED"
      ? styles.badgeOk
      : detail.header.STATUS === "CANCELLED"
        ? styles.badge
        : styles.badgeOff;
  const statusBadgeStyle =
    detail.header.STATUS === "CANCELLED" ? { background: "#f7e3e2", color: "var(--danger)" } : undefined;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <BackLink href="/admin/journal-vouchers">Journal Vouchers</BackLink>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
            <h1 className={styles.title} style={{ fontFamily: "var(--font-plex-mono), monospace" }}>
              {detail.header.VOUCHER_NO}
            </h1>
            <span className={statusBadgeClass} style={statusBadgeStyle}>
              {detail.header.STATUS}
            </span>
          </div>
          <p className={styles.subtitle}>{detail.header.NARRATION}</p>
        </div>
        <VoucherActions
          voucherId={voucherId}
          status={detail.header.STATUS}
          mayEdit={mayEdit}
          mayPost={mayPost}
          mayCancel={mayCancel}
        />
      </div>

      <div className={styles.card} style={{ padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: "14px 18px", fontSize: 12 }}>
          <div>
            <div className={styles.subtitle} style={{ margin: 0 }}>Branch</div>
            <div>{detail.header.BRANCH_NAME}</div>
          </div>
          <div>
            <div className={styles.subtitle} style={{ margin: 0 }}>Voucher date</div>
            <div className={styles.code}>{fmtDate(detail.header.VOUCHER_DATE)}</div>
          </div>
          <div>
            <div className={styles.subtitle} style={{ margin: 0 }}>Created by</div>
            <div>{detail.header.CREATED_BY_NAME} · {fmtDate(detail.header.CREATED_ON)}</div>
          </div>
          <div>
            <div className={styles.subtitle} style={{ margin: 0 }}>Posted by</div>
            <div>
              {detail.header.POSTED_BY_NAME
                ? `${detail.header.POSTED_BY_NAME} · ${fmtDate(detail.header.POSTED_ON!)}`
                : "—"}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Account</th>
              <th>Party</th>
              <th>Line narration</th>
              <th style={{ textAlign: "right" }}>Debit</th>
              <th style={{ textAlign: "right" }}>Credit</th>
            </tr>
          </thead>
          <tbody>
            {detail.lines.map((l) => (
              <tr key={l.LINE_ID}>
                <td className={styles.code}>{l.ACCOUNT_CODE} - {l.ACCOUNT_NAME}</td>
                <td className={styles.muted}>{l.PARTY_NAME ?? "—"}</td>
                <td>{l.NARRATION ?? "—"}</td>
                <td className={styles.num}>{l.DEBIT_AMT ? fmtMoney(l.DEBIT_AMT) : ""}</td>
                <td className={styles.num}>{l.CREDIT_AMT ? fmtMoney(l.CREDIT_AMT) : ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} style={{ textAlign: "right", fontWeight: 600 }}>Total</td>
              <td className={styles.num} style={{ fontWeight: 600 }}>{fmtMoney(totalDebit)}</td>
              <td className={styles.num} style={{ fontWeight: 600 }}>{fmtMoney(totalCredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
