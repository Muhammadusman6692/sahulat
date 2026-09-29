/**
 * Turns an Oracle error into something a user can act on.
 *
 * Business rules raised by the packages use -20000 and below and already carry
 * a written message, so those are surfaced as-is once the "ORA-20123:" prefix
 * and the PL/SQL stack trailer are stripped.
 */
export function describeOracleError(e: unknown, fallback: string): string {
  const err = e as { errorNum?: number; message?: string };
  const num = err?.errorNum;
  const raw = err?.message ?? "";

  if (num === 1) {
    return "That code is already in use. Codes must be unique.";
  }
  if (num === 1400 || num === 1407) {
    return "A required field was left empty.";
  }
  if (num === 2291) {
    return "A referenced record no longer exists. Reload and try again.";
  }
  if (num === 2292) {
    return "This record is still referenced elsewhere, so it cannot be removed. Mark it inactive instead.";
  }
  if (num === 2290) {
    return "A value falls outside what this field allows.";
  }
  if (num === 12899) {
    return "A value is too long for its field.";
  }

  // Anything the PL/SQL packages raised deliberately.
  if (num && num <= -20000 && num > -21000) {
    const first = raw.split("\n")[0] ?? raw;
    return first.replace(/^ORA-\d+:\s*/, "").trim() || fallback;
  }

  return fallback;
}
