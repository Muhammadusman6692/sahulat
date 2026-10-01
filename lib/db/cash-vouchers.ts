import "server-only";
import oracledb from "oracledb";
import { query, execute, withTransaction, type Tx } from "@/lib/oracle";
import { fromOracleDate } from "@/lib/oracle-date";

export type CvType = "CPV" | "CRV";
export type CvStatus = "DRAFT" | "POSTED" | "CANCELLED";

export type CvListRow = {
  VOUCHER_ID: number;
  VOUCHER_NO: string;
  VOUCHER_TYPE: CvType;
  VOUCHER_DATE: Date;
  BRANCH_NAME: string;
  CASH_ACCOUNT_CODE: string;
  CASH_ACCOUNT_NAME: string;
  NARRATION: string | null;
  STATUS: CvStatus;
  TOTAL_AMT: number;
  CREATED_BY_NAME: string;
};

export type CvListFilters = {
  companyId: number;
  branchId?: number;
  type?: CvType;
  status?: CvStatus;
  search?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
  page: number;
  pageSize: number;
};

export type CvListResult = { rows: CvListRow[]; total: number };

// Exactly one line per voucher sits on a CASH control account (the fixed
// leg) — joining on coa.is_control_ac = 'CASH' finds it without needing a
// flag on gl_voucher_line itself.
const LIST_SELECT = `
  SELECT h.voucher_id, h.voucher_no, h.voucher_type, h.voucher_date, b.branch_name,
         cc.account_code AS cash_account_code, cc.account_name AS cash_account_name,
         h.narration, h.status, u.full_name AS created_by_name,
         (cl.debit_amt + cl.credit_amt) AS total_amt
    FROM gl_voucher_hdr h
    JOIN branch b ON b.branch_id = h.branch_id
    JOIN app_user u ON u.user_id = h.created_by
    JOIN gl_voucher_line cl ON cl.voucher_id = h.voucher_id
    JOIN coa cc ON cc.coa_id = cl.coa_id AND cc.is_control_ac = 'CASH'
`;

function buildWhere(f: CvListFilters) {
  const where: string[] = ["h.company_id = :companyId", "h.voucher_type IN ('CPV','CRV')"];
  const binds: Record<string, string | number> = { companyId: f.companyId };

  if (f.type) {
    where.push("h.voucher_type = :type");
    binds.type = f.type;
  }
  if (f.branchId) {
    where.push("h.branch_id = :branchId");
    binds.branchId = f.branchId;
  }
  if (f.status) {
    where.push("h.status = :status");
    binds.status = f.status;
  }
  if (f.search) {
    where.push("(UPPER(h.voucher_no) LIKE :search OR UPPER(h.narration) LIKE :search)");
    binds.search = `%${f.search.toUpperCase()}%`;
  }
  if (f.dateFrom) {
    where.push("h.voucher_date >= TO_DATE(:dateFrom,'YYYY-MM-DD')");
    binds.dateFrom = f.dateFrom;
  }
  if (f.dateTo) {
    where.push("h.voucher_date <= TO_DATE(:dateTo,'YYYY-MM-DD')");
    binds.dateTo = f.dateTo;
  }

  return { clause: `WHERE ${where.join(" AND ")}`, binds };
}

export async function listCashVouchers(f: CvListFilters): Promise<CvListResult> {
  const { clause, binds } = buildWhere(f);

  const [rows, counted] = await Promise.all([
    query<CvListRow>(
      `${LIST_SELECT} ${clause}
       ORDER BY h.voucher_date DESC, h.voucher_id DESC
       OFFSET :skip ROWS FETCH NEXT :take ROWS ONLY`,
      { ...binds, skip: (f.page - 1) * f.pageSize, take: f.pageSize },
    ),
    query<{ TOTAL: number }>(
      `SELECT COUNT(*) AS total
         FROM gl_voucher_hdr h
         JOIN gl_voucher_line cl ON cl.voucher_id = h.voucher_id
         JOIN coa cc ON cc.coa_id = cl.coa_id AND cc.is_control_ac = 'CASH'
       ${clause}`,
      binds,
    ),
  ]);

  return {
    rows: rows.map((r) => ({ ...r, VOUCHER_DATE: fromOracleDate(r.VOUCHER_DATE) })),
    total: counted[0]?.TOTAL ?? 0,
  };
}

export type CvHeader = {
  VOUCHER_ID: number;
  COMPANY_ID: number;
  BRANCH_ID: number;
  BRANCH_NAME: string;
  VOUCHER_TYPE: CvType;
  VOUCHER_NO: string;
  VOUCHER_DATE: Date;
  CASH_COA_ID: number;
  CASH_ACCOUNT_CODE: string;
  CASH_ACCOUNT_NAME: string;
  NARRATION: string | null;
  STATUS: CvStatus;
  CREATED_BY_NAME: string;
  CREATED_ON: Date;
  POSTED_BY_NAME: string | null;
  POSTED_ON: Date | null;
};

export type CvLine = {
  LINE_ID: number;
  COA_ID: number;
  ACCOUNT_CODE: string;
  ACCOUNT_NAME: string;
  IS_CASH_LEG: "Y" | "N";
  PARTY_ID: number | null;
  PARTY_NAME: string | null;
  DEBIT_AMT: number;
  CREDIT_AMT: number;
  NARRATION: string | null;
};

export async function getCashVoucher(
  voucherId: number,
): Promise<{ header: CvHeader; lines: CvLine[]; freeLines: CvLine[] } | null> {
  const headers = await query<
    Omit<CvHeader, "CASH_COA_ID" | "CASH_ACCOUNT_CODE" | "CASH_ACCOUNT_NAME"> & {
      CASH_COA_ID: number;
      CASH_ACCOUNT_CODE: string;
      CASH_ACCOUNT_NAME: string;
    }
  >(
    `SELECT h.voucher_id, h.company_id, h.branch_id, b.branch_name, h.voucher_type,
            h.voucher_no, h.voucher_date, h.narration, h.status,
            cu.full_name AS created_by_name, h.created_on,
            pu.full_name AS posted_by_name, h.posted_on,
            cc.coa_id AS cash_coa_id, cc.account_code AS cash_account_code,
            cc.account_name AS cash_account_name
       FROM gl_voucher_hdr h
       JOIN branch b ON b.branch_id = h.branch_id
       JOIN app_user cu ON cu.user_id = h.created_by
       LEFT JOIN app_user pu ON pu.user_id = h.posted_by
       JOIN gl_voucher_line cl ON cl.voucher_id = h.voucher_id
       JOIN coa cc ON cc.coa_id = cl.coa_id AND cc.is_control_ac = 'CASH'
      WHERE h.voucher_id = :voucherId AND h.voucher_type IN ('CPV','CRV')`,
    { voucherId },
  );
  const header = headers[0];
  if (!header) return null;

  const lines = await query<CvLine>(
    `SELECT l.line_id, l.coa_id, c.account_code, c.account_name,
            CASE WHEN c.is_control_ac = 'CASH' THEN 'Y' ELSE 'N' END AS is_cash_leg,
            l.party_id, p.party_name, l.debit_amt, l.credit_amt, l.narration
       FROM gl_voucher_line l
       JOIN coa c ON c.coa_id = l.coa_id
       LEFT JOIN party p ON p.party_id = l.party_id
      WHERE l.voucher_id = :voucherId
      ORDER BY l.line_id`,
    { voucherId },
  );

  return {
    header: {
      ...header,
      VOUCHER_DATE: fromOracleDate(header.VOUCHER_DATE),
      CREATED_ON: fromOracleDate(header.CREATED_ON),
      POSTED_ON: header.POSTED_ON ? fromOracleDate(header.POSTED_ON) : null,
    },
    lines,
    freeLines: lines.filter((l) => l.IS_CASH_LEG === "N"),
  };
}

export type CvFreeLineInput = {
  coaId: number;
  partyId: number | null;
  narration: string | null;
  amount: number;
};

export type CvHeaderInput = {
  companyId: number;
  branchId: number;
  voucherType: CvType;
  voucherDate: string; // YYYY-MM-DD
  cashCoaId: number;
  narration: string;
  userId: number;
};

const numBind = (val: number | null) => ({ val, type: oracledb.NUMBER });
const strBind = (val: string | null) => ({ val, type: oracledb.STRING });

/** CRV debits cash and credits every free leg; CPV is the mirror image. */
function cashSide(voucherType: CvType): "debit" | "credit" {
  return voucherType === "CRV" ? "debit" : "credit";
}
function freeLegSide(voucherType: CvType): "debit" | "credit" {
  return voucherType === "CRV" ? "credit" : "debit";
}

async function insertFreeLines(
  tx: Tx,
  voucherId: number,
  voucherType: CvType,
  lines: CvFreeLineInput[],
) {
  const side = freeLegSide(voucherType);
  for (const l of lines) {
    await tx.execute(
      `BEGIN
         pkg_gl.add_line(
           p_voucher_id => :voucherId,
           p_coa_id     => :coaId,
           p_debit      => :debit,
           p_credit     => :credit,
           p_party_id   => :partyId,
           p_narration  => :narration
         );
       END;`,
      {
        voucherId: numBind(voucherId),
        coaId: numBind(l.coaId),
        debit: numBind(side === "debit" ? l.amount : 0),
        credit: numBind(side === "credit" ? l.amount : 0),
        partyId: numBind(l.partyId),
        narration: strBind(l.narration),
      },
    );
  }
}

async function insertCashLine(
  tx: Tx,
  voucherId: number,
  voucherType: CvType,
  cashCoaId: number,
  totalAmt: number,
) {
  const side = cashSide(voucherType);
  await tx.execute(
    `BEGIN
       pkg_gl.add_line(
         p_voucher_id => :voucherId,
         p_coa_id     => :coaId,
         p_debit      => :debit,
         p_credit     => :credit
       );
     END;`,
    {
      voucherId: numBind(voucherId),
      coaId: numBind(cashCoaId),
      debit: numBind(side === "debit" ? totalAmt : 0),
      credit: numBind(side === "credit" ? totalAmt : 0),
    },
  );
}

/** Creates a DRAFT voucher with its cash leg plus free legs, both inside
 *  pkg_gl so the fiscal period check and the row-locked numbering series
 *  stay the single source of truth. Caller has already totalled the free
 *  legs into totalAmt. */
export async function createCashVoucherDraft(
  header: CvHeaderInput,
  freeLines: CvFreeLineInput[],
  totalAmt: number,
): Promise<{ voucherId: number; voucherNo: string }> {
  return withTransaction(async (tx) => {
    const created = await tx.execute(
      `BEGIN
         :voucherId := pkg_gl.create_voucher(
           p_company_id    => :companyId,
           p_branch_id     => :branchId,
           p_voucher_type  => :voucherType,
           p_voucher_date  => TO_DATE(:voucherDate,'YYYY-MM-DD'),
           p_source_module => 'CASH_VOUCHER',
           p_source_doc_id => NULL,
           p_narration     => :narration,
           p_user_id       => :userId
         );
       END;`,
      {
        voucherId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        companyId: numBind(header.companyId),
        branchId: numBind(header.branchId),
        voucherType: strBind(header.voucherType),
        voucherDate: strBind(header.voucherDate),
        narration: strBind(header.narration),
        userId: numBind(header.userId),
      },
    );
    const outBinds = created.outBinds as { voucherId: number };
    const voucherId = outBinds.voucherId;

    await insertFreeLines(tx, voucherId, header.voucherType, freeLines);
    await insertCashLine(tx, voucherId, header.voucherType, header.cashCoaId, totalAmt);

    const [row] = await tx.query<{ VOUCHER_NO: string }>(
      `SELECT voucher_no FROM gl_voucher_hdr WHERE voucher_id = :voucherId`,
      { voucherId },
    );
    return { voucherId, voucherNo: row.VOUCHER_NO };
  });
}

/** Replaces a DRAFT voucher's free legs and narration. Branch/date/type/cash
 *  account are fixed once created — changing them means starting a new
 *  voucher, same rule Journal Voucher applies to branch/date. */
export async function updateCashVoucherDraft(
  voucherId: number,
  narration: string,
  freeLines: CvFreeLineInput[],
  totalAmt: number,
): Promise<void> {
  await withTransaction(async (tx) => {
    const [existing] = await tx.query<{ STATUS: CvStatus; VOUCHER_TYPE: CvType }>(
      `SELECT status, voucher_type FROM gl_voucher_hdr WHERE voucher_id = :voucherId FOR UPDATE`,
      { voucherId },
    );
    if (!existing) throw new Error("This voucher no longer exists.");
    if (existing.STATUS !== "DRAFT") {
      throw new Error("Only a draft voucher can be edited.");
    }

    const [cashLine] = await tx.query<{ COA_ID: number }>(
      `SELECT l.coa_id
         FROM gl_voucher_line l
         JOIN coa c ON c.coa_id = l.coa_id AND c.is_control_ac = 'CASH'
        WHERE l.voucher_id = :voucherId`,
      { voucherId },
    );
    if (!cashLine) throw new Error("This voucher's cash account could not be found.");

    await tx.execute(`DELETE FROM gl_voucher_line WHERE voucher_id = :voucherId`, {
      voucherId,
    });
    await tx.execute(
      `UPDATE gl_voucher_hdr SET narration = :narration WHERE voucher_id = :voucherId`,
      { narration, voucherId },
    );
    await insertFreeLines(tx, voucherId, existing.VOUCHER_TYPE, freeLines);
    await insertCashLine(tx, voucherId, existing.VOUCHER_TYPE, cashLine.COA_ID, totalAmt);
  });
}

/** DRAFT only — nothing has posted yet, so this is a hard delete, not a status flag. */
export async function deleteCashVoucherDraft(voucherId: number): Promise<void> {
  await withTransaction(async (tx) => {
    const [existing] = await tx.query<{ STATUS: CvStatus }>(
      `SELECT status FROM gl_voucher_hdr WHERE voucher_id = :voucherId FOR UPDATE`,
      { voucherId },
    );
    if (!existing) throw new Error("This voucher no longer exists.");
    if (existing.STATUS !== "DRAFT") {
      throw new Error("Only a draft voucher can be deleted.");
    }

    await tx.execute(`DELETE FROM gl_voucher_line WHERE voucher_id = :voucherId`, {
      voucherId,
    });
    await tx.execute(`DELETE FROM gl_voucher_hdr WHERE voucher_id = :voucherId`, {
      voucherId,
    });
  });
}

/** pkg_gl.post_voucher re-validates the balance and the fiscal period itself —
 *  the server action's own check is a UX shortcut, not the enforcement. */
export async function postCashVoucher(voucherId: number, userId: number): Promise<void> {
  await execute(`BEGIN pkg_gl.post_voucher(:voucherId, :userId); END;`, {
    voucherId: numBind(voucherId),
    userId: numBind(userId),
  });
}

export async function cancelPostedCashVoucher(
  voucherId: number,
  userId: number,
  reason: string,
): Promise<void> {
  await execute(`BEGIN pkg_gl.cancel_voucher(:voucherId, :userId, :reason); END;`, {
    voucherId: numBind(voucherId),
    userId: numBind(userId),
    reason: strBind(reason),
  });
}
