import "server-only";
import { query, execute } from "@/lib/oracle";

/** Global, not company-scoped — uom is a shared reference table. */
export type UomRow = {
  UOM_CODE: string;
  UOM_NAME: string;
  ALLOW_DECIMAL: string;
};

export async function listUoms() {
  return query<UomRow>(
    `SELECT uom_code, uom_name, allow_decimal FROM uom ORDER BY uom_code`,
  );
}

export async function createUom(code: string, name: string, allowDecimal: string) {
  await execute(
    `INSERT INTO uom (uom_code, uom_name, allow_decimal) VALUES (:code, :name, :allowDecimal)`,
    { code, name, allowDecimal },
  );
}

export async function updateUom(code: string, name: string, allowDecimal: string) {
  await execute(
    `UPDATE uom SET uom_name = :name, allow_decimal = :allowDecimal WHERE uom_code = :code`,
    { code, name, allowDecimal },
  );
}
