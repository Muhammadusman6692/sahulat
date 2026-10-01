import type { ModuleType } from "@/lib/db/menu";

type Shape =
  | { tag: "path"; d: string }
  | { tag: "circle"; cx: number; cy: number; r: number }
  | { tag: "rect"; x: number; y: number; w: number; h: number; rx?: number };

const p = (d: string): Shape => ({ tag: "path", d });
const c = (cx: number, cy: number, r: number): Shape => ({ tag: "circle", cx, cy, r });
const rc = (x: number, y: number, w: number, h: number, rx = 0): Shape => ({
  tag: "rect",
  x,
  y,
  w,
  h,
  rx,
});

/**
 * One shape set per concept, shared across modules that mean the same kind
 * of thing (every voucher/invoice uses "fileText", every "return" document
 * uses "cornerUpLeft") rather than a bespoke icon per module code.
 */
const ICONS: Record<string, Shape[]> = {
  building: [
    p("M5 21V4a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v17"),
    p("M4 21h18"),
    p("M14 21v-4h3v4"),
  ],
  mapPin: [p("M12 21s7-7.5 7-12a7 7 0 1 0-14 0c0 4.5 7 12 7 12z"), c(12, 9, 2.5)],
  box: [p("M21 8l-9-5-9 5 9 5 9-5z"), p("M3 8v8l9 5 9-5V8"), p("M12 13v8")],
  calendar: [rc(3, 5, 18, 16, 2), p("M3 10h18"), p("M8 3v4"), p("M16 3v4")],
  list: [
    p("M8 6h13"),
    p("M8 12h13"),
    p("M8 18h13"),
    p("M3 6h.01"),
    p("M3 12h.01"),
    p("M3 18h.01"),
  ],
  sliders: [
    p("M4 21v-7"),
    p("M4 10V3"),
    p("M12 21v-9"),
    p("M12 8V3"),
    p("M20 21v-5"),
    p("M20 12V3"),
    c(4, 12, 2),
    c(12, 10, 2),
    c(20, 14, 2),
  ],
  hash: [p("M5 9h14"), p("M5 15h14"), p("M11 4L7 20"), p("M17 4l-4 16")],
  users: [
    c(9, 8, 3.2),
    p("M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5"),
    c(17, 9, 2.6),
    p("M15.5 14.2c2.2.5 3.8 2.4 3.8 5"),
  ],
  shield: [p("M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z")],
  checkCircle: [c(12, 12, 9), p("M8.5 12.5l2.3 2.3L16 9.5")],
  percent: [c(7, 7, 2.3), c(17, 17, 2.3), p("M18 6L6 18")],
  ruler: [
    p("M3 17L17 3l4 4L7 21l-4-4z"),
    p("M7.5 12.5l2 2"),
    p("M11 9l2 2"),
    p("M14.5 5.5l2 2"),
  ],
  tag: [p("M3 11.5V5a1 1 0 0 1 1-1h6.5L20 12.5 12.5 20 3 11.5z"), c(7.3, 7.3, 1.3)],
  award: [c(12, 8, 5), p("M8.5 12.5L7 21l5-3 5 3-1.5-8.5")],
  userCheck: [
    c(9, 8, 3.5),
    p("M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"),
    p("M16 11l1.7 1.7L21 9"),
  ],
  inbox: [
    p("M4 12h4l2 3h4l2-3h4"),
    p("M4 12V6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6"),
    p("M4 12v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6"),
  ],
  fileText: [
    p("M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"),
    p("M14 3v4h4"),
    p("M9 13h6"),
    p("M9 17h6"),
  ],
  wallet: [
    p("M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"),
    p("M16 12h3"),
  ],
  landmark: [
    p("M3 21h18"),
    p("M4 21V10"),
    p("M20 21V10"),
    p("M2 10l10-6 10 6"),
    p("M8 21v-7"),
    p("M16 21v-7"),
  ],
  lock: [rc(5, 11, 14, 10, 2), p("M8 11V7a4 4 0 0 1 8 0v4")],
  bookOpen: [
    p(
      "M3 5.5C5 4 8 4 12 5.5C16 4 19 4 21 5.5V18C19 16.5 16 16.5 12 18C8 16.5 5 16.5 3 18V5.5z",
    ),
    p("M12 5.5V18"),
  ],
  scale: [
    p("M12 3v18"),
    p("M5 7h14"),
    p("M5 7l-3 6a3 3 0 0 0 6 0L5 7z"),
    p("M19 7l-3 6a3 3 0 0 0 6 0L19 7z"),
  ],
  trendingUp: [p("M3 17l6-6 4 4 7-8"), p("M15 6h5v5")],
  layout: [rc(3, 4, 18, 16, 2), p("M3 10h18"), p("M9 10v10")],
  clock: [c(12, 12, 9), p("M12 7v5l3.5 2")],
  shoppingCart: [
    c(9, 20, 1.4),
    c(18, 20, 1.4),
    p("M2.5 3h3l2.6 12.5a2 2 0 0 0 2 1.6h8a2 2 0 0 0 2-1.6L22 8H6.2"),
  ],
  truck: [
    rc(2, 7, 12, 10, 1),
    p("M14 10h4l4 4v3h-8v-7z"),
    c(7, 19, 1.8),
    c(18, 19, 1.8),
  ],
  cornerUpLeft: [p("M9 14l-5-5 5-5"), p("M4 9h11a5 5 0 0 1 5 5v6")],
  clipboard: [
    rc(6, 4, 12, 17, 1.5),
    rc(9, 2.5, 6, 3, 1),
    p("M9 11h6"),
    p("M9 15h6"),
  ],
  packageCheck: [
    p("M21 8l-9-5-9 5 9 5 9-5z"),
    p("M3 8v8l9 5 9-5V8"),
    p("M12 13v8"),
    p("M8 12.5l1.8 1.8L14 10"),
  ],
  shuffle: [
    p("M3 6h3.5l9 12H20"),
    p("M16 4l4 2-4 2"),
    p("M3 18h3.5l2.2-3"),
    p("M14 7l1.3-1.8"),
    p("M16 20l4-2-4-2"),
  ],
  alertTriangle: [
    p("M12 3.5L2.5 20h19L12 3.5z"),
    p("M12 10v4"),
    p("M12 17.5h.01"),
  ],
  monitor: [rc(3, 4, 18, 13, 1.5), p("M8 21h8"), p("M12 17v4")],
  play: [p("M7 4.5v15l12-7.5z")],
  shoppingBag: [
    p("M6 8h12l1 12.5a1 1 0 0 1-1 1.5H6a1 1 0 0 1-1-1.5L6 8z"),
    p("M8 8V6a4 4 0 0 1 8 0v2"),
  ],
  square: [rc(5, 5, 14, 14, 2)],
  refreshCw: [
    p("M21 9A9 9 0 0 0 5.6 5.6L3 8"),
    p("M3 15a9 9 0 0 0 15.4 3.4L21 16"),
    p("M3 4v4h4"),
    p("M21 20v-4h-4"),
  ],
  map: [
    p("M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"),
    p("M9 4v14"),
    p("M15 6v14"),
  ],
  store: [
    p("M4 9l1-5h14l1 5"),
    p("M4 9v11h16V9"),
    p("M4 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"),
  ],
  checkSquare: [rc(3, 3, 18, 18, 2), p("M8 12l2.5 2.5L16 9")],
  dollarSign: [
    p("M12 2v20"),
    p(
      "M17 6.5c0-1.9-2.2-3-5-3s-5 1.1-5 2.8c0 1.6 1.7 2.3 5 3s5 1.4 5 3S14.8 15.5 12 15.5s-5-1.1-5-3",
    ),
  ],
  send: [p("M3 11l18-8-8 18-2.5-7.5L3 11z")],
  barChart2: [p("M5 21V10"), p("M12 21V3"), p("M19 21v-7")],
  grid: [rc(3, 3, 7, 7), rc(14, 3, 7, 7), rc(3, 14, 7, 7), rc(14, 14, 7, 7)],
  filePlus: [
    p("M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"),
    p("M14 3v4h4"),
    p("M12 12v6"),
    p("M9 15h6"),
  ],
};

/** module_code -> icon key, covering every row module_function seeds. */
export const MODULE_ICON: Record<string, keyof typeof ICONS> = {
  COMPANY_MAINT: "building",
  BRANCH_MAINT: "mapPin",
  WAREHOUSE_MAINT: "box",
  FISCAL_MAINT: "calendar",
  COA_MAINT: "list",
  DEFAULT_ACCT_MAINT: "sliders",
  NUMBERING_MAINT: "hash",
  USER_MAINT: "users",
  ROLE_MAINT: "shield",
  APPROVAL_MAINT: "checkCircle",
  PENDING_APPROVALS: "inbox",
  TAX_MAINT: "percent",
  UOM_MAINT: "ruler",
  ITEM_CAT_MAINT: "tag",
  ITEM_BRAND_MAINT: "award",
  ITEM_MAINT: "box",
  PARTY_MAINT: "userCheck",

  JV_ENTRY: "fileText",
  CASH_VOUCHER: "wallet",
  BANK_VOUCHER: "landmark",
  PERIOD_CLOSE: "lock",
  GL_REPORT: "bookOpen",
  TRIAL_BALANCE: "scale",
  PROFIT_LOSS: "trendingUp",
  BALANCE_SHEET: "layout",
  PARTY_LEDGER: "bookOpen",
  AGING_REPORT: "clock",

  QUOTATION: "fileText",
  SALES_ORDER: "shoppingCart",
  DELIVERY_NOTE: "truck",
  SALES_INVOICE: "fileText",
  SALES_RETURN: "cornerUpLeft",
  PURCHASE_ORDER: "clipboard",
  GRN: "packageCheck",
  PURCHASE_INVOICE: "fileText",
  PURCHASE_RETURN: "cornerUpLeft",
  STOCK_TRANSFER: "shuffle",
  STOCK_ADJUSTMENT: "sliders",
  STOCK_LEDGER_RPT: "bookOpen",
  REORDER_RPT: "alertTriangle",

  POS_TERMINAL_MAINT: "monitor",
  POS_SHIFT_OPEN: "play",
  POS_SALE: "shoppingBag",
  POS_SHIFT_CLOSE: "square",
  POS_RETURN: "cornerUpLeft",
  POS_SYNC_STATUS: "refreshCw",

  DIST_ROUTE_MAINT: "map",
  DIST_SALESMAN_MAINT: "users",
  DIST_OUTLET_MAINT: "store",
  DIST_SCHEME_MAINT: "percent",
  DIST_ORDER: "clipboard",
  DIST_DISPATCH: "truck",
  DIST_DELIVERY: "checkSquare",
  DIST_RECOVERY: "dollarSign",
  DIST_SETTLEMENT: "checkSquare",
  DIST_SYNC_STATUS: "refreshCw",

  TAX_SUBMISSION_LOG: "send",

  RPT_SALES_REGISTER: "barChart2",
  RPT_PURCHASE_REGISTER: "barChart2",
  RPT_STOCK_VALUATION: "trendingUp",
  RPT_POS_ZREPORT: "fileText",
  RPT_ROUTE_SETTLEMENT: "map",
};

export const SECTION_ICON: Record<ModuleType, keyof typeof ICONS> = {
  SETUP: "grid",
  TRANSACTION: "filePlus",
  REPORT: "barChart2",
};

const FALLBACK: Shape[] = ICONS.fileText;

export function ModuleIcon({
  icon,
  className,
}: {
  icon: string | undefined;
  className?: string;
}) {
  const shapes = (icon && ICONS[icon]) || FALLBACK;
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {shapes.map((s, i) => {
        if (s.tag === "path") return <path key={i} d={s.d} />;
        if (s.tag === "circle") return <circle key={i} cx={s.cx} cy={s.cy} r={s.r} />;
        return <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} />;
      })}
    </svg>
  );
}
