import type { NewPeriod } from "@/lib/db/fiscal";

/** Day after 30 Jun 2026 is 1 Jul 2026 — plain calendar math, no timezone
 *  involved since every date here is a pure calendar date. */
function addDays(d: Date, days: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days));
}

function addMonths(d: Date, months: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()));
}

/** Last calendar day of the month containing d. */
function endOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}

/**
 * The 12 monthly periods of a fiscal year starting on startDate, matching the
 * ADD_MONTHS/LAST_DAY pattern the dev seed already uses in SQL. Period 1 runs
 * from startDate to the end of that same month; the year's own end_date is the
 * caller's concern (start + 1 year − 1 day), kept separate so an irregular
 * first fiscal year is still just twelve regular months from its own start.
 */
export function buildPeriods(startDate: Date): NewPeriod[] {
  const periods: NewPeriod[] = [];
  for (let i = 0; i < 12; i++) {
    const periodStart = i === 0 ? startDate : addMonths(startOfMonth(startDate), i);
    periods.push({
      periodNo: i + 1,
      startDate: periodStart,
      endDate: endOfMonth(periodStart),
    });
  }
  return periods;
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** One calendar year minus a day, e.g. 1 Jul 2026 → 30 Jun 2027. */
export function fiscalYearEnd(startDate: Date): Date {
  return addDays(addMonths(startDate, 12), -1);
}

/**
 * Where the next fiscal year should start: the day after the latest existing
 * one ends, or the company's configured fy_start_month in the current (or
 * next, if that month has already passed) calendar year when none exist yet.
 */
export function suggestNextStart(
  existing: { startDate: Date; endDate: Date }[],
  fyStartMonth: number,
  today: Date = new Date(),
): Date {
  if (existing.length > 0) {
    const latestEnd = existing.reduce(
      (max, fy) => (fy.endDate > max ? fy.endDate : max),
      existing[0].endDate,
    );
    return addDays(latestEnd, 1);
  }

  const monthIndex = fyStartMonth - 1; // Date months are 0-based
  const candidate = new Date(Date.UTC(today.getUTCFullYear(), monthIndex, 1));
  if (candidate <= today) {
    return new Date(Date.UTC(today.getUTCFullYear() + 1, monthIndex, 1));
  }
  return candidate;
}

/** "FY2026-27" from a start date, matching the seed data's own naming. */
export function suggestFyName(startDate: Date): string {
  const y1 = startDate.getUTCFullYear();
  const y2 = (y1 + 1) % 100;
  return `FY${y1}-${String(y2).padStart(2, "0")}`;
}

/** True when [aStart, aEnd] and [bStart, bEnd] share any day. */
export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}
