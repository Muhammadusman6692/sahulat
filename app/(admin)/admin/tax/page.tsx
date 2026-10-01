import Link from "next/link";
import { requirePermission } from "@/lib/dal";
import { getActiveCompanyId } from "@/lib/active-scope";
import { listAuthorities, listTaxCodes } from "@/lib/db/tax";
import { can } from "@/lib/permissions";
import AuthoritiesPanel from "./authorities-panel";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "Tax Authority & Master · Sahulat ERP" };

const TAX_TYPE_LABEL: Record<string, string> = {
  SALES_TAX: "Sales Tax",
  WITHHOLDING: "Withholding",
  FURTHER_TAX: "Further Tax",
  EXTRA_TAX: "Extra Tax",
};

export default async function TaxPage() {
  const user = await requirePermission("TAX_MAINT", "VIEW");
  const companyId = await getActiveCompanyId(user.access);

  if (!companyId) {
    return <p className={styles.empty}>Your account is not scoped to any company.</p>;
  }

  const [authorities, taxCodes] = await Promise.all([
    listAuthorities(),
    listTaxCodes(companyId),
  ]);

  const mayCreate = can(user.permissions, "TAX_MAINT", "CREATE");
  const mayEdit = can(user.permissions, "TAX_MAINT", "EDIT");

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <h1 className={styles.title}>Tax Authority &amp; Master</h1>
          <p className={styles.subtitle}>
            The revenue bodies tax is filed with, and the tax codes — rate,
            type and GL account — that items and documents post against.
          </p>
        </div>
      </div>

      <AuthoritiesPanel
        authorities={authorities.map((a) => ({
          code: a.AUTHORITY_CODE,
          name: a.AUTHORITY_NAME,
        }))}
        mayCreate={mayCreate}
        mayEdit={mayEdit}
      />

      <div className={styles.header} style={{ marginTop: 28 }}>
        <div className={styles.grow}>
          <h2 className={styles.title} style={{ fontSize: 16 }}>
            Tax Codes
          </h2>
        </div>
        {mayCreate && (
          <Link href="/admin/tax/new" className={styles.btnPrimary}>
            <svg
              width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            New tax code
          </Link>
        )}
      </div>

      <div className={styles.card}>
        {taxCodes.length === 0 ? (
          <p className={styles.empty}>No tax codes for this company yet.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Authority</th>
                <th style={{ textAlign: "right" }}>Rate</th>
                <th>Type</th>
                <th>GL account</th>
                <th>Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {taxCodes.map((t) => (
                <tr key={t.TAX_ID}>
                  <td className={styles.code}>{t.TAX_CODE}</td>
                  <td>{t.TAX_NAME}</td>
                  <td className={styles.muted}>{t.AUTHORITY_CODE}</td>
                  <td className={styles.num}>{t.TAX_RATE}</td>
                  <td className={styles.muted}>{TAX_TYPE_LABEL[t.TAX_TYPE] ?? t.TAX_TYPE}</td>
                  <td className={styles.muted}>
                    {t.ACCOUNT_CODE ? `${t.ACCOUNT_CODE} — ${t.ACCOUNT_NAME}` : "—"}
                  </td>
                  <td className={styles.muted}>{t.ACTIVE_YN === "Y" ? "Yes" : "No"}</td>
                  <td style={{ textAlign: "right" }}>
                    {mayEdit && (
                      <Link href={`/admin/tax/${t.TAX_ID}`} className={styles.pageLink}>
                        Edit
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className={styles.note}>
        Tax codes are scoped to this company; tax authorities are shared
        across every company on this instance.
      </p>
    </div>
  );
}
