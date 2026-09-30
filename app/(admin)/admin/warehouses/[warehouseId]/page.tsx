import { notFound } from "next/navigation";
import { requirePermission, requireScope } from "@/lib/dal";
import {
  getWarehouse,
  getLinkedBranchIds,
  listSelectableBranches,
} from "@/lib/db/warehouses";
import WarehouseForm from "../warehouse-form";
import BackLink from "@/components/back-link/back-link";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "Edit warehouse · Sahulat ERP" };

export default async function EditWarehousePage({
  params,
}: PageProps<"/admin/warehouses/[warehouseId]">) {
  await requirePermission("WAREHOUSE_MAINT", "EDIT");

  const { warehouseId } = await params;
  const id = Number(warehouseId);
  if (!Number.isInteger(id)) notFound();

  const warehouse = await getWarehouse(id);
  if (!warehouse) notFound();

  // Stops a warehouse in another company being edited by guessing its id.
  await requireScope(warehouse.COMPANY_ID, warehouse.BRANCH_ID);

  const [linked, branches] = await Promise.all([
    getLinkedBranchIds(id),
    listSelectableBranches([warehouse.COMPANY_ID]),
  ]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <BackLink href="/admin/warehouses">Warehouses</BackLink>
          <h1 className={styles.title} style={{ marginTop: 4 }}>
            {warehouse.WAREHOUSE_NAME}
          </h1>
          <p className={styles.subtitle}>
            {warehouse.COMPANY_CODE} · {warehouse.BRANCH_CODE} —{" "}
            {warehouse.BRANCH_NAME}
          </p>
        </div>
      </div>

      <WarehouseForm
        warehouse={warehouse}
        linkedBranchIds={linked}
        branches={branches.map((b) => ({
          id: b.BRANCH_ID,
          code: b.BRANCH_CODE,
          name: b.BRANCH_NAME,
          companyId: b.COMPANY_ID,
          companyCode: b.COMPANY_CODE,
        }))}
      />
    </div>
  );
}
