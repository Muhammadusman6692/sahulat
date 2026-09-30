import Link from "next/link";
import { requirePermission } from "@/lib/dal";
import { listSelectableBranches } from "@/lib/db/warehouses";
import WarehouseForm from "../warehouse-form";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "New warehouse · Sahulat ERP" };

export default async function NewWarehousePage() {
  const user = await requirePermission("WAREHOUSE_MAINT", "CREATE");

  const companyIds = [...new Set(user.access.map((a) => a.companyId))];
  const branches = await listSelectableBranches(companyIds);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <Link href="/admin/warehouses" className={styles.note}>
            ← Warehouses
          </Link>
          <h1 className={styles.title} style={{ marginTop: 4 }}>
            New warehouse
          </h1>
          <p className={styles.subtitle}>
            Choose carefully: the owning branch cannot be changed afterwards.
          </p>
        </div>
      </div>

      {branches.length === 0 ? (
        <p className={styles.empty}>
          There is no active branch you are scoped to, so there is nothing to
          attach a warehouse to. Create a branch first.
        </p>
      ) : (
        <WarehouseForm
          warehouse={null}
          linkedBranchIds={[]}
          branches={branches.map((b) => ({
            id: b.BRANCH_ID,
            code: b.BRANCH_CODE,
            name: b.BRANCH_NAME,
            companyId: b.COMPANY_ID,
            companyCode: b.COMPANY_CODE,
          }))}
        />
      )}
    </div>
  );
}
