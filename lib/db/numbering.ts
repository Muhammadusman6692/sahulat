import "server-only";
import { query, execute } from "@/lib/oracle";

export type SeriesRow = {
  SERIES_ID: number;
  COMPANY_ID: number;
  COMPANY_CODE: string;
  BRANCH_ID: number | null;
  BRANCH_CODE: string | null;
  TERMINAL_ID: number | null;
  DOC_TYPE: string;
  PREFIX: string | null;
  NEXT_NUMBER: number;
  PAD_LENGTH: number;
  RESET_YEARLY: "Y" | "N";
  FY_ID: number | null;
  FY_NAME: string | null;
};

const SELECT_SERIES = `
  SELECT ns.series_id, ns.company_id, c.company_code,
         ns.branch_id, b.branch_code,
         ns.terminal_id, ns.doc_type, ns.prefix, ns.next_number,
         ns.pad_length, ns.reset_yearly, ns.fy_id, fy.fy_name
    FROM numbering_series ns
    JOIN company c ON c.company_id = ns.company_id
    LEFT JOIN branch b ON b.branch_id = ns.branch_id
    LEFT JOIN fiscal_year fy ON fy.fy_id = ns.fy_id
`;

export async function listSeries(companyId: number) {
  return query<SeriesRow>(
    `${SELECT_SERIES} WHERE ns.company_id = :companyId ORDER BY ns.doc_type, b.branch_code`,
    { companyId },
  );
}

export async function getSeries(seriesId: number) {
  const rows = await query<SeriesRow>(`${SELECT_SERIES} WHERE ns.series_id = :id`, {
    id: seriesId,
  });
  return rows[0] ?? null;
}

export type SeriesIdentity = {
  companyId: number;
  branchId: number | null;
  terminalId: number | null;
  docType: string;
};

export type SeriesSettings = {
  prefix: string | null;
  nextNumber: number;
  padLength: number;
  resetYearly: "Y" | "N";
  fyId: number | null;
};

export async function createSeries(identity: SeriesIdentity, settings: SeriesSettings) {
  await execute(
    `INSERT INTO numbering_series (company_id, branch_id, terminal_id, doc_type,
                                   prefix, next_number, pad_length, reset_yearly, fy_id)
     VALUES (:companyId, :branchId, :terminalId, :docType,
             :prefix, :nextNumber, :padLength, :resetYearly, :fyId)`,
    { ...identity, ...settings },
  );
}

/**
 * Identity (company/branch/terminal/doc_type) is fixed once a series exists —
 * pkg_numbering.get_next_number looks a row up by exactly those four fields,
 * so changing any of them would silently orphan whatever document sequence
 * was already running under the old identity.
 */
export async function updateSeries(seriesId: number, settings: SeriesSettings) {
  await execute(
    `UPDATE numbering_series
        SET prefix       = :prefix,
            next_number  = :nextNumber,
            pad_length   = :padLength,
            reset_yearly = :resetYearly,
            fy_id        = :fyId
      WHERE series_id = :seriesId`,
    { ...settings, seriesId },
  );
}
