import "server-only";
import { query, withTransaction, type Tx } from "@/lib/oracle";

export type WarehouseRow = {
  WAREHOUSE_ID: number;
  COMPANY_ID: number;
  COMPANY_CODE: string;
  BRANCH_ID: number;
  BRANCH_CODE: string;
  BRANCH_NAME: string;
  WAREHOUSE_CODE: string;
  WAREHOUSE_NAME: string;
  IS_SHARED: string;
  ACTIVE_YN: string;
  LINKED_BRANCHES: number;
  STOCK_ROWS: number;
};

export type WarehouseInput = {
  companyId: number;
  branchId: number;
  warehouseCode: string;
  warehouseName: string;
  isShared: "Y" | "N";
  activeYn: "Y" | "N";
  /** Every branch allowed to use this warehouse; the owning branch is always included. */
  linkedBranchIds: number[];
};

function bindList(ids: number[], prefix: string) {
  const binds: Record<string, number> = {};
  const names = ids.map((id, i) => {
    binds[`${prefix}${i}`] = id;
    return `:${prefix}${i}`;
  });
  return { clause: names.join(","), binds };
}

export async function listWarehouses(
  companyIds: number[],
  includeInactive: boolean,
) {
  if (companyIds.length === 0) return [];
  const { clause, binds } = bindList(companyIds, "c");

  return query<WarehouseRow>(
    `SELECT w.warehouse_id, w.company_id, c.company_code,
            w.branch_id, b.branch_code, b.branch_name,
            w.warehouse_code, w.warehouse_name, w.is_shared, w.active_yn,
            (SELECT COUNT(*) FROM branch_warehouse bw
              WHERE bw.warehouse_id = w.warehouse_id) AS linked_branches,
            (SELECT COUNT(*) FROM stock_ledger sl
              WHERE sl.warehouse_id = w.warehouse_id) AS stock_rows
       FROM warehouse w
       JOIN company c ON c.company_id = w.company_id
       JOIN branch  b ON b.branch_id  = w.branch_id
      WHERE w.company_id IN (${clause})
        AND (:includeInactive = 1 OR w.active_yn = 'Y')
      ORDER BY c.company_code, b.branch_code, w.warehouse_code`,
    { ...binds, includeInactive: includeInactive ? 1 : 0 },
  );
}

export async function getWarehouse(warehouseId: number) {
  const rows = await query<WarehouseRow>(
    `SELECT w.warehouse_id, w.company_id, c.company_code,
            w.branch_id, b.branch_code, b.branch_name,
            w.warehouse_code, w.warehouse_name, w.is_shared, w.active_yn,
            0 AS linked_branches, 0 AS stock_rows
       FROM warehouse w
       JOIN company c ON c.company_id = w.company_id
       JOIN branch  b ON b.branch_id  = w.branch_id
      WHERE w.warehouse_id = :id`,
    { id: warehouseId },
  );
  return rows[0] ?? null;
}

export async function getLinkedBranchIds(warehouseId: number) {
  const rows = await query<{ BRANCH_ID: number }>(
    `SELECT branch_id FROM branch_warehouse WHERE warehouse_id = :id`,
    { id: warehouseId },
  );
  return rows.map((r) => r.BRANCH_ID);
}

/** Active branches in the companies the user may reach, for the pickers. */
export async function listSelectableBranches(companyIds: number[]) {
  if (companyIds.length === 0) return [];
  const { clause, binds } = bindList(companyIds, "c");

  return query<{
    BRANCH_ID: number;
    BRANCH_CODE: string;
    BRANCH_NAME: string;
    COMPANY_ID: number;
    COMPANY_CODE: string;
  }>(
    `SELECT b.branch_id, b.branch_code, b.branch_name,
            b.company_id, c.company_code
       FROM branch b
       JOIN company c ON c.company_id = b.company_id
      WHERE b.company_id IN (${clause})
        AND b.active_yn = 'Y'
      ORDER BY c.company_code, b.branch_code`,
    binds,
  );
}

async function replaceLinks(tx: Tx, warehouseId: number, branchIds: number[]) {
  await tx.execute(`DELETE FROM branch_warehouse WHERE warehouse_id = :id`, {
    id: warehouseId,
  });
  for (const branchId of branchIds) {
    await tx.execute(
      `INSERT INTO branch_warehouse (branch_id, warehouse_id)
       VALUES (:branchId, :warehouseId)`,
      { branchId, warehouseId },
    );
  }
}

export async function createWarehouse(input: WarehouseInput) {
  await withTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO warehouse (company_id, branch_id, warehouse_code,
                              warehouse_name, is_shared, active_yn)
       VALUES (:companyId, :branchId, :warehouseCode,
               :warehouseName, :isShared, :activeYn)`,
      {
        companyId: input.companyId,
        branchId: input.branchId,
        warehouseCode: input.warehouseCode,
        warehouseName: input.warehouseName,
        isShared: input.isShared,
        activeYn: input.activeYn,
      },
    );

    // Read the id back on the unique (company, code) pair rather than using an
    // OUT bind, which the driver rejects here.
    const [created] = await tx.query<{ WAREHOUSE_ID: number }>(
      `SELECT warehouse_id FROM warehouse
        WHERE company_id = :companyId AND warehouse_code = :warehouseCode`,
      { companyId: input.companyId, warehouseCode: input.warehouseCode },
    );
    if (!created) throw new Error("Warehouse row was not found after insert");

    await replaceLinks(tx, created.WAREHOUSE_ID, input.linkedBranchIds);
  });
}

/** company_id and branch_id are fixed once stock exists; see the action. */
export async function updateWarehouse(
  warehouseId: number,
  input: WarehouseInput,
) {
  await withTransaction(async (tx) => {
    await tx.execute(
      `UPDATE warehouse
          SET warehouse_code = :warehouseCode,
              warehouse_name = :warehouseName,
              is_shared      = :isShared,
              active_yn      = :activeYn
        WHERE warehouse_id = :warehouseId`,
      {
        warehouseCode: input.warehouseCode,
        warehouseName: input.warehouseName,
        isShared: input.isShared,
        activeYn: input.activeYn,
        warehouseId,
      },
    );
    await replaceLinks(tx, warehouseId, input.linkedBranchIds);
  });
}
