# Cash Payment / Receipt Voucher — Spec

`module_code = CASH_VOUCHER` ("Cash Payment/Receipt", group `ACCOUNTING`), already seeded as
`PENDING` in `module_function` (`sql/10_module_build_status.sql`). Covers **CPV** (Cash Payment
Voucher) and **CRV** (Cash Receipt Voucher) only — bank-side payment/receipt is the separate
`BANK_VOUCHER` module and is out of scope here.

This is a design doc for sign-off before any code is written, per usual — review the mockups in
§5 and the open decisions in §7 before I start building.

## 1. What it is

A cash voucher has one fixed leg (a cash-in-hand account) and one or more free legs (expense,
income, or a customer/supplier control account). It is the same generic double-entry the Journal
Voucher already posts — **no new tables, no new PL/SQL package**. `gl_voucher_hdr.voucher_type`
already allows `CPV`/`CRV` (`sql/02_transactions.sql:152`), and `coa.is_control_ac` already has a
`'CASH'` value (`sql/01_masters.sql:70`) to identify the fixed leg. `pkg_gl` (create_voucher /
add_line / post_voucher / cancel_voucher) is reused exactly as JV uses it.

| | Cash Payment (CPV) | Cash Receipt (CRV) |
|---|---|---|
| Cash account | **Credit** | **Debit** |
| Free leg(s) | Debit (expense, or a Supplier/Customer control account) | Credit (income, or a Customer/Supplier control account) |
| Typical case | Paying an expense, paying a supplier in cash | Cash sale, a customer paying in cash |

## 2. Data model — no schema change

Reuses exactly what JV uses:

- `gl_voucher_hdr` — `voucher_type = 'CPV'` or `'CRV'`, same DRAFT/POSTED/CANCELLED lifecycle,
  same `period_id` / fiscal-period-closed check in `pkg_gl.create_voucher`.
- `gl_voucher_line` — one row for the cash leg, one or more rows for the free legs. Same
  `CHECK (debit>0 XOR credit>0)` per line that JV already relies on.
- `party_id` on a free leg is derived from the account the same way JV derives it today
  (`getPartyIdsByLedgerCoaIds` in `lib/db/parties.ts`) — **never a manual party field**, per the
  LOV-not-manual-entry rule already in force for JV.

**Setup required before this ships** (admin task, not code): a `numbering_series` row per branch
for `doc_type = 'CPV'` and another for `'CRV'`, same as the existing `'JV'` rows — `pkg_numbering.
get_next_number` already looks these up by `(company_id, branch_id, doc_type)`, nothing to build.

## 3. Business rules

1. **Cash account is restricted to `is_control_ac = 'CASH'`.** The account-combobox the voucher
   form uses already carries `controlType` (`components/form/account-lov.ts`) — filter to `CASH`
   for this one field. If a company has more than one cash account (e.g. Petty Cash vs Main
   Cash), the user picks explicitly; no silent default.
2. **Free legs may be any postable account except a `CASH` or `BANK` control account.** Picking
   another cash/bank account here would be a contra entry (cash↔bank or cash↔cash transfer), which
   is explicitly out of scope (§7) — the free-leg combobox filters those two control types out.
3. **Party is automatic, never typed.** A free leg coded to a Customer/Supplier control account
   pulls its party from the account exactly like JV does; an ordinary expense/income account
   carries no party.
4. **Balance rule**: sum of free-leg amounts = cash-leg amount. Enforced client-side (buttons
   disabled until balanced, like JV) and server-side inside `pkg_gl.post_voucher`, which already
   rejects `debit_total != credit_total`.
5. **Cash account, branch, voucher date, and voucher type are locked once the voucher is
   created** — same rule JV already applies to branch/date ("changing them means starting a new
   voucher"). Only narration and the free-leg lines can change while the voucher is a DRAFT.
6. Post / Cancel reuse `pkg_gl.post_voucher` / `pkg_gl.cancel_voucher` unchanged. Cancel requires
   a reason, same modal JV already has in `voucher-actions.tsx`.
7. A DRAFT voucher can be deleted outright (hard delete, nothing posted yet) — same as JV.

## 4. Screens

Route group: `app/(admin)/admin/cash-vouchers/` (mirrors where `journal-vouchers` actually landed,
not the Phase-1 plan's `(trading)/accounting/vouchers/`).

| File | Role |
|---|---|
| `page.tsx` | List, both CPV and CRV, with a Type filter |
| `cv-filters.tsx` | Branch / Status / Type / search / date-range filter bar |
| `cv-form.tsx` | Create/edit form (cash leg + free-leg grid) |
| `new/page.tsx` | Create — `?type=CPV` or `?type=CRV` |
| `[voucherId]/page.tsx` | Edit (DRAFT) or read-only view (POSTED/CANCELLED) |
| `voucher-actions.tsx` | Post / Delete-draft / Cancel-with-reason — identical shape to JV's |
| `actions.ts` | Server actions — `createDraftAction`, `updateDraftAction`, `postDraftAction`, `cancelPostedAction`, `deleteDraftAction` |

**List page** — same shape as Journal Vouchers list (`listJournalVouchers` pattern), plus a Type
column/filter:

- Columns: Voucher No · Date · Branch · Type (Payment/Receipt badge) · Cash Account · Party or
  Narration · Amount · Status · Created By
- Filters: Branch, Status, **Type** (All / Payment / Receipt), search (voucher no / narration),
  date range
- Two create buttons in the header — **"+ Cash Payment"** and **"+ Cash Receipt"** — each routes
  to `new?type=CPV` / `new?type=CRV` rather than a type dropdown on one shared button, since the
  type can't change after creation anyway (rule 5).

**Create/Edit form** — same card layout as `jv-form.tsx`:

- Header card: Company (locked), Branch (select on create / locked on edit), Voucher date
  (date input on create / locked on edit), Voucher No (locked, "Assigned on save"), **Cash
  Account** (searchable combobox, filtered to `controlType === 'CASH'`, locked on edit),
  Narration (header-level, required).
- Lines grid (free legs): Account (combobox excluding CASH/BANK), Line narration, Amount. Add
  line / remove line, minimum 1 line. No separate Debit/Credit columns here — the form already
  knows which side each row lands on from the voucher type, so it only asks for one Amount per
  row (simpler than JV's grid, since only one side is free).
- Footer: running total of the free legs vs. the fixed cash amount, a Balanced/Out-of-balance pill
  (same visual language as JV's), Save as draft / Save & Post buttons disabled until balanced.
- Narration a locked field. Every locked field shows the lock icon, not just a greyed box, same as
  the rest of the app.

**View page (POSTED/CANCELLED)** — same shape as JV's detail view: header grid (Branch, Voucher
date, Cash account, Created by, Posted by), then a lines table (Account · Party · Narration ·
Debit · Credit), with a total row. `VoucherActions` component reused as-is (it's already generic
over status/mayEdit/mayPost/mayCancel).

## 5. Mockups

**List** (filters row adds a Type segmented control next to Status):

```
Cash Payment / Receipt                           [+ Cash Payment]  [+ Cash Receipt]
Record cash paid out or received over the counter.

[Branch ▾] [Status ▾] [Type: All|Payment|Receipt] [Search…] [From] [To]      42 vouchers

Voucher No    Date         Branch     Type      Cash Account        Party/Narration        Amount      Status    Created By
CPV-000031    01-Oct-2026  Head Off.  Payment   1-01-001 Main Cash   Office rent — Sep      45,000.00   DRAFT     Usman
CRV-000028    30-Sep-2026  Head Off.  Receipt   1-01-001 Main Cash   ABC Traders (Customer) 120,500.00  POSTED    Usman
...
```

**Create — Cash Payment** (`new?type=CPV`):

```
‹ Cash Payment / Receipt
New Cash Payment Voucher

┌ Header ─────────────────────────────────────────────────────────┐
│ Company        🔒 JTC — John Traders Co.                         │
│ Branch *       [Head Office ▾]                                   │
│ Voucher date * [2026-10-01]          Must fall in an open period │
│ Voucher no.    🔒 Assigned on save                                │
│ Cash account * [🔎 1-01-001 Main Cash                    ▾]       │
│ Narration *    [________________________________________]        │
└────────────────────────────────────────────────────────────────┘

┌ Lines (debited — paid for) ───────────────────────────────────────┐
│ #  Account *                     Line narration          Amount  │
│ 1  [🔎 5-04-003 Office Rent  ▾]  [Sep rent]               45,000  │
│ 2  [🔎 2-01-004-00012 ABC Tra▾]  [Advance against Oct PO] 20,000  │  <- Supplier control a/c
│                                                                    │
│ [+ Add line]   A Customer/Supplier account carries its own ledger │
│                account — party is picked up automatically.        │
├────────────────────────────────────────────────────────────────┤
│  ✓ Balanced                              Cash account (Cr)  65,000│
└────────────────────────────────────────────────────────────────┘

[Cancel]                                   [Save as draft]  [Save & Post]
```

Cash Receipt mirrors this with "Lines (credited — received for)" and the pill labelled
`Cash account (Dr)`.

## 6. Permissions

Same five actions as JV, under `module_code = 'CASH_VOUCHER'`: `VIEW`, `CREATE`, `EDIT`, `POST`,
`CANCEL`. No new permission infrastructure — `pkg_security.has_permission` and the
`role_permission` matrix already handle any `module_code`; this just needs the Roles & Permissions
screen to show the existing `CASH_VOUCHER` row (it already lists every `module_function` row).

## 7. Open decisions to confirm before I build

1. **Contra (cash↔bank) is out of scope.** Depositing cash into the bank, or cashing a cheque,
   stays out of both this module and `BANK_VOUCHER` for now — flag if you want a Contra Voucher
   type added to the plan.
2. **No default cash account per branch.** `company_default_account` currently only has
   `SALES`/`OUTPUT_TAX`/`SALES_RETURN` roles; I'm not adding a `CASH` default-account role to
   auto-select the cash account, so the user always picks it explicitly. Say so if you'd rather
   pre-select it per branch.
3. **Multiple free legs per voucher** (splitting one cash payment across several expense heads) —
   assumed yes, matching JV's multi-line grid. Say so if you want it locked to a single line for
   simplicity.

## 8. Completion bar

Matches the standing rule: COMPLETED means list + create (draft and Save & Post) + edit-draft +
post + cancel all exercised against the real Oracle schema, for both CPV and CRV, before the
`module_function` row flips from `PENDING`.
