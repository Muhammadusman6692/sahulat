/**
 * The sidebar. Each item names the module_code that governs it, so the menu is
 * built from the same permission rows pkg_security checks. An item with no
 * module is always shown.
 */
export type NavItem = {
  label: string;
  href: string;
  module?: string;
};

export type NavGroup = {
  label?: string;
  items: NavItem[];
};

export const NAV: NavGroup[] = [
  {
    items: [{ label: "Dashboard", href: "/dashboard" }],
  },
  {
    label: "TRADING",
    items: [
      { label: "Sales Invoices", href: "/sales/invoices", module: "SALES_INVOICE" },
      { label: "Sales Returns", href: "/sales/returns", module: "SALES_RETURN" },
      { label: "Purchase Orders", href: "/purchase/orders", module: "PURCHASE_ORDER" },
      { label: "Goods Receipts", href: "/purchase/grn", module: "GRN" },
      { label: "Stock Transfers", href: "/stock/transfers", module: "STOCK_TRANSFER" },
    ],
  },
  {
    label: "ACCOUNTING",
    items: [
      { label: "Vouchers", href: "/accounting/vouchers", module: "GL_VOUCHER" },
      { label: "Trial Balance", href: "/accounting/trial-balance", module: "GL_VOUCHER" },
    ],
  },
  {
    label: "ADMIN",
    items: [
      { label: "Chart of Accounts", href: "/admin/coa", module: "COA_MAINT" },
      { label: "Items", href: "/admin/items", module: "ITEM_MAINT" },
      { label: "Parties", href: "/admin/parties", module: "PARTY_MAINT" },
      { label: "Tax Master", href: "/admin/tax", module: "TAX_MAINT" },
      { label: "Users", href: "/admin/users", module: "USER_MAINT" },
      { label: "Roles & Permissions", href: "/admin/roles", module: "ROLE_MAINT" },
    ],
  },
];
