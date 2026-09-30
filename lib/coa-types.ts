// Plain types and constants shared between server (lib/db/coa.ts) and client
// (the COA form) code. Nothing here touches the database, so — unlike
// lib/db/coa.ts — it carries no "server-only" guard and is safe to import
// from a client component.

export type AccountNature = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
export type NormalSide = "D" | "C";
export type ControlType = "CUSTOMER" | "SUPPLIER" | "CASH" | "BANK" | null;

/** Nature -> conventional normal side, offered as a default the form can
 *  override (a contra account like Accumulated Depreciation is ASSET nature
 *  but carries a credit balance). */
export const CONVENTIONAL_SIDE: Record<AccountNature, NormalSide> = {
  ASSET: "D",
  EXPENSE: "D",
  LIABILITY: "C",
  EQUITY: "C",
  INCOME: "C",
};
