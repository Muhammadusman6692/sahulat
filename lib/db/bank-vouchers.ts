import "server-only";
import oracledb from "oracledb";
import { query, execute, withTransaction, type Tx } from "@/lib/oracle";
import { fromOracleDate } from "@/lib/oracle-date";

export type BvType = "BPV" | "BRV";
export type BvStatus = "DRAFT" | "POSTED" | "CANCELLED";
export type InstrumentType = "CHEQUE" | "ONLINE_TRANSFER" | "PAY_ORDER" | "DD" | "RTGS";

export type BvListRow = {
  VOUCHER_ID: number;
  VOUCHER_NO: string;
  VOUCHER_TYPE: BvType;
  VOUCHER_DATE: Date;
  BRANCH_NAME: string;
  BANK_ACCOUNT_CODE: string;
  BANK_ACCOUNT_NAME: string;
  NARRATION: string | null;
  STATUS: BvStatus;
  TOTAL_AMT: number;
  CREATED_BY_NAME: string;
  INSTRUMENT_TYPE: InstrumentType;
  INSTRUMENT_NO: string | null;
};

export type BvListFilters = {
  companyId: number;
  branchId?: number;
  type?: BvType;
  status?: BvStatus;
  search?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
  page: number;
  pageSize: number;
};

export type BvListResult = { rows: BvListRow[]; total: number };

// Exactly one line per voucher sits on a BANK control account (the fixed
// leg) — joining on coa.is_control_ac = 'BANK' finds it without needing a
// flag on gl_voucher_line itself. Same shape as Cash Voucher
// (lib/db/cash-vouchers.ts), just the other control type.
const LIST_SELECT = `
  SELECT h.voucher_id, h.voucher_no, h.voucher_type, h.voucher_date, b.branch_name,
         bc.account_code AS bank_account_code, bc.account_name AS bank_account_name,
         h.narration, h.status, u.full_name AS created_by_name,
         (cl.debit_amt + cl.credit_amt) AS total_amt,
         d.instrument_type, d.instrument_no
    FROM gl_voucher_hdr h
    JOIN branch b ON b.branch_id = h.branch_id
    JOIN app_user u ON u.user_id = h.created_by
    JOIN gl_voucher_line cl ON cl.voucher_id = h.voucher_id
    JOIN coa bc ON bc.coa_id = cl.coa_id AND bc.is_control_ac = 'BANK'
    JOIN bank_voucher_detail d ON d.voucher_id = h.voucher_id
`;

function buildWhere(f: BvListFilters) {
  const where: string[] = ["h.company_id = :companyId", "h.voucher_type IN ('BPV','BRV')"];
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
    where.push(
      "(UPPER(h.voucher_no) LIKE :search OR UPPER(h.narration) LIKE :search OR UPPER(d.instrument_no) LIKE :search)",
    );
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

export async function listBankVouchers(f: BvListFilters): Promise<BvListResult> {
  const { clause, binds } = buildWhere(f);

  const [rows, counted] = await Promise.all([
    query<BvListRow>(
      `${LIST_SELECT} ${clause}
       ORDER BY h.voucher_date DESC, h.voucher_id DESC
       OFFSET :skip ROWS FETCH NEXT :take ROWS ONLY`,
      { ...binds, skip: (f.page - 1) * f.pageSize, take: f.pageSize },
    ),
    query<{ TOTAL: number }>(
      `SELECT COUNT(*) AS total
         FROM gl_voucher_hdr h
         JOIN gl_voucher_line cl ON cl.voucher_id = h.voucher_id
         JOIN coa bc ON bc.coa_id = cl.coa_id AND bc.is_control_ac = 'BANK'
         JOIN bank_voucher_detail d ON d.voucher_id = h.voucher_id
       ${clause}`,
      binds,
    ),
  ]);

  return {
    rows: rows.map((r) => ({ ...r, VOUCHER_DATE: fromOracleDate(r.VOUCHER_DATE) })),
    total: counted[0]?.TOTAL ?? 0,
  };
}

export type BvHeader = {
  VOUCHER_ID: number;
  COMPANY_ID: number;
  BRANCH_ID: number;
  BRANCH_NAME: string;
  VOUCHER_TYPE: BvType;
  VOUCHER_NO: string;
  VOUCHER_DATE: Date;
  BANK_COA_ID: number;
  BANK_ACCOUNT_CODE: string;
  BANK_ACCOUNT_NAME: string;
  NARRATION: string | null;
  STATUS: BvStatus;
  CREATED_BY_NAME: string;
  CREATED_ON: Date;
  POSTED_BY_NAME: string | null;
  POSTED_ON: Date | null;
  INSTRUMENT_TYPE: InstrumentType;
  INSTRUMENT_NO: string | null;
  INSTRUMENT_DATE: Date | null;
};

export type BvLine = {
  LINE_ID: number;
  COA_ID: number;
  ACCOUNT_CODE: string;
  ACCOUNT_NAME: string;
  IS_BANK_LEG: "Y" | "N";
  PARTY_ID: number | null;
  PARTY_NAME: string | null;
  DEBIT_AMT: number;
  CREDIT_AMT: number;
  NARRATION: string | null;
};

export async function getBankVoucher(
  voucherId: number,
): Promise<{ header: BvHeader; lines: BvLine[]; freeLines: BvLine[] } | null> {
  const headers = await query<
    Omit<BvHeader, "BANK_COA_ID" | "BANK_ACCOUNT_CODE" | "BANK_ACCOUNT_NAME"> & {
      BANK_COA_ID: number;
      BANK_ACCOUNT_CODE: string;
      BANK_ACCOUNT_NAME: string;
    }
  >(
    `SELECT h.voucher_id, h.company_id, h.branch_id, b.branch_name, h.voucher_type,
            h.voucher_no, h.voucher_date, h.narration, h.status,
            cu.full_name AS created_by_name, h.created_on,
            pu.full_name AS posted_by_name, h.posted_on,
            bc.coa_id AS bank_coa_id, bc.account_code AS bank_account_code,
            bc.account_name AS bank_account_name,
            d.instrument_type, d.instrument_no, d.instrument_date
       FROM gl_voucher_hdr h
       JOIN branch b ON b.branch_id = h.branch_id
       JOIN app_user cu ON cu.user_id = h.created_by
       LEFT JOIN app_user pu ON pu.user_id = h.posted_by
       JOIN gl_voucher_line cl ON cl.voucher_id = h.voucher_id
       JOIN coa bc ON bc.coa_id = cl.coa_id AND bc.is_control_ac = 'BANK'
       JOIN bank_voucher_detail d ON d.voucher_id = h.voucher_id
      WHERE h.voucher_id = :voucherId AND h.voucher_type IN ('BPV','BRV')`,
    { voucherId },
  );
  const header = headers[0];
  if (!header) return null;

  const lines = await query<BvLine>(
    `SELECT l.line_id, l.coa_id, c.account_code, c.account_name,
            CASE WHEN c.is_control_ac = 'BANK' THEN 'Y' ELSE 'N' END AS is_bank_leg,
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
      INSTRUMENT_DATE: header.INSTRUMENT_DATE ? fromOracleDate(header.INSTRUMENT_DATE) : null,
    },
    lines,
    freeLines: lines.filter((l) => l.IS_BANK_LEG === "N"),
  };
}

export type BvFreeLineInput = {
  coaId: number;
  partyId: number | null;
  narration: string | null;
  amount: number;
};

export type InstrumentInput = {
  instrumentType: InstrumentType;
  instrumentNo: string | null;
  instrumentDate: string | null; // YYYY-MM-DD
};

export type BvHeaderInput = {
  companyId: number;
  branchId: number;
  voucherType: BvType;
  voucherDate: string; // YYYY-MM-DD
  bankCoaId: number;
  narration: string;
  userId: number;
} & InstrumentInput;

const numBind = (val: number | null) => ({ val, type: oracledb.NUMBER });
const strBind = (val: string | null) => ({ val, type: oracledb.STRING });

/** BRV debits bank and credits every free leg; BPV is the mirror image. */
function bankSide(voucherType: BvType): "debit" | "credit" {
  return voucherType === "BRV" ? "debit" : "credit";
}
function freeLegSide(voucherType: BvType): "debit" | "credit" {
  return voucherType === "BRV" ? "credit" : "debit";
}

async function insertFreeLines(
  tx: Tx,
  voucherId: number,
  voucherType: BvType,
  lines: BvFreeLineInput[],
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

async function insertBankLine(
  tx: Tx,
  voucherId: number,
  voucherType: BvType,
  bankCoaId: number,
  totalAmt: number,
) {
  const side = bankSide(voucherType);
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
      coaId: numBind(bankCoaId),
      debit: numBind(side === "debit" ? totalAmt : 0),
      credit: numBind(side === "credit" ? totalAmt : 0),
    },
  );
}

async function upsertInstrumentDetail(tx: Tx, voucherId: number, input: InstrumentInput) {
  await tx.execute(
    `MERGE INTO bank_voucher_detail t
     USING (SELECT :voucherId AS voucher_id FROM dual) s
        ON (t.voucher_id = s.voucher_id)
     WHEN MATCHED THEN
       UPDATE SET instrument_type = :instrumentType,
                  instrument_no   = :instrumentNo,
                  instrument_date = TO_DATE(:instrumentDate,'YYYY-MM-DD')
     WHEN NOT MATCHED THEN
       INSERT (voucher_id, instrument_type, instrument_no, instrument_date)
       VALUES (:voucherId, :instrumentType, :instrumentNo, TO_DATE(:instrumentDate,'YYYY-MM-DD'))`,
    {
      voucherId,
      instrumentType: input.instrumentType,
      instrumentNo: input.instrumentNo,
      instrumentDate: input.instrumentDate,
    },
  );
}

/** Creates a DRAFT voucher with its bank leg plus free legs, both inside
 *  pkg_gl so the fiscal period check and the row-locked numbering series
 *  stay the single source of truth, plus the instrument-detail row. Caller
 *  has already totalled the free legs into totalAmt. */
export async function createBankVoucherDraft(
  header: BvHeaderInput,
  freeLines: BvFreeLineInput[],
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
           p_source_module => 'BANK_VOUCHER',
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
    await insertBankLine(tx, voucherId, header.voucherType, header.bankCoaId, totalAmt);
    await upsertInstrumentDetail(tx, voucherId, header);

    const [row] = await tx.query<{ VOUCHER_NO: string }>(
      `SELECT voucher_no FROM gl_voucher_hdr WHERE voucher_id = :voucherId`,
      { voucherId },
    );
    return { voucherId, voucherNo: row.VOUCHER_NO };
  });
}

/** Replaces a DRAFT voucher's free legs, narration and instrument detail.
 *  Branch/date/type/bank account are fixed once created — changing them
 *  means starting a new voucher, same rule Journal Voucher and Cash Voucher
 *  apply to branch/date. */
export async function updateBankVoucherDraft(
  voucherId: number,
  narration: string,
  freeLines: BvFreeLineInput[],
  totalAmt: number,
  instrument: InstrumentInput,
): Promise<void> {
  await withTransaction(async (tx) => {
    const [existing] = await tx.query<{ STATUS: BvStatus; VOUCHER_TYPE: BvType }>(
      `SELECT status, voucher_type FROM gl_voucher_hdr WHERE voucher_id = :voucherId FOR UPDATE`,
      { voucherId },
    );
    if (!existing) throw new Error("This voucher no longer exists.");
    if (existing.STATUS !== "DRAFT") {
      throw new Error("Only a draft voucher can be edited.");
    }

    const [bankLine] = await tx.query<{ COA_ID: number }>(
      `SELECT l.coa_id
         FROM gl_voucher_line l
         JOIN coa c ON c.coa_id = l.coa_id AND c.is_control_ac = 'BANK'
        WHERE l.voucher_id = :voucherId`,
      { voucherId },
    );
    if (!bankLine) throw new Error("This voucher's bank account could not be found.");

    await tx.execute(`DELETE FROM gl_voucher_line WHERE voucher_id = :voucherId`, {
      voucherId,
    });
    await tx.execute(
      `UPDATE gl_voucher_hdr SET narration = :narration WHERE voucher_id = :voucherId`,
      { narration, voucherId },
    );
    await insertFreeLines(tx, voucherId, existing.VOUCHER_TYPE, freeLines);
    await insertBankLine(tx, voucherId, existing.VOUCHER_TYPE, bankLine.COA_ID, totalAmt);
    await upsertInstrumentDetail(tx, voucherId, instrument);
  });
}

/** DRAFT only — nothing has posted yet, so this is a hard delete, not a status flag. */
export async function deleteBankVoucherDraft(voucherId: number): Promise<void> {
  await withTransaction(async (tx) => {
    const [existing] = await tx.query<{ STATUS: BvStatus }>(
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
    await tx.execute(`DELETE FROM bank_voucher_detail WHERE voucher_id = :voucherId`, {
      voucherId,
    });
    await tx.execute(`DELETE FROM gl_voucher_hdr WHERE voucher_id = :voucherId`, {
      voucherId,
    });
  });
}

/** pkg_gl.post_voucher re-validates the balance and the fiscal period itself —
 *  the server action's own check is a UX shortcut, not the enforcement. */
export async function postBankVoucher(voucherId: number, userId: number): Promise<void> {
  await execute(`BEGIN pkg_gl.post_voucher(:voucherId, :userId); END;`, {
    voucherId: numBind(voucherId),
    userId: numBind(userId),
  });
}

export async function cancelPostedBankVoucher(
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
