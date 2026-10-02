const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];

const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const CURRENCY_NAMES: Record<string, { unit: string; subunit: string }> = {
  PKR: { unit: "Rupees", subunit: "Paisa" },
  USD: { unit: "US Dollars", subunit: "Cents" },
  AED: { unit: "UAE Dirhams", subunit: "Fils" },
  SAR: { unit: "Saudi Riyals", subunit: "Halalas" },
  EUR: { unit: "Euros", subunit: "Cents" },
  GBP: { unit: "Pounds Sterling", subunit: "Pence" },
};

function threeDigitsToWords(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) {
    const tens = TENS[Math.floor(n / 10)];
    const one = ONES[n % 10];
    parts.push(one ? `${tens} ${one}` : tens);
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(" ");
}

/** Indian/Pakistani grouping (Crore, Lakh, Thousand) — the local accounting convention. */
function integerToWords(n: number): string {
  if (n === 0) return "Zero";

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const rest = n;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigitsToWords(crore)} Crore`);
  if (lakh) parts.push(`${threeDigitsToWords(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigitsToWords(thousand)} Thousand`);
  if (rest) parts.push(threeDigitsToWords(rest));
  return parts.join(" ");
}

/** "Rupees Fifty Thousand Only" style wording for a voucher amount. */
export function amountInWords(amount: number, currencyCode: string): string {
  const rounded = Math.round(Math.abs(amount) * 100) / 100;
  const whole = Math.floor(rounded);
  const fraction = Math.round((rounded - whole) * 100);
  const currency = CURRENCY_NAMES[currencyCode] ?? { unit: currencyCode, subunit: "Cents" };

  let words = `${currency.unit} ${integerToWords(whole)}`;
  if (fraction > 0) {
    words += ` and ${integerToWords(fraction)} ${currency.subunit}`;
  }
  return `${words} Only`;
}
