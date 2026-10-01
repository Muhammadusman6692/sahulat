import Link from "next/link";
import { requirePermission } from "@/lib/dal";
import { getActiveCompanyId } from "@/lib/active-scope";
import { listCoaFlat, buildCoaTree } from "@/lib/db/coa";
import { can } from "@/lib/permissions";
import CoaTree from "@/components/coa-tree/coa-tree";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "Chart of Accounts · Sahulat ERP" };

export default async function CoaPage({
  searchParams,
}: PageProps<"/admin/coa">) {
  const user = await requirePermission("COA_MAINT", "VIEW");
  const sp = await searchParams;
  const includeInactive =
    (Array.isArray(sp.inactive) ? sp.inactive[0] : sp.inactive) === "1";

  // Chart of accounts is company-specific by design (docs/01_masters.sql), so
  // this shows whichever company the topbar's scope switcher has active.
  const companyId = await getActiveCompanyId(user.access);
  const mayCreate = can(user.permissions, "COA_MAINT", "CREATE");

  if (!companyId) {
    return <p className={styles.empty}>Your account is not scoped to any company.</p>;
  }

  const rows = await listCoaFlat(companyId, includeInactive);
  const tree = buildCoaTree(rows);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <h1 className={styles.title}>Chart of Accounts</h1>
          <p className={styles.subtitle}>
            Four levels: Group, Control, Sub-Control, Posting. Only a posting
            account (level 4) can appear on a voucher line — the database
            enforces this, not just this screen.
          </p>
        </div>
        <Link
          href={includeInactive ? "/admin/coa" : "/admin/coa?inactive=1"}
          className={styles.btn}
        >
          {includeInactive ? "Active only" : "Show inactive"}
        </Link>
        {mayCreate && (
          <Link href="/admin/coa/new" className={styles.btnPrimary}>
            <svg
              width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            New account
          </Link>
        )}
      </div>

      <div className={styles.card}>
        {tree.length === 0 ? (
          <p className={styles.empty}>No accounts yet.</p>
        ) : (
          <CoaTree roots={tree} />
        )}
      </div>

      <p className={styles.note}>
        A child's level is always its parent's level plus one — chosen
        automatically from the parent you pick, not typed by hand. Accounts
        are never deleted, only marked inactive.
      </p>
    </div>
  );
}
