import "server-only";
import { query, execute, withTransaction } from "@/lib/oracle";
import { fromOracleDate } from "@/lib/oracle-date";

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

export async function listTaxes(companyId: number) {
  return query<{ TAX_ID: number; TAX_CODE: string; TAX_NAME: string; TAX_RATE: number }>(
    `SELECT tax_id, tax_code, tax_name, tax_rate
       FROM tax_master
      WHERE company_id = :companyId AND active_yn = 'Y'
      ORDER BY tax_code`,
    { companyId },
  );
}

export type ItemDetail = {
  ITEM_ID: number;
  COMPANY_ID: number;
  ITEM_CODE: string;
  ITEM_NAME: string;
  CATEGORY_ID: number | null;
  BRAND_ID: number | null;
  UOM_CODE: string;
  BARCODE: string | null;
  REORDER_LEVEL: number;
  TAX_ID: number | null;
  ACTIVE_YN: string;
};

export async function getItem(itemId: number) {
  const rows = await query<ItemDetail>(
    `SELECT item_id, company_id, item_code, item_name, category_id, brand_id,
            uom_code, barcode, reorder_level, tax_id, active_yn
       FROM item WHERE item_id = :id`,
    { id: itemId },
  );
  return rows[0] ?? null;
}

export type ItemPriceRow = {
  ITEM_PRICE_ID: number;
  SALE_PRICE: number;
  EFFECTIVE_FROM: Date;
  EFFECTIVE_TO: Date | null;
};

export async function getItemPriceHistory(itemId: number) {
  const rows = await query<ItemPriceRow>(
    `SELECT item_price_id, sale_price, effective_from, effective_to
       FROM item_price
      WHERE item_id = :itemId
      ORDER BY effective_from DESC`,
    { itemId },
  );
  return rows.map((r) => ({
    ...r,
    EFFECTIVE_FROM: fromOracleDate(r.EFFECTIVE_FROM),
    EFFECTIVE_TO: r.EFFECTIVE_TO ? fromOracleDate(r.EFFECTIVE_TO) : null,
  }));
}

/** The open-ended row (effective_to IS NULL), if one exists — the row a new
 *  price would need to close out before opening its own. */
export async function getCurrentOpenPrice(itemId: number) {
  const rows = await query<ItemPriceRow>(
    `SELECT item_price_id, sale_price, effective_from, effective_to
       FROM item_price
      WHERE item_id = :itemId AND effective_to IS NULL
      ORDER BY effective_from DESC
      FETCH FIRST 1 ROW ONLY`,
    { itemId },
  );
  const r = rows[0];
  return r ? { ...r, EFFECTIVE_FROM: fromOracleDate(r.EFFECTIVE_FROM), EFFECTIVE_TO: null } : null;
}

export type ItemInput = {
  companyId: number;
  itemCode: string;
  itemName: string;
  categoryId: number | null;
  brandId: number | null;
  uomCode: string;
  barcode: string | null;
  reorderLevel: number;
  taxId: number | null;
  activeYn: "Y" | "N";
};

function toOracleDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * The REST contract requires a paired item_price entry in the same write as
 * the item itself, so a new item is never left without a mandatory price.
 * Both statements commit together or neither does.
 */
export async function createItem(input: ItemInput, salePrice: number, effectiveFrom: Date) {
  await withTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO item (company_id, item_code, item_name, category_id, brand_id,
                         uom_code, barcode, reorder_level, tax_id, active_yn)
       VALUES (:companyId, :itemCode, :itemName, :categoryId, :brandId,
               :uomCode, :barcode, :reorderLevel, :taxId, :activeYn)`,
      { ...input },
    );

    const [created] = await tx.query<{ ITEM_ID: number }>(
      `SELECT item_id FROM item WHERE company_id = :companyId AND item_code = :itemCode`,
      { companyId: input.companyId, itemCode: input.itemCode },
    );
    if (!created) throw new Error("Item row was not found after insert");

    await tx.execute(
      `INSERT INTO item_price (company_id, item_id, sale_price, effective_from)
       VALUES (:companyId, :itemId, :salePrice, TO_DATE(:effectiveFrom,'YYYY-MM-DD'))`,
      {
        companyId: input.companyId,
        itemId: created.ITEM_ID,
        salePrice,
        effectiveFrom: toOracleDate(effectiveFrom),
      },
    );
  });
}

/** company_id is fixed — the same reasoning as every other master here. */
export async function updateItem(itemId: number, input: Omit<ItemInput, "companyId">) {
  await execute(
    `UPDATE item
        SET item_code     = :itemCode,
            item_name     = :itemName,
            category_id   = :categoryId,
            brand_id      = :brandId,
            uom_code      = :uomCode,
            barcode       = :barcode,
            reorder_level = :reorderLevel,
            tax_id        = :taxId,
            active_yn     = :activeYn
      WHERE item_id = :itemId`,
    { ...input, itemId },
  );
}

/**
 * Price history is never overwritten: this closes the currently open-ended
 * row's effective_to at the day before the new price starts, then opens a new
 * row from that date forward. If no open row exists yet (shouldn't happen
 * since createItem always seeds one, but a defensive case), it just inserts.
 */
export async function addItemPrice(
  companyId: number,
  itemId: number,
  salePrice: number,
  effectiveFrom: Date,
  userId: number,
) {
  await withTransaction(async (tx) => {
    const [open] = await tx.query<{ ITEM_PRICE_ID: number }>(
      `SELECT item_price_id FROM item_price
        WHERE item_id = :itemId AND effective_to IS NULL`,
      { itemId },
    );

    if (open) {
      const dayBefore = new Date(effectiveFrom);
      dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
      await tx.execute(
        `UPDATE item_price SET effective_to = TO_DATE(:d,'YYYY-MM-DD')
          WHERE item_price_id = :id`,
        { d: toOracleDate(dayBefore), id: open.ITEM_PRICE_ID },
      );
    }

    await tx.execute(
      `INSERT INTO item_price (company_id, item_id, sale_price, effective_from, created_by)
       VALUES (:companyId, :itemId, :salePrice, TO_DATE(:effectiveFrom,'YYYY-MM-DD'), :userId)`,
      {
        companyId,
        itemId,
        salePrice,
        effectiveFrom: toOracleDate(effectiveFrom),
        userId,
      },
    );
  });
}
