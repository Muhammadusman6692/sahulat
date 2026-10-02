export type PartyLovOption = {
  id: number;
  code: string;
  name: string;
  isCustomer: "Y" | "N";
  isSupplier: "Y" | "N";
};

export function partyMainLabel(p: PartyLovOption): string {
  return `${p.code} - ${p.name}`;
}

export function partySubLabel(p: PartyLovOption): string | null {
  if (p.isCustomer === "Y" && p.isSupplier === "Y") return "Customer & Supplier";
  if (p.isCustomer === "Y") return "Customer";
  if (p.isSupplier === "Y") return "Supplier";
  return null;
}

export function matchesPartyQuery(p: PartyLovOption, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  return p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
}
