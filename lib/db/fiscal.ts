import "server-only";
import { query, execute, withTransaction, type Tx } from "@/lib/oracle";
import { fromOracleDate } from "@/lib/oracle-date";

export type FiscalYearRow = {
  FY_ID: number;
  COMPANY_ID: number;
  COMPANY_CODE: string;
  COMPANY_NAME: string;
  FY_NAME: string;
  START_DATE: Date;
  END_DATE: Date;
  STATUS: "OPEN" | "CLOSED";
  PERIOD_COUNT: number;
  OPEN_PERIOD_COUNT: number;
};

export type FiscalPeriodRow = {
  PERIOD_ID: number;
  FY_ID: number;
  PERIOD_NO: number;
  START_DATE: Date;
  END_DATE: Date;
  STATUS: "OPEN" | "CLOSED";
};

function bindList(ids: number[], prefix: string) {
  const binds: Record<string, number> = {};
  const names = ids.map((id, i) => {
    binds[`${prefix}${i}`] = id;
    return `:${prefix}${i}`;
  });
  return { clause: names.join(","), binds };
}

function normalizeFy(row: FiscalYearRow): FiscalYearRow {
  return { ...row, START_DATE: fromOracleDate(row.START_DATE), END_DATE: fromOracleDate(row.END_DATE) };
}

function normalizePeriod(row: FiscalPeriodRow): FiscalPeriodRow {
  return { ...row, START_DATE: fromOracleDate(row.START_DATE), END_DATE: fromOracleDate(row.END_DATE) };
}

export async function listFiscalYears(companyIds: number[]) {
  if (companyIds.length === 0) return [];
  const { clause, binds } = bindList(companyIds, "c");

  const rows = await query<FiscalYearRow>(
    `SELECT fy.fy_id, fy.company_id, c.company_code, c.company_name,
            fy.fy_name, fy.start_date, fy.end_date, fy.status,
            (SELECT COUNT(*) FROM fiscal_period fp WHERE fp.fy_id = fy.fy_id) AS period_count,
            (SELECT COUNT(*) FROM fiscal_period fp
              WHERE fp.fy_id = fy.fy_id AND fp.status = 'OPEN') AS open_period_count
       FROM fiscal_year fy
       JOIN company c ON c.company_id = fy.company_id
      WHERE fy.company_id IN (${clause})
      ORDER BY c.company_code, fy.start_date DESC`,
    binds,
  );
  return rows.map(normalizeFy);
}

export async function getFiscalYear(fyId: number) {
  const rows = await query<FiscalYearRow>(
    `SELECT fy.fy_id, fy.company_id, c.company_code, c.company_name,
            fy.fy_name, fy.start_date, fy.end_date, fy.status,
            (SELECT COUNT(*) FROM fiscal_period fp WHERE fp.fy_id = fy.fy_id) AS period_count,
            (SELECT COUNT(*) FROM fiscal_period fp
              WHERE fp.fy_id = fy.fy_id AND fp.status = 'OPEN') AS open_period_count
       FROM fiscal_year fy
       JOIN company c ON c.company_id = fy.company_id
      WHERE fy.fy_id = :id`,
    { id: fyId },
  );
  return rows[0] ? normalizeFy(rows[0]) : null;
}

export async function getFiscalPeriods(fyId: number) {
  const rows = await query<FiscalPeriodRow>(
    `SELECT period_id, fy_id, period_no, start_date, end_date, status
       FROM fiscal_period
      WHERE fy_id = :fyId
      ORDER BY period_no`,
    { fyId },
  );
  return rows.map(normalizePeriod);
}

/** Active companies the user may reach, with fy_start_month for the New form. */
export async function listScopedCompaniesForFiscal(companyIds: number[]) {
  if (companyIds.length === 0) return [];
  const { clause, binds } = bindList(companyIds, "c");

  return query<{
    COMPANY_ID: number;
    COMPANY_CODE: string;
    COMPANY_NAME: string;
    FY_START_MONTH: number;
  }>(
    `SELECT company_id, company_code, company_name, fy_start_month
       FROM company
      WHERE company_id IN (${clause})
        AND active_yn = 'Y'
      ORDER BY company_code`,
    binds,
  );
}

/** Every existing fiscal year for a company, used to check for overlap and to
 *  suggest the next start date. */
export async function listCompanyFiscalYears(companyId: number) {
  const rows = await query<{ START_DATE: Date; END_DATE: Date }>(
    `SELECT start_date, end_date FROM fiscal_year
      WHERE company_id = :companyId
      ORDER BY start_date`,
    { companyId },
  );
  return rows.map((r) => ({
    START_DATE: fromOracleDate(r.START_DATE),
    END_DATE: fromOracleDate(r.END_DATE),
  }));
}

export type NewPeriod = { periodNo: number; startDate: Date; endDate: Date };

export type FiscalYearInput = {
  companyId: number;
  fyName: string;
  startDate: Date;
  endDate: Date;
  periods: NewPeriod[];
};

function toOracleDate(d: Date) {
  // Sent as a plain date; the column is DATE, not TIMESTAMP, and time-of-day
  // would otherwise drift by timezone between Node and the session.
  return d.toISOString().slice(0, 10);
}

export async function createFiscalYear(input: FiscalYearInput) {
  await withTransaction(async (tx: Tx) => {
    await tx.execute(
      `INSERT INTO fiscal_year (company_id, fy_name, start_date, end_date, status)
       VALUES (:companyId, :fyName, TO_DATE(:startDate,'YYYY-MM-DD'),
               TO_DATE(:endDate,'YYYY-MM-DD'), 'OPEN')`,
      {
        companyId: input.companyId,
        fyName: input.fyName,
        startDate: toOracleDate(input.startDate),
        endDate: toOracleDate(input.endDate),
      },
    );

    const [created] = await tx.query<{ FY_ID: number }>(
      `SELECT fy_id FROM fiscal_year
        WHERE company_id = :companyId AND fy_name = :fyName`,
      { companyId: input.companyId, fyName: input.fyName },
    );
    if (!created) throw new Error("Fiscal year row was not found after insert");

    for (const p of input.periods) {
      await tx.execute(
        `INSERT INTO fiscal_period (fy_id, period_no, start_date, end_date, status)
         VALUES (:fyId, :periodNo, TO_DATE(:startDate,'YYYY-MM-DD'),
                 TO_DATE(:endDate,'YYYY-MM-DD'), 'OPEN')`,
        {
          fyId: created.FY_ID,
          periodNo: p.periodNo,
          startDate: toOracleDate(p.startDate),
          endDate: toOracleDate(p.endDate),
        },
      );
    }
  });
}

export async function renameFiscalYear(fyId: number, fyName: string) {
  await execute(`UPDATE fiscal_year SET fy_name = :fyName WHERE fy_id = :fyId`, {
    fyName,
    fyId,
  });
}

export async function setPeriodStatus(
  periodId: number,
  status: "OPEN" | "CLOSED",
) {
  await execute(
    `UPDATE fiscal_period SET status = :status WHERE period_id = :periodId`,
    { status, periodId },
  );
}

/**
 * The year-level flag is not read by pkg_gl (only fiscal_period.status gates
 * posting), so this is a summary marker, not an independent control. Closing
 * is only allowed once every period is already closed, so the flag never
 * claims a year is closed while a period inside it can still be posted to.
 */
export async function setFiscalYearStatus(
  fyId: number,
  status: "OPEN" | "CLOSED",
) {
  if (status === "CLOSED") {
    const openPeriods = await query<{ CNT: number }>(
      `SELECT COUNT(*) AS cnt FROM fiscal_period
        WHERE fy_id = :fyId AND status = 'OPEN'`,
      { fyId },
    );
    if ((openPeriods[0]?.CNT ?? 0) > 0) {
      throw new Error(
        "All twelve periods must be closed before the fiscal year can be marked closed.",
      );
    }
  }
  await execute(`UPDATE fiscal_year SET status = :status WHERE fy_id = :fyId`, {
    status,
    fyId,
  });
}
