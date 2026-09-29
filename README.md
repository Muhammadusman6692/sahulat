# Trading + POS + Distribution ERP — Phase 1 Foundation

Single new Oracle schema. Frontend: Next.js only (no APEX). Backend: Oracle
19c/23ai + PL/SQL packages, exposed to Next.js via ORDS REST.

## Files

| File | Contents |
|---|---|
| `sql/01_masters.sql` | company, branch, warehouse, COA (4-level), fiscal year/period, numbering series, app_user/role/permission/approval, party, item, item_price, tax master, audit_log |
| `sql/02_transactions.sql` | stock_ledger (costing table), stock_txn_sequence (posting-order table), sales_inv_hdr/line, sales_return_hdr/line, gl_voucher_hdr/line, intercompany_clearing_map, stock_transfer_hdr/line |
| `sql/03_pkg_security.sql` | `pkg_security` — permission matrix + company/branch/warehouse scope checks, called by every posting procedure |
| `sql/04_pkg_stock.sql` | `pkg_stock` — stock ledger writer + **Rule-1 weighted-average recost engine** (IN before OUT same date, global_seq tiebreak, back-date safe) |
| `sql/05_pkg_gl.sql` | `pkg_gl` — balanced double-entry voucher posting, period-lock aware |
| `sql/06_pkg_numbering_posting.sql` | `pkg_numbering` (incl. terminal-specific series) + `pkg_posting` (orchestrates stock + GL per document, e.g. `post_sales_invoice`, `post_sales_return`, `post_stock_transfer`) |
| `docs/03_ords_rest_contract.md` | Full REST endpoint list + JSON contracts Next.js will call |
| `docs/04_nextjs_structure.md` | Project folder structure, required packages, Windows Server deployment steps |

## Run order

```
01_masters.sql
02_transactions.sql
03_pkg_security.sql
04_pkg_stock.sql
05_pkg_gl.sql
06_pkg_numbering_posting.sql
```
(`06` references `pkg_numbering` and calls `pkg_gl`/`pkg_stock`/`pkg_security`, so it must run last.)

## Known gaps — intentionally left open, not guessed

1. **Default GL accounts per company** (which COA account is "Sales", "Output
   Tax", etc. for auto-posting) — needs a `company_default_account` config
   table, to be added when the Trading module is built, once your actual COA
   is finalized.
2. **PO / GRN / Purchase Invoice / Purchase Return DDL** — identical shape to
   `sales_inv_hdr/line` and `sales_return_hdr/line` in `02_transactions.sql`;
   not duplicated here to avoid a wall of repeated boilerplate — will be
   generated in the Trading-module phase.
3. **FBR/PRA/SRB submission payload schema** — must be confirmed against the
   authority's current developer documentation before building `/tax/submit`;
   the endpoint shape is defined, the payload is not guessed.
4. **Distribution route/scheme tables** (route, salesman assignment, trade
   schemes/slab discounts) — deferred to the Distribution-module phase per
   your step-by-step build order.

## Next step

Hand this folder to a Claude Code session against your actual Oracle instance
to: run the DDL, wire `company_default_account`, build out PO/GRN/Purchase
Invoice/Purchase Return tables, and scaffold the Next.js app per
`docs/04_nextjs_structure.md`.
