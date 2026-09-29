const money = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const rate = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

const qty = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

/** Amounts: NUMBER(18,2). */
export function fmtMoney(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : money.format(n);
}

/** Unit rates and costs: NUMBER(18,4). */
export function fmtRate(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : rate.format(n);
}

/** Quantities: NUMBER(18,4), shown to three places as the UI convention. */
export function fmtQty(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : qty.format(n);
}
