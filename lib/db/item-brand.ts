import "server-only";
import { query, execute } from "@/lib/oracle";

export type BrandRow = {
  BRAND_ID: number;
  BRAND_NAME: string;
};

export async function listBrands(companyId: number) {
  return query<BrandRow>(
    `SELECT brand_id, brand_name
       FROM item_brand WHERE company_id = :companyId
      ORDER BY brand_name`,
    { companyId },
  );
}

export async function getBrand(brandId: number) {
  const rows = await query<BrandRow & { COMPANY_ID: number }>(
    `SELECT brand_id, company_id, brand_name FROM item_brand WHERE brand_id = :brandId`,
    { brandId },
  );
  return rows[0] ?? null;
}

export async function createBrand(companyId: number, name: string) {
  await execute(
    `INSERT INTO item_brand (company_id, brand_name) VALUES (:companyId, :name)`,
    { companyId, name },
  );
}

export async function updateBrand(brandId: number, name: string) {
  await execute(`UPDATE item_brand SET brand_name = :name WHERE brand_id = :brandId`, {
    name,
    brandId,
  });
}
