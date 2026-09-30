import { requirePermission } from "@/lib/dal";
import { listBrands } from "@/lib/db/item-brand";
import { can } from "@/lib/permissions";
import BrandPanel from "./brand-panel";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "Item Brand · Sahulat ERP" };

export default async function ItemBrandPage() {
  const user = await requirePermission("ITEM_BRAND_MAINT", "VIEW");
  const companyId = user.access[0]?.companyId;

  if (!companyId) {
    return <p className={styles.empty}>Your account is not scoped to any company.</p>;
  }

  const brands = await listBrands(companyId);

  const mayCreate = can(user.permissions, "ITEM_BRAND_MAINT", "CREATE");
  const mayEdit = can(user.permissions, "ITEM_BRAND_MAINT", "EDIT");

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <h1 className={styles.title}>Item Brand</h1>
          <p className={styles.subtitle}>
            The brands items are grouped under, for this company.
          </p>
        </div>
      </div>

      <BrandPanel
        companyId={companyId}
        brands={brands.map((b) => ({ brandId: b.BRAND_ID, name: b.BRAND_NAME }))}
        mayCreate={mayCreate}
        mayEdit={mayEdit}
      />
    </div>
  );
}
