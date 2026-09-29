# ORDS REST API Contract — Phase 1

Base path convention: `https://<host>/ords/<schema>/api/v1/...`
Every endpoint (except `/auth/login`) requires header `Authorization: Bearer <JWT>`.
JWT is issued by Next.js (NextAuth Credentials Provider) after verifying `app_user`
via a dedicated auth endpoint — password hashing/verification happens in Node
(bcrypt), never in PL/SQL.

Every write endpoint's PL/SQL handler calls `pkg_security.check_permission` and
`pkg_security.check_scope` before touching data — this is enforced **even if**
Next.js middleware already blocked the button, per your "enforce in both layers"
decision.

---

## Conventions

- All write bodies are JSON. All responses are JSON.
- `company_id`, `branch_id`, `warehouse_id` are required on every transactional
  call (the JWT carries the user's *allowed* scope; the request carries the
  *active* selection the frontend is currently working in — API validates the
  requested scope is within the token's allowed scope).
- Money fields: `NUMBER(18,2)`. Quantity fields: `NUMBER(18,4)` (decimal qty allowed).
- Errors: `{ "error_code": "ORA-20202", "message": "..." }`, HTTP 400/403/409 as appropriate.
  `403` = permission/scope denial (`pkg_security`). `409` = business rule violation
  (negative stock, unbalanced voucher, closed period).
- Idempotency: any POS/offline-originated write includes `offline_uuid` in the
  body. The handler does `MERGE`/`UPSERT` semantics — replaying the same UUID
  after a sync retry is a no-op, not a duplicate.

---

## Auth

### `POST /auth/login`
Request: `{ "username": "...", "password": "..." }`
Response: `{ "user_id": 1, "full_name": "...", "roles": [...], "permissions": {...}, "access": [{company_id, branch_id, warehouse_id}, ...] }`
(Node verifies bcrypt hash against `app_user.password_hash`, issues JWT.)

### `GET /auth/me`
Returns current session's user profile + permission matrix + scope — used by
Next.js middleware to build client-side show/hide state on load.

---

## Masters (CRUD pattern — shown once, applies to company/branch/warehouse/coa/party/item/tax_master/uom/item_category/item_brand)

### `GET /masters/{resource}` — list, supports `?company_id=&branch_id=&q=&page=&size=`
### `GET /masters/{resource}/{id}` — single record
### `POST /masters/{resource}` — create (checks `{MODULE}_MAINT` CREATE permission)
### `PUT /masters/{resource}/{id}` — update (checks EDIT permission)
### `DELETE /masters/{resource}/{id}` — soft delete only (`active_yn='N'`), never hard delete

Resource-specific notes:
- `/masters/coa` — `POST` validates `account_level = parent.account_level + 1` (mirrors the DB trigger; DB is still the source of truth).
- `/masters/item` — `POST`/`PUT` requires a paired `item_price` entry (`sale_price`, `effective_from`) in the same call body; the handler writes both in one transaction.
- `/masters/party` — single endpoint; `is_customer`/`is_supplier` flags control which panels the Next.js form shows.

---

## Financial Year / Period

### `GET /fiscal/years?company_id=`
### `POST /fiscal/years` — creates FY + 12 periods in one call
### `PATCH /fiscal/periods/{period_id}` — `{ "status": "CLOSED" }` (requires `PERIOD_CLOSE` APPROVE permission)

---

## Roles & Permissions

### `GET /admin/roles?company_id=`
### `POST /admin/roles`
### `GET /admin/roles/{role_id}/permissions` — returns full matrix rows
### `PUT /admin/roles/{role_id}/permissions` — bulk replace matrix for that role
### `POST /admin/users/{user_id}/roles` — `{ "role_id": n }`
### `POST /admin/users/{user_id}/access` — `{ "company_id","branch_id","warehouse_id" }`

---

## Sales Invoice (Trading channel — POS/Distribution reuse the same shape with `channel` set)

### `POST /sales/invoices` — create DRAFT
Body:
```json
{
  "company_id": 1, "branch_id": 1, "warehouse_id": 1,
  "party_id": 55, "inv_date": "2026-09-29", "channel": "TRADING",
  "offline_uuid": null,
  "lines": [
    { "item_id": 101, "qty": 5, "rate": 250.0000, "discount_amt": 0, "tax_id": 3 }
  ]
}
```
Response: `{ "inv_id": 9001, "inv_no": null, "status": "DRAFT" }` (number assigned only on post)

### `POST /sales/invoices/{inv_id}/post`
Runs `pkg_posting.post_sales_invoice`. Response: `{ "inv_id":9001, "inv_no":"SINV-000123", "status":"POSTED" }`
On failure: `409` with the raised `ORA-20xxx` message (e.g. negative stock, permission denied, closed period).

### `POST /sales/invoices/{inv_id}/cancel`

### `GET /sales/invoices?company_id=&branch_id=&from_date=&to_date=&party_id=&status=`

### `POST /sales/returns` / `POST /sales/returns/{ret_id}/post`
Body requires `orig_inv_id` and, per line, `orig_line_id` — the API rejects a
return line with no `orig_line_id` (enforces your "return = original document
cost" rule at the API boundary, before it even reaches PL/SQL).

---

## POS (offline-capable — Next.js PWA + IndexedDB queue syncs to these)

### `POST /pos/shift/open` — `{ "terminal_id": 5, "opening_cash": 5000 }`
### `POST /pos/shift/close` — `{ "shift_id": n, "closing_cash": ..., "counted_denominations": {...} }` → generates Z-report
### `POST /pos/sale` — same shape as `/sales/invoices` + `/post` combined into one atomic call (POS never leaves a DRAFT sitting), **requires `offline_uuid`**, uses the terminal's own numbering series (`numbering_series.terminal_id`)
### `POST /pos/sale/batch-sync` — array of queued offline sales, each with its own `offline_uuid`; processes each independently, returns per-item success/failure so the PWA knows which to drop from its local queue and which to retry

---

## Distribution

### `GET /dist/routes?company_id=&branch_id=`
### `GET /dist/routes/{route_id}/outlets`
### `POST /dist/orders` — order booking by salesman, offline-capable, `offline_uuid` required
### `POST /dist/orders/{order_id}/dispatch`
### `POST /dist/delivery` — delivery confirmation, updates stock (OUT at warehouse) — offline-capable
### `POST /dist/recovery` — cash/cheque collection against outlet outstanding, offline-capable

---

## Stock

### `GET /stock/on-hand?item_id=&warehouse_id=` → `{ "qty": ..., "avg_cost": ... }` (calls `pkg_stock.get_on_hand_qty` / `get_current_avg_cost`)
### `GET /stock/ledger?item_id=&warehouse_id=&from_date=&to_date=` — full costed ledger for stock-card report
### `POST /stock/transfers` / `POST /stock/transfers/{id}/post`

---

## Reports (printable view / PDF / Excel — per your confirmed requirement)

### `GET /reports/{report_code}?...&format=html|pdf|xlsx`
`format=html` returns server-rendered data for the Next.js printable view page
(browser handles `window.print()` for A4/thermal — no silent printing in Phase 1).
`format=pdf` streams a Puppeteer-rendered PDF. `format=xlsx` streams an exceljs
workbook. Report codes: `party_ledger`, `stock_card`, `trial_balance`,
`profit_loss`, `balance_sheet`, `sales_register`, `pos_z_report`,
`route_settlement`.

---

## Tax Authority Integration (FBR/PRA/SRB)

### `POST /tax/submit/{doc_type}/{doc_id}` — submits a posted sales invoice to
the configured authority, writes `tax_authority_submission` row, returns the
authority's invoice reference number + QR payload for printing on the receipt.
**Exact request/response schema depends on the specific FBR/PRA/SRB digital
invoicing API version in force at build time — this must be confirmed against
current FBR/PRA/SRB developer documentation before implementation; I have not
guessed a schema here.**
