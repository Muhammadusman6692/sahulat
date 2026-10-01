import "server-only";
import oracledb from "oracledb";
import { query, execute, withTransaction, type Tx } from "@/lib/oracle";
import { fromOracleDate } from "@/lib/oracle-date";

export type JvStatus = "DRAFT" | "POSTED" | "CANCELLED";

export type JvListRow = {
  VOUCHER_ID: number;
  VOUCHER_NO: string;
  VOUCHER_DATE: Date;
  BRANCH_NAME: string;
  NARRATION: string | null;
  STATUS: JvStatus;
  TOTAL_AMT: number;
  CREATED_BY_NAME: string;
};

export type JvListFilters = {
  companyId: number;
  branchId?: number;
  status?: JvStatus;
  search?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
  page: number;
  pageSize: number;
};

export type JvListResult = { rows: JvListRow[]; total: number };

const LIST_SELECT = `
  SELECT h.voucher_id, h.voucher_no, h.voucher_date, b.branch_name,
         h.narration, h.status, u.full_name AS created_by_name,
         (SELECT NVL(SUM(l.debit_amt), 0)
            FROM gl_voucher_line l WHERE l.voucher_id = h.voucher_id) AS total_amt
    FROM gl_voucher_hdr h
    JOIN branch b ON b.branch_id = h.branch_id
    JOIN app_user u ON u.user_id = h.created_by
`;

function buildWhere(f: JvListFilters) {
  const where: string[] = ["h.company_id = :companyId", "h.voucher_type = 'JV'"];
  const binds: Record<string, string | number> = { companyId: f.companyId };

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

export async function listJournalVouchers(f: JvListFilters): Promise<JvListResult> {
  const { clause, binds } = buildWhere(f);

  const [rows, counted] = await Promise.all([
    query<JvListRow>(
      `${LIST_SELECT} ${clause}
       ORDER BY h.voucher_date DESC, h.voucher_id DESC
       OFFSET :skip ROWS FETCH NEXT :take ROWS ONLY`,
      { ...binds, skip: (f.page - 1) * f.pageSize, take: f.pageSize },
    ),
    query<{ TOTAL: number }>(
      `SELECT COUNT(*) AS total FROM gl_voucher_hdr h ${clause}`,
      binds,
    ),
  ]);

  return {
    rows: rows.map((r) => ({ ...r, VOUCHER_DATE: fromOracleDate(r.VOUCHER_DATE) })),
    total: counted[0]?.TOTAL ?? 0,
  };
}

export type JvHeader = {
  VOUCHER_ID: number;
  COMPANY_ID: number;
  BRANCH_ID: number;
  BRANCH_NAME: string;
  VOUCHER_NO: string;
  VOUCHER_DATE: Date;
  NARRATION: string | null;
  STATUS: JvStatus;
  CREATED_BY_NAME: string;
  CREATED_ON: Date;
  POSTED_BY_NAME: string | null;
  POSTED_ON: Date | null;
};

export type JvLine = {
  LINE_ID: number;
  COA_ID: number;
  ACCOUNT_CODE: string;
  ACCOUNT_NAME: string;
  PARTY_ID: number | null;
  PARTY_NAME: string | null;
  DEBIT_AMT: number;
  CREDIT_AMT: number;
  NARRATION: string | null;
};

export async function getJournalVoucher(
  voucherId: number,
): Promise<{ header: JvHeader; lines: JvLine[] } | null> {
  const headers = await query<JvHeader>(
    `SELECT h.voucher_id, h.company_id, h.branch_id, b.branch_name, h.voucher_no,
            h.voucher_date, h.narration, h.status,
            cu.full_name AS created_by_name, h.created_on,
            pu.full_name AS posted_by_name, h.posted_on
       FROM gl_voucher_hdr h
       JOIN branch b ON b.branch_id = h.branch_id
       JOIN app_user cu ON cu.user_id = h.created_by
       LEFT JOIN app_user pu ON pu.user_id = h.posted_by
      WHERE h.voucher_id = :voucherId AND h.voucher_type = 'JV'`,
    { voucherId },
  );
  const header = headers[0];
  if (!header) return null;

  const lines = await query<JvLine>(
    `SELECT l.line_id, l.coa_id, c.account_code, c.account_name,
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
  };
}

export type JvLineInput = {
  coaId: number;
  partyId: number | null;
  narration: string | null;
  debit: number;
  credit: number;
};

export type JvHeaderInput = {
  companyId: number;
  branchId: number;
  voucherDate: string; // YYYY-MM-DD
  narration: string;
  userId: number;
};

const numBind = (val: number | null) => ({ val, type: oracledb.NUMBER });
const strBind = (val: string | null) => ({ val, type: oracledb.STRING });

async function insertLines(tx: Tx, voucherId: number, lines: JvLineInput[]) {
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
        debit: numBind(l.debit),
        credit: numBind(l.credit),
        partyId: numBind(l.partyId),
        narration: strBind(l.narration),
      },
    );
  }
}

/** Creates a DRAFT voucher with its lines, both inside pkg_gl so the fiscal
 *  period check and the row-locked numbering series stay the single source of
 *  truth. Caller has already checked total debit = total credit. */
export async function createJournalVoucherDraft(
  header: JvHeaderInput,
  lines: JvLineInput[],
): Promise<{ voucherId: number; voucherNo: string }> {
  return withTransaction(async (tx) => {
    const created = await tx.execute(
      `BEGIN
         :voucherId := pkg_gl.create_voucher(
           p_company_id    => :companyId,
           p_branch_id     => :branchId,
           p_voucher_type  => 'JV',
           p_voucher_date  => TO_DATE(:voucherDate,'YYYY-MM-DD'),
           p_source_module => 'JV_ENTRY',
           p_source_doc_id => NULL,
           p_narration     => :narration,
           p_user_id       => :userId
         );
       END;`,
      {
        voucherId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        companyId: numBind(header.companyId),
        branchId: numBind(header.branchId),
        voucherDate: strBind(header.voucherDate),
        narration: strBind(header.narration),
        userId: numBind(header.userId),
      },
    );
    const outBinds = created.outBinds as { voucherId: number };
    const voucherId = outBinds.voucherId;

    await insertLines(tx, voucherId, lines);

    const [row] = await tx.query<{ VOUCHER_NO: string }>(
      `SELECT voucher_no FROM gl_voucher_hdr WHERE voucher_id = :voucherId`,
      { voucherId },
    );
    return { voucherId, voucherNo: row.VOUCHER_NO };
  });
}

/** Replaces a DRAFT voucher's lines and narration. Branch/date/voucher number
 *  are fixed once created — changing them means starting a new voucher. */
export async function updateJournalVoucherDraft(
  voucherId: number,
  narration: string,
  lines: JvLineInput[],
): Promise<void> {
  await withTransaction(async (tx) => {
    const [existing] = await tx.query<{ STATUS: JvStatus }>(
      `SELECT status FROM gl_voucher_hdr WHERE voucher_id = :voucherId FOR UPDATE`,
      { voucherId },
    );
    if (!existing) throw new Error("This voucher no longer exists.");
    if (existing.STATUS !== "DRAFT") {
      throw new Error("Only a draft voucher can be edited.");
    }

    await tx.execute(`DELETE FROM gl_voucher_line WHERE voucher_id = :voucherId`, {
      voucherId,
    });
    await tx.execute(
      `UPDATE gl_voucher_hdr SET narration = :narration WHERE voucher_id = :voucherId`,
      { narration, voucherId },
    );
    await insertLines(tx, voucherId, lines);
  });
}

/** DRAFT only — nothing has posted yet, so this is a hard delete, not a status flag. */
export async function deleteJournalVoucherDraft(voucherId: number): Promise<void> {
  await withTransaction(async (tx) => {
    const [existing] = await tx.query<{ STATUS: JvStatus }>(
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
export async function postJournalVoucher(voucherId: number, userId: number): Promise<void> {
  await execute(`BEGIN pkg_gl.post_voucher(:voucherId, :userId); END;`, {
    voucherId: numBind(voucherId),
    userId: numBind(userId),
  });
}

export async function cancelPostedJournalVoucher(
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
