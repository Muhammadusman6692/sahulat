import { requirePermission } from "@/lib/dal";
import { getActiveCompanyId } from "@/lib/active-scope";
import { listCategories } from "@/lib/db/item-categories";
import { can } from "@/lib/permissions";
import CategoryPanel from "./category-panel";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "Item Category · Sahulat ERP" };

export default async function ItemCategoryPage() {
  const user = await requirePermission("ITEM_CAT_MAINT", "VIEW");
  const companyId = await getActiveCompanyId(user.access);

  if (!companyId) {
    return <p className={styles.empty}>Your account is not scoped to any company.</p>;
  }

  const categories = await listCategories(companyId);
  const mayCreate = can(user.permissions, "ITEM_CAT_MAINT", "CREATE");
  const mayEdit = can(user.permissions, "ITEM_CAT_MAINT", "EDIT");

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <h1 className={styles.title}>Item Category</h1>
          <p className={styles.subtitle}>
            Groups items for filtering and reporting on Item Master.
          </p>
        </div>
      </div>

      <CategoryPanel
        categories={categories.map((c) => ({
          id: c.CATEGORY_ID,
          name: c.CATEGORY_NAME,
          itemCount: c.ITEM_COUNT,
        }))}
        mayCreate={mayCreate}
        mayEdit={mayEdit}
      />
    </div>
  );
}
