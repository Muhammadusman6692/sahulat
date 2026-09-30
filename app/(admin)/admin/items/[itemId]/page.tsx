import { notFound } from "next/navigation";
import { requirePermission, requireScope } from "@/lib/dal";
import {
  getItem,
  getItemPriceHistory,
  listCategories,
  listBrands,
  listTaxes,
} from "@/lib/db/items";
import { listUoms } from "@/lib/db/uom";
import { getCompany } from "@/lib/db/companies";
import { can } from "@/lib/permissions";
import ItemForm from "../item-form";
import PriceHistory from "../price-history";
import BackLink from "@/components/back-link/back-link";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "Edit item · Sahulat ERP" };

export default async function EditItemPage({
  params,
}: PageProps<"/admin/items/[itemId]">) {
  const user = await requirePermission("ITEM_MAINT", "EDIT");

  const { itemId } = await params;
  const id = Number(itemId);
  if (!Number.isInteger(id)) notFound();

  const item = await getItem(id);
  if (!item) notFound();

  // Stops an item in another company being edited by guessing its id.
  await requireScope(item.COMPANY_ID);

  const [company, categories, brands, uoms, taxes, priceHistory] = await Promise.all([
    getCompany(item.COMPANY_ID),
    listCategories(item.COMPANY_ID),
    listBrands(item.COMPANY_ID),
    listUoms(),
    listTaxes(item.COMPANY_ID),
    getItemPriceHistory(id),
  ]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <BackLink href="/admin/items">Items</BackLink>
          <h1 className={styles.title} style={{ marginTop: 4 }}>
            {item.ITEM_CODE} — {item.ITEM_NAME}
          </h1>
          <p className={styles.subtitle}>
            {company ? `${company.COMPANY_CODE} — ${company.COMPANY_NAME}` : ""}
          </p>
        </div>
      </div>

      <ItemForm
        item={item}
        companyLabel={company ? `${company.COMPANY_CODE} — ${company.COMPANY_NAME}` : ""}
        categories={categories.map((c) => ({ value: String(c.CATEGORY_ID), label: c.CATEGORY_NAME }))}
        brands={brands.map((b) => ({ value: String(b.BRAND_ID), label: b.BRAND_NAME }))}
        uoms={uoms.map((u) => ({ value: u.UOM_CODE, label: `${u.UOM_CODE} — ${u.UOM_NAME}` }))}
        taxes={taxes.map((t) => ({
          value: String(t.TAX_ID),
          label: `${t.TAX_CODE} (${t.TAX_RATE}%)`,
        }))}
      />

      <PriceHistory
        itemId={id}
        canEdit={can(user.permissions, "ITEM_MAINT", "EDIT")}
        rows={priceHistory.map((p) => ({
          id: p.ITEM_PRICE_ID,
          salePrice: p.SALE_PRICE,
          effectiveFrom: p.EFFECTIVE_FROM.toISOString(),
          effectiveTo: p.EFFECTIVE_TO ? p.EFFECTIVE_TO.toISOString() : null,
        }))}
      />
    </div>
  );
}
