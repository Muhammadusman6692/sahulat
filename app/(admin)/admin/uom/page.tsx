import { requirePermission } from "@/lib/dal";
import { listUoms } from "@/lib/db/uom";
import { can } from "@/lib/permissions";
import UomPanel from "./uom-panel";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "UOM Master · Sahulat ERP" };

export default async function UomPage() {
  const user = await requirePermission("UOM_MAINT", "VIEW");

  const uoms = await listUoms();

  const mayCreate = can(user.permissions, "UOM_MAINT", "CREATE");
  const mayEdit = can(user.permissions, "UOM_MAINT", "EDIT");

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <h1 className={styles.title}>UOM Master</h1>
          <p className={styles.subtitle}>
            The units items are stocked and sold in.
          </p>
        </div>
      </div>

      <UomPanel
        uoms={uoms.map((u) => ({
          code: u.UOM_CODE,
          name: u.UOM_NAME,
          allowDecimal: u.ALLOW_DECIMAL,
        }))}
        mayCreate={mayCreate}
        mayEdit={mayEdit}
      />
    </div>
  );
}
