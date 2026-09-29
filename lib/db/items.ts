import "server-only";
import { query } from "@/lib/oracle";

export type ItemRow = {
  ITEM_ID: number;
  ITEM_CODE: string;
  ITEM_NAME: string;
  CATEGORY_NAME: string | null;
  BRAND_NAME: string | null;
  UOM_CODE: string;
  BARCODE: string | null;
  SALE_PRICE: number | null;
  ON_HAND: number;
  REORDER_LEVEL: number;
  TAX_CODE: string | null;
  TAX_RATE: number | null;
  ACTIVE_YN: string;
};

export type ItemListFilters = {
  companyId: number;
  search?: string;
  categoryId?: number;
  brandId?: number;
  includeInactive?: boolean;
  page: number;
  pageSize: number;
};

export type ItemListResult = {
  rows: ItemRow[];
  total: number;
};

/**
 * Current sale price is the effective-dated row covering today; price history is
 * never overwritten, so this picks the latest one that has started and has not
 * expired. On-hand is derived from the stock ledger directly rather than from
 * running_qty, so it stays correct even before a recost has run.
 */
const SELECT_LIST = `
  SELECT i.item_id, i.item_code, i.item_name,
         c.category_name, b.brand_name, i.uom_code, i.barcode,
         i.reorder_level, i.active_yn,
         t.tax_code, t.tax_rate,
         (SELECT ip.sale_price
            FROM item_price ip
           WHERE ip.item_id = i.item_id
             AND ip.effective_from <= TRUNC(SYSDATE)
             AND (ip.effective_to IS NULL OR ip.effective_to >= TRUNC(SYSDATE))
           ORDER BY ip.effective_from DESC
           FETCH FIRST 1 ROW ONLY) AS sale_price,
         NVL((SELECT SUM(CASE WHEN sl.direction = 'I' THEN sl.qty ELSE -sl.qty END)
                FROM stock_ledger sl
               WHERE sl.item_id = i.item_id), 0) AS on_hand
    FROM item i
    LEFT JOIN item_category c ON c.category_id = i.category_id
    LEFT JOIN item_brand    b ON b.brand_id    = i.brand_id
    LEFT JOIN tax_master    t ON t.tax_id      = i.tax_id
`;

function buildWhere(f: ItemListFilters) {
  const where: string[] = ["i.company_id = :companyId"];
  const binds: Record<string, string | number> = { companyId: f.companyId };

  if (f.search) {
    where.push(
      `(UPPER(i.item_code) LIKE :search
        OR UPPER(i.item_name) LIKE :search
        OR i.barcode LIKE :searchRaw)`,
    );
    binds.search = `%${f.search.toUpperCase()}%`;
    binds.searchRaw = `%${f.search}%`;
  }
  if (f.categoryId) {
    where.push("i.category_id = :categoryId");
    binds.categoryId = f.categoryId;
  }
  if (f.brandId) {
    where.push("i.brand_id = :brandId");
    binds.brandId = f.brandId;
  }
  if (!f.includeInactive) {
    where.push("i.active_yn = 'Y'");
  }

  return { clause: `WHERE ${where.join(" AND ")}`, binds };
}

export async function listItems(f: ItemListFilters): Promise<ItemListResult> {
  const { clause, binds } = buildWhere(f);

  const [rows, counted] = await Promise.all([
    query<ItemRow>(
      `${SELECT_LIST} ${clause}
       ORDER BY i.item_code
       OFFSET :skip ROWS FETCH NEXT :take ROWS ONLY`,
      { ...binds, skip: (f.page - 1) * f.pageSize, take: f.pageSize },
    ),
    query<{ TOTAL: number }>(`SELECT COUNT(*) AS total FROM item i ${clause}`, binds),
  ]);

  return { rows, total: counted[0]?.TOTAL ?? 0 };
}

export async function listCategories(companyId: number) {
  return query<{ CATEGORY_ID: number; CATEGORY_NAME: string }>(
    `SELECT category_id, category_name
       FROM item_category WHERE company_id = :companyId
      ORDER BY category_name`,
    { companyId },
  );
}

export async function listBrands(companyId: number) {
  return query<{ BRAND_ID: number; BRAND_NAME: string }>(
    `SELECT brand_id, brand_name
       FROM item_brand WHERE company_id = :companyId
      ORDER BY brand_name`,
    { companyId },
  );
}
