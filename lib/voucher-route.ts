const VOUCHER_BASE_ROUTE: Record<string, string> = {
  JV: "/admin/journal-vouchers",
  CPV: "/admin/cash-vouchers",
  CRV: "/admin/cash-vouchers",
  BPV: "/admin/bank-vouchers",
  BRV: "/admin/bank-vouchers",
};

/** Where a gl_voucher_hdr.voucher_type's own detail page lives, for ledger
 *  drill-down links. Null for a voucher_type with no admin detail page yet. */
export function voucherDetailHref(voucherType: string, voucherId: number): string | null {
  const base = VOUCHER_BASE_ROUTE[voucherType];
  return base ? `${base}/${voucherId}` : null;
}
