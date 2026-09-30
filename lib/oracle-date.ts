/**
 * node-oracledb returns DATE columns as JS Date objects whose LOCAL calendar
 * components (year/month/day) match the value stored in Oracle — not its UTC
 * components. Reading such a value with getUTC*() can land on the wrong day
 * whenever the process runs outside UTC (this machine is UTC+5).
 *
 * This rebuilds the same calendar date as a UTC-midnight Date, so it mixes
 * safely with dates parsed from a plain "YYYY-MM-DD" string — which JS already
 * parses as UTC midnight — instead of two different timezone conventions
 * silently disagreeing by a few hours and landing on different days once
 * formatted.
 */
export function fromOracleDate(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}
