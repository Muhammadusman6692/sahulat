import "server-only";
import { query, execute } from "@/lib/oracle";

export type CategoryRow = {
  CATEGORY_ID: number;
  CATEGORY_NAME: string;
  ITEM_COUNT: number;
};

export async function listCategories(companyId: number) {
  return query<CategoryRow>(
    `SELECT c.category_id, c.category_name,
            (SELECT COUNT(*) FROM item i WHERE i.category_id = c.category_id) AS item_count
       FROM item_category c
      WHERE c.company_id = :companyId
      ORDER BY c.category_name`,
    { companyId },
  );
}

export type CategoryDetail = {
  CATEGORY_ID: number;
  COMPANY_ID: number;
  CATEGORY_NAME: string;
};

export async function getCategory(categoryId: number) {
  const rows = await query<CategoryDetail>(
    `SELECT category_id, company_id, category_name FROM item_category WHERE category_id = :id`,
    { id: categoryId },
  );
  return rows[0] ?? null;
}

export async function createCategory(companyId: number, name: string) {
  await execute(
    `INSERT INTO item_category (company_id, category_name) VALUES (:companyId, :name)`,
    { companyId, name },
  );
}

export async function updateCategory(categoryId: number, name: string) {
  await execute(
    `UPDATE item_category SET category_name = :name WHERE category_id = :categoryId`,
    { categoryId, name },
  );
}
