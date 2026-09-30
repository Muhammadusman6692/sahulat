import { requirePermission } from "@/lib/dal";
import { listCategories, listBrands, listTaxes } from "@/lib/db/items";
import { listUoms } from "@/lib/db/uom";
import { getCompany } from "@/lib/db/companies";
import ItemForm from "../item-form";
import BackLink from "@/components/back-link/back-link";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "New item · Sahulat ERP" };

export default async function NewItemPage() {
  const user = await requirePermission("ITEM_MAINT", "CREATE");
  const companyId = user.access[0]?.companyId;

  if (!companyId) {
    return <p className={styles.empty}>Your account is not scoped to any company.</p>;
  }

  const [company, categories, brands, uoms, taxes] = await Promise.all([
    getCompany(companyId),
    listCategories(companyId),
    listBrands(companyId),
    listUoms(),
    listTaxes(companyId),
  ]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <BackLink href="/admin/items">Items</BackLink>
          <h1 className={styles.title} style={{ marginTop: 4 }}>
            New item
          </h1>
          <p className={styles.subtitle}>
            The opening price is required — every item must have a sale price
            from the moment it exists.
          </p>
        </div>
      </div>

      <ItemForm
        item={null}
        companyId={companyId}
        companyLabel={company ? `${company.COMPANY_CODE} — ${company.COMPANY_NAME}` : ""}
        categories={categories.map((c) => ({ value: String(c.CATEGORY_ID), label: c.CATEGORY_NAME }))}
        brands={brands.map((b) => ({ value: String(b.BRAND_ID), label: b.BRAND_NAME }))}
        uoms={uoms.map((u) => ({ value: u.UOM_CODE, label: `${u.UOM_CODE} — ${u.UOM_NAME}` }))}
        taxes={taxes.map((t) => ({
          value: String(t.TAX_ID),
          label: `${t.TAX_CODE} (${t.TAX_RATE}%)`,
        }))}
      />
    </div>
  );
}
