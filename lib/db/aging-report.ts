import "server-only";
import { query } from "@/lib/oracle";
import { fromOracleDate } from "@/lib/oracle-date";

export type AgingBucket = "NOT_DUE" | "D1_30" | "D31_60" | "D61_90" | "D90_PLUS";

export const AGING_BUCKETS: { key: AgingBucket; label: string }[] = [
  { key: "NOT_DUE", label: "Not Due" },
  { key: "D1_30", label: "1-30" },
  { key: "D31_60", label: "31-60" },
  { key: "D61_90", label: "61-90" },
  { key: "D90_PLUS", label: "90+" },
];

function bucketFor(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 0) return "NOT_DUE";
  if (daysOverdue <= 30) return "D1_30";
  if (daysOverdue <= 60) return "D31_60";
  if (daysOverdue <= 90) return "D61_90";
  return "D90_PLUS";
}

const MS_PER_DAY = 86400000;

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * MS_PER_DAY);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / MS_PER_DAY);
}

export type OpenParcel = {
  date: Date;
  amount: number; // positive = aged (owed by party), negative = unapplied advance
  voucherId: number;
  voucherNo: string;
  voucherType: string;
  narration: string | null;
};

type FifoRow = {
  date: Date;
  debit: number;
  credit: number;
  voucherId: number;
  voucherNo: string;
  voucherType: string;
  narration: string | null;
};

/** FIFO allocation: a debit first cancels the oldest open advance (negative
 *  parcels), then opens a new parcel for whatever's left; a credit first
 *  consumes the oldest open parcels, then becomes/extends an advance. One
 *  unified queue handles both directions without special-casing which side
 *  the party is currently on. */
function allocateFifo(rows: FifoRow[]): OpenParcel[] {
  const queue: OpenParcel[] = [];

  for (const row of rows) {
    const net = row.debit - row.credit;
    if (net === 0) continue;

    let remaining = Math.abs(net);
    const consumingAdvance = net > 0; // debit consumes negative parcels, credit consumes positive ones
    while (remaining > 0 && queue.length > 0) {
      const front = queue[0];
      const frontIsAdvance = front.amount < 0;
      if (frontIsAdvance !== consumingAdvance) break;
      const available = Math.abs(front.amount);
      const offset = Math.min(remaining, available);
      front.amount += consumingAdvance ? offset : -offset;
      remaining -= offset;
      if (front.amount === 0) queue.shift();
    }
    if (remaining > 0) {
      queue.push({
        date: row.date,
        amount: net > 0 ? remaining : -remaining,
        voucherId: row.voucherId,
        voucherNo: row.voucherNo,
        voucherType: row.voucherType,
        narration: row.narration,
      });
    }
  }

  return queue;
}

export type PartyAgingOption = {
  PARTY_ID: number;
  PARTY_CODE: string;
  PARTY_NAME: string;
  IS_CUSTOMER: "Y" | "N";
  IS_SUPPLIER: "Y" | "N";
};

/** Same universe as listPartiesForLedger (party-ledger.ts) — parties with at
 *  least one auto-created control account. Kept as its own query so this
 *  module never has to touch the already-shipped Party Ledger code. */
export async function listPartiesForAging(companyId: number): Promise<PartyAgingOption[]> {
  return query<PartyAgingOption>(
    `SELECT party_id, party_code, party_name, is_customer, is_supplier
       FROM party
      WHERE company_id = :companyId
        AND active_yn = 'Y'
        AND (ar_coa_id IS NOT NULL OR ap_coa_id IS NOT NULL)
      ORDER BY party_code`,
    { companyId },
  );
}

type RawRow = {
  PARTY_ID: number;
  CREDIT_DAYS: number;
  VOUCHER_ID: number;
  VOUCHER_NO: string;
  VOUCHER_TYPE: string;
  VOUCHER_DATE: Date;
  NARRATION: string | null;
  DEBIT_AMT: number;
  CREDIT_AMT: number;
};

async function fetchRows(
  companyId: number,
  asOfDate: string,
  branchId: number | undefined,
  partyId: number | undefined,
): Promise<RawRow[]> {
  const branchClause = branchId ? "AND h.branch_id = :branchId" : "";
  const partyClause = partyId ? "AND p.party_id = :partyId" : "";
  const binds: Record<string, string | number> = { companyId, asOfDate };
  if (branchId) binds.branchId = branchId;
  if (partyId) binds.partyId = partyId;

  return query<RawRow>(
    `SELECT p.party_id, p.credit_days,
            h.voucher_id, h.voucher_no, h.voucher_type, h.voucher_date,
            l.narration, l.debit_amt, l.credit_amt
       FROM gl_voucher_line l
       JOIN gl_voucher_hdr h ON h.voucher_id = l.voucher_id
       JOIN party p ON p.company_id = h.company_id AND l.coa_id IN (p.ar_coa_id, p.ap_coa_id)
      WHERE h.company_id = :companyId
        AND h.status = 'POSTED'
        AND h.voucher_date <= TO_DATE(:asOfDate,'YYYY-MM-DD')
        ${branchClause}
        ${partyClause}
      ORDER BY p.party_id, h.voucher_date, h.voucher_id, l.line_id`,
    binds,
  );
}

export type PartyAgingRow = {
  PARTY_ID: number;
  PARTY_CODE: string;
  PARTY_NAME: string;
  buckets: Record<AgingBucket, number>;
  advance: number; // negative, or 0
  total: number; // sum of buckets + advance
};

export type AgingSummary = {
  asOfDate: string;
  rows: PartyAgingRow[];
  grandTotal: Record<AgingBucket, number> & { advance: number; total: number };
};

function emptyBuckets(): Record<AgingBucket, number> {
  return { NOT_DUE: 0, D1_30: 0, D31_60: 0, D61_90: 0, D90_PLUS: 0 };
}

export async function getAgingSummary(f: {
  companyId: number;
  branchId?: number;
  asOfDate: string; // YYYY-MM-DD
}): Promise<AgingSummary> {
  const [parties, rawRows] = await Promise.all([
    listPartiesForAging(f.companyId),
    fetchRows(f.companyId, f.asOfDate, f.branchId, undefined),
  ]);

  const partyMap = new Map(parties.map((p) => [p.PARTY_ID, p]));
  const asOf = new Date(`${f.asOfDate}T00:00:00.000Z`);

  const byParty = new Map<number, RawRow[]>();
  for (const r of rawRows) {
    const list = byParty.get(r.PARTY_ID) ?? [];
    list.push(r);
    byParty.set(r.PARTY_ID, list);
  }

  const rows: PartyAgingRow[] = [];
  const grandTotal = { ...emptyBuckets(), advance: 0, total: 0 };

  for (const [partyId, partyRows] of byParty) {
    const party = partyMap.get(partyId);
    if (!party) continue;
    const creditDays = partyRows[0]?.CREDIT_DAYS ?? 0;

    const fifoRows: FifoRow[] = partyRows.map((r) => ({
      date: fromOracleDate(r.VOUCHER_DATE),
      debit: r.DEBIT_AMT,
      credit: r.CREDIT_AMT,
      voucherId: r.VOUCHER_ID,
      voucherNo: r.VOUCHER_NO,
      voucherType: r.VOUCHER_TYPE,
      narration: r.NARRATION,
    }));
    const parcels = allocateFifo(fifoRows);

    const buckets = emptyBuckets();
    let advance = 0;
    for (const parcel of parcels) {
      if (parcel.amount < 0) {
        advance += parcel.amount;
        continue;
      }
      const dueDate = addDays(parcel.date, creditDays);
      const daysOverdue = daysBetween(asOf, dueDate);
      buckets[bucketFor(daysOverdue)] += parcel.amount;
    }

    const total = buckets.NOT_DUE + buckets.D1_30 + buckets.D31_60 + buckets.D61_90 + buckets.D90_PLUS + advance;
    if (total === 0 && advance === 0) continue; // fully settled party, nothing to show

    rows.push({
      PARTY_ID: party.PARTY_ID,
      PARTY_CODE: party.PARTY_CODE,
      PARTY_NAME: party.PARTY_NAME,
      buckets,
      advance,
      total,
    });

    for (const key of Object.keys(buckets) as AgingBucket[]) grandTotal[key] += buckets[key];
    grandTotal.advance += advance;
    grandTotal.total += total;
  }

  rows.sort((a, b) => a.PARTY_CODE.localeCompare(b.PARTY_CODE));

  return { asOfDate: f.asOfDate, rows, grandTotal };
}

export type PartyOpenItem = {
  VOUCHER_ID: number;
  VOUCHER_NO: string;
  VOUCHER_TYPE: string;
  VOUCHER_DATE: Date;
  DUE_DATE: Date;
  DAYS_OVERDUE: number;
  BUCKET: AgingBucket | "ADVANCE";
  AMOUNT: number; // negative for an advance parcel
  NARRATION: string | null;
};

export type PartyOpenItems = {
  party: PartyAgingOption & { CREDIT_DAYS: number };
  asOfDate: string;
  items: PartyOpenItem[];
  total: number;
};

export async function getPartyOpenItems(f: {
  companyId: number;
  partyId: number;
  asOfDate: string;
}): Promise<PartyOpenItems | null> {
  const parties = await query<PartyAgingOption & { CREDIT_DAYS: number }>(
    `SELECT party_id, party_code, party_name, is_customer, is_supplier, credit_days
       FROM party
      WHERE party_id = :partyId AND company_id = :companyId`,
    { partyId: f.partyId, companyId: f.companyId },
  );
  const party = parties[0];
  if (!party) return null;

  const rawRows = await fetchRows(f.companyId, f.asOfDate, undefined, f.partyId);
  const asOf = new Date(`${f.asOfDate}T00:00:00.000Z`);

  const fifoRows: FifoRow[] = rawRows.map((r) => ({
    date: fromOracleDate(r.VOUCHER_DATE),
    debit: r.DEBIT_AMT,
    credit: r.CREDIT_AMT,
    voucherId: r.VOUCHER_ID,
    voucherNo: r.VOUCHER_NO,
    voucherType: r.VOUCHER_TYPE,
    narration: r.NARRATION,
  }));
  const parcels = allocateFifo(fifoRows);

  const items: PartyOpenItem[] = parcels.map((p) => {
    if (p.amount < 0) {
      return {
        VOUCHER_ID: p.voucherId,
        VOUCHER_NO: p.voucherNo,
        VOUCHER_TYPE: p.voucherType,
        VOUCHER_DATE: p.date,
        DUE_DATE: p.date,
        DAYS_OVERDUE: 0,
        BUCKET: "ADVANCE",
        AMOUNT: p.amount,
        NARRATION: p.narration,
      };
    }
    const dueDate = addDays(p.date, party.CREDIT_DAYS);
    const daysOverdue = daysBetween(asOf, dueDate);
    return {
      VOUCHER_ID: p.voucherId,
      VOUCHER_NO: p.voucherNo,
      VOUCHER_TYPE: p.voucherType,
      VOUCHER_DATE: p.date,
      DUE_DATE: dueDate,
      DAYS_OVERDUE: daysOverdue,
      BUCKET: bucketFor(daysOverdue),
      AMOUNT: p.amount,
      NARRATION: p.narration,
    };
  });

  items.sort((a, b) => a.VOUCHER_DATE.getTime() - b.VOUCHER_DATE.getTime());
  const total = items.reduce((sum, i) => sum + i.AMOUNT, 0);

  return { party, asOfDate: f.asOfDate, items, total };
}
