export type AccountLovOption = {
  id: number;
  code: string;
  name: string;
  controlType: "CUSTOMER" | "SUPPLIER" | "CASH" | "BANK" | null;
  parentName: string | null;
};

export function accountMainLabel(a: AccountLovOption): string {
  return `${a.code} - ${a.name}`;
}

/** Only a customer/supplier line carries this — it's the account's parent
 *  control head (Accounts Receivable / Accounts Payable) plus the party
 *  type, so the LOV reads clearly without a separate party field. */
export function accountSubLabel(a: AccountLovOption): string | null {
  if (a.controlType !== "CUSTOMER" && a.controlType !== "SUPPLIER") return null;
  const type = a.controlType === "CUSTOMER" ? "Customer" : "Supplier";
  return a.parentName ? `${a.parentName} · ${type}` : type;
}

export function accountFullLabel(a: AccountLovOption): string {
  const sub = accountSubLabel(a);
  return sub ? `${accountMainLabel(a)} (${sub})` : accountMainLabel(a);
}

export function matchesAccountQuery(a: AccountLovOption, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  return a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
}
