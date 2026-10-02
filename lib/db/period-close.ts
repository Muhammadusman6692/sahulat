import "server-only";
import oracledb from "oracledb";
import { query, execute, queryCursor } from "@/lib/oracle";
import { fromOracleDate } from "@/lib/oracle-date";

export type PeriodChecklistRow = {
  PERIOD_ID: number;
  PERIOD_NO: number;
  START_DATE: Date;
  END_DATE: Date;
  STATUS: "OPEN" | "CLOSED";
  DRAFT_COUNT: number;
  BALANCED: "Y" | "N";
};

/** Periods for one fiscal year, each with the two facts close_period itself
 *  checks — draft vouchers still open, and posted debit/credit balance — so
 *  the screen can show why a period isn't closable before the user tries. */
export async function getCloseChecklist(fyId: number): Promise<PeriodChecklistRow[]> {
  const rows = await query<PeriodChecklistRow>(
    `SELECT fp.period_id, fp.period_no, fp.start_date, fp.end_date, fp.status,
            (SELECT COUNT(*) FROM gl_voucher_hdr h
              WHERE h.period_id = fp.period_id AND h.status = 'DRAFT') AS draft_count,
            CASE WHEN (SELECT NVL(SUM(l.debit_amt),0) - NVL(SUM(l.credit_amt),0)
                         FROM gl_voucher_line l
                         JOIN gl_voucher_hdr h ON h.voucher_id = l.voucher_id
                        WHERE h.period_id = fp.period_id AND h.status = 'POSTED') = 0
                 THEN 'Y' ELSE 'N' END AS balanced
       FROM fiscal_period fp
      WHERE fp.fy_id = :fyId
      ORDER BY fp.period_no`,
    { fyId },
  );
  return rows.map((r) => ({
    ...r,
    START_DATE: fromOracleDate(r.START_DATE),
    END_DATE: fromOracleDate(r.END_DATE),
  }));
}

export type CloseLogRow = {
  LOG_ID: number;
  PERIOD_NO: number | null;
  ACTION: "PERIOD_CLOSE" | "PERIOD_REOPEN" | "FY_CLOSE" | "FY_REOPEN";
  REASON: string | null;
  PERFORMED_BY_NAME: string;
  PERFORMED_ON: Date;
};

export async function getCloseLog(fyId: number): Promise<CloseLogRow[]> {
  const rows = await query<CloseLogRow>(
    `SELECT l.log_id, fp.period_no, l.action, l.reason,
            u.full_name AS performed_by_name, l.performed_on
       FROM period_close_log l
       JOIN app_user u ON u.user_id = l.performed_by
       LEFT JOIN fiscal_period fp ON fp.period_id = l.period_id
      WHERE l.fy_id = :fyId
      ORDER BY l.performed_on DESC`,
    { fyId },
  );
  return rows.map((r) => ({ ...r, PERFORMED_ON: fromOracleDate(r.PERFORMED_ON) }));
}

const numBind = (val: number) => ({ val, type: oracledb.NUMBER });
const strBind = (val: string | null) => ({ val, type: oracledb.STRING });

export async function closePeriod(
  periodId: number,
  userId: number,
  reason: string | null,
): Promise<void> {
  await execute(`BEGIN pkg_period_close.close_period(:periodId, :userId, :reason); END;`, {
    periodId: numBind(periodId),
    userId: numBind(userId),
    reason: strBind(reason),
  });
}

export async function reopenPeriod(
  periodId: number,
  userId: number,
  reason: string,
): Promise<void> {
  await execute(`BEGIN pkg_period_close.reopen_period(:periodId, :userId, :reason); END;`, {
    periodId: numBind(periodId),
    userId: numBind(userId),
    reason: strBind(reason),
  });
}

export type YearEndPreviewRow = {
  COA_ID: number;
  ACCOUNT_CODE: string;
  ACCOUNT_NAME: string;
  ACCOUNT_NATURE: "INCOME" | "EXPENSE";
  ZERO_DEBIT: number;
  ZERO_CREDIT: number;
};

/** Mirrors exactly what close_fiscal_year will post — same PL/SQL function,
 *  not a hand-copied query — so the confirm modal can never show one thing
 *  and post another. */
export async function previewYearEndClose(fyId: number): Promise<YearEndPreviewRow[]> {
  return queryCursor<YearEndPreviewRow>(
    `BEGIN :cursor := pkg_period_close.preview_year_end_close(:fyId); END;`,
    { fyId: numBind(fyId) },
  );
}

export async function closeFiscalYear(
  fyId: number,
  userId: number,
  reason: string | null,
): Promise<void> {
  await execute(`BEGIN pkg_period_close.close_fiscal_year(:fyId, :userId, :reason); END;`, {
    fyId: numBind(fyId),
    userId: numBind(userId),
    reason: strBind(reason),
  });
}

export async function reopenFiscalYear(
  fyId: number,
  userId: number,
  reason: string,
): Promise<void> {
  await execute(`BEGIN pkg_period_close.reopen_fiscal_year(:fyId, :userId, :reason); END;`, {
    fyId: numBind(fyId),
    userId: numBind(userId),
    reason: strBind(reason),
  });
}
