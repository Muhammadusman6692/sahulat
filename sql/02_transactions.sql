-- ============================================================================
-- PHASE 1 - FOUNDATION DDL - PART 2: TRANSACTION BACKBONE
-- stock ledger, posting-order sequence table, generic doc header/line,
-- inter-company clearing, GL header/line
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. STOCK LEDGER  (costing table - walked in txn_date + IN-before-OUT +
--    global_seq order for the weighted-average recost engine)
-- ----------------------------------------------------------------------------
CREATE TABLE stock_ledger (
  ledger_id     NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id    NUMBER NOT NULL REFERENCES company(company_id),
  branch_id     NUMBER NOT NULL REFERENCES branch(branch_id),
  warehouse_id  NUMBER NOT NULL REFERENCES warehouse(warehouse_id),
  item_id       NUMBER NOT NULL REFERENCES item(item_id),
  txn_date      DATE NOT NULL,                 -- business date; CAN be back-dated
  direction     CHAR(1) NOT NULL CHECK (direction IN ('I','O')),  -- I=IN, O=OUT (drives Rule 1 ordering)
  doc_type      VARCHAR2(15) NOT NULL,         -- GRN, SINV, SRET, PRET, ADJ_IN, ADJ_OUT, TRF_IN, TRF_OUT
  doc_id        NUMBER NOT NULL,
  doc_line_id   NUMBER NOT NULL,
  ref_doc_type  VARCHAR2(15),                  -- for returns: original doc type (GRN/SINV)
  ref_doc_line_id NUMBER,                      -- for returns: original doc line (cost basis lookup)
  qty           NUMBER(18,4) NOT NULL CHECK (qty > 0),
  unit_cost     NUMBER(18,4),                  -- weighted-avg cost applied to this line (set by recost engine)
  running_qty   NUMBER(18,4),                  -- recalculated by recost engine
  running_value NUMBER(18,2),                  -- recalculated by recost engine
  global_seq    NUMBER NOT NULL,               -- tie-breaker within same direction/date; = stock_txn_sequence.global_seq
  created_on    TIMESTAMP DEFAULT SYSTIMESTAMP
);
-- Costing-order index: exactly the order the recost engine walks
CREATE INDEX ix_sl_cost_order ON stock_ledger (
  item_id, warehouse_id, txn_date,
  CASE WHEN direction = 'I' THEN 0 ELSE 1 END,
  global_seq
);
CREATE INDEX ix_sl_doc ON stock_ledger (doc_type, doc_id, doc_line_id);

-- ----------------------------------------------------------------------------
-- 2. POSTING-ORDER SEQUENCE TABLE  (real-world "what happened first" -
--    independent of back-dated txn_date; used for reconciliation/audit)
-- ----------------------------------------------------------------------------
CREATE SEQUENCE seq_stock_post_order START WITH 1 INCREMENT BY 1 CACHE 100;

CREATE TABLE stock_txn_sequence (
  seq_id        NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id    NUMBER NOT NULL REFERENCES company(company_id),
  branch_id     NUMBER NOT NULL REFERENCES branch(branch_id),
  warehouse_id  NUMBER NOT NULL REFERENCES warehouse(warehouse_id),
  item_id       NUMBER NOT NULL REFERENCES item(item_id),
  txn_date      DATE NOT NULL,                 -- business date (may be back-dated)
  doc_type      VARCHAR2(15) NOT NULL,
  doc_id        NUMBER NOT NULL,
  doc_line_id   NUMBER NOT NULL,
  global_seq    NUMBER NOT NULL,                -- seq_stock_post_order.NEXTVAL, assigned at moment of posting - never changes
  posted_by     NUMBER NOT NULL REFERENCES app_user(user_id),
  posted_on     TIMESTAMP DEFAULT SYSTIMESTAMP,
  CONSTRAINT uq_sts_global_seq UNIQUE (global_seq)
);
CREATE INDEX ix_sts_item_wh ON stock_txn_sequence (item_id, warehouse_id, global_seq);

-- ----------------------------------------------------------------------------
-- 3. GENERIC DOCUMENT HEADER / LINE PATTERN
--    One header/line pair per document family. Shown here for Sales Invoice;
--    PO / GRN / Purchase Invoice / Sales Order / Delivery / Returns follow the
--    identical shape (copy-paste and rename in the trading-module deliverable).
-- ----------------------------------------------------------------------------
CREATE TABLE sales_inv_hdr (
  inv_id        NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id    NUMBER NOT NULL REFERENCES company(company_id),
  branch_id     NUMBER NOT NULL REFERENCES branch(branch_id),
  warehouse_id  NUMBER NOT NULL REFERENCES warehouse(warehouse_id),
  inv_no        VARCHAR2(30) NOT NULL,
  inv_date      DATE NOT NULL,
  party_id      NUMBER NOT NULL REFERENCES party(party_id),
  channel       VARCHAR2(10) NOT NULL CHECK (channel IN ('TRADING','POS','DIST')),
  terminal_id   NUMBER,                         -- set only when channel = POS
  route_id      NUMBER,                         -- set only when channel = DIST
  status        VARCHAR2(10) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','POSTED','CANCELLED')),
  gross_amt     NUMBER(18,2) DEFAULT 0,
  discount_amt  NUMBER(18,2) DEFAULT 0,
  tax_amt       NUMBER(18,2) DEFAULT 0,
  net_amt       NUMBER(18,2) DEFAULT 0,
  is_offline_synced CHAR(1) DEFAULT 'N' CHECK (is_offline_synced IN ('Y','N')),
  offline_uuid  VARCHAR2(40),                   -- client-generated UUID, idempotency key for sync
  created_by    NUMBER NOT NULL REFERENCES app_user(user_id),
  created_on    TIMESTAMP DEFAULT SYSTIMESTAMP,
  posted_by     NUMBER REFERENCES app_user(user_id),
  posted_on     TIMESTAMP,
  CONSTRAINT uq_sinv_no UNIQUE (company_id, inv_no),
  CONSTRAINT uq_sinv_offline UNIQUE (offline_uuid)
);

CREATE TABLE sales_inv_line (
  line_id       NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  inv_id        NUMBER NOT NULL REFERENCES sales_inv_hdr(inv_id),
  line_no       NUMBER(4) NOT NULL,
  item_id       NUMBER NOT NULL REFERENCES item(item_id),
  qty           NUMBER(18,4) NOT NULL CHECK (qty > 0),
  rate          NUMBER(18,4) NOT NULL,           -- tax-exclusive
  discount_amt  NUMBER(18,2) DEFAULT 0,
  tax_id        NUMBER REFERENCES tax_master(tax_id),
  tax_amt       NUMBER(18,2) DEFAULT 0,
  line_total    NUMBER(18,2) NOT NULL,           -- (qty*rate) - discount + tax
  CONSTRAINT uq_sinv_line UNIQUE (inv_id, line_no)
);

-- Sales return - mandatory FK back to the ORIGINAL invoice LINE (cost basis
-- = original document cost per your decision, not current weighted average)
CREATE TABLE sales_return_hdr (
  ret_id        NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id    NUMBER NOT NULL REFERENCES company(company_id),
  branch_id     NUMBER NOT NULL REFERENCES branch(branch_id),
  warehouse_id  NUMBER NOT NULL REFERENCES warehouse(warehouse_id),
  ret_no        VARCHAR2(30) NOT NULL,
  ret_date      DATE NOT NULL,
  party_id      NUMBER NOT NULL REFERENCES party(party_id),
  orig_inv_id   NUMBER NOT NULL REFERENCES sales_inv_hdr(inv_id),
  status        VARCHAR2(10) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','POSTED','CANCELLED')),
  net_amt       NUMBER(18,2) DEFAULT 0,
  created_by    NUMBER NOT NULL REFERENCES app_user(user_id),
  created_on    TIMESTAMP DEFAULT SYSTIMESTAMP,
  CONSTRAINT uq_sret_no UNIQUE (company_id, ret_no)
);

CREATE TABLE sales_return_line (
  line_id        NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ret_id         NUMBER NOT NULL REFERENCES sales_return_hdr(ret_id),
  orig_line_id   NUMBER NOT NULL REFERENCES sales_inv_line(line_id),  -- cost/rate basis
  item_id        NUMBER NOT NULL REFERENCES item(item_id),
  qty            NUMBER(18,4) NOT NULL CHECK (qty > 0),
  rate           NUMBER(18,4) NOT NULL,          -- copied from orig_line_id at insert time
  line_total     NUMBER(18,2) NOT NULL
);

-- Purchase side (GRN / Purchase Invoice / Purchase Return) mirrors the same
-- header/line + orig-line-FK pattern. Table names only, full DDL identical
-- in shape to sales_* above:
--   po_hdr / po_line
--   grn_hdr / grn_line               (drives stock_ledger direction='I', doc_type='GRN')
--   purchase_inv_hdr / purchase_inv_line
--   purchase_return_hdr / purchase_return_line  (orig_line_id -> grn_line.line_id)

-- ----------------------------------------------------------------------------
-- 4. GENERAL LEDGER (posting target for every module)
-- ----------------------------------------------------------------------------
CREATE TABLE gl_voucher_hdr (
  voucher_id    NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id    NUMBER NOT NULL REFERENCES company(company_id),
  branch_id     NUMBER NOT NULL REFERENCES branch(branch_id),
  voucher_no    VARCHAR2(30) NOT NULL,
  voucher_type  VARCHAR2(15) NOT NULL,   -- JV, CPV, CRV, BPV, BRV, SINV, PINV, ...
  voucher_date  DATE NOT NULL,
  period_id     NUMBER NOT NULL REFERENCES fiscal_period(period_id),
  source_module VARCHAR2(30),            -- module_function.module_code that generated this
  source_doc_id NUMBER,                  -- e.g. sales_inv_hdr.inv_id
  narration     VARCHAR2(400),
  status        VARCHAR2(10) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','POSTED','CANCELLED')),
  created_by    NUMBER NOT NULL REFERENCES app_user(user_id),
  created_on    TIMESTAMP DEFAULT SYSTIMESTAMP,
  posted_by     NUMBER REFERENCES app_user(user_id),
  posted_on     TIMESTAMP,
  CONSTRAINT uq_voucher_no UNIQUE (company_id, voucher_no)
);

CREATE TABLE gl_voucher_line (
  line_id       NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  voucher_id    NUMBER NOT NULL REFERENCES gl_voucher_hdr(voucher_id),
  coa_id        NUMBER NOT NULL REFERENCES coa(coa_id),     -- must be is_postable='Y'
  debit_amt     NUMBER(18,2) DEFAULT 0 CHECK (debit_amt >= 0),
  credit_amt    NUMBER(18,2) DEFAULT 0 CHECK (credit_amt >= 0),
  party_id      NUMBER REFERENCES party(party_id),           -- populated when coa is a control account
  cost_center   VARCHAR2(30),
  narration     VARCHAR2(400),
  CONSTRAINT ck_gl_line_one_side CHECK (
     (debit_amt > 0 AND credit_amt = 0) OR (credit_amt > 0 AND debit_amt = 0)
  )
);

-- ----------------------------------------------------------------------------
-- 5. INTER-COMPANY CLEARING
-- ----------------------------------------------------------------------------
CREATE TABLE intercompany_clearing_map (
  map_id           NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  from_company_id  NUMBER NOT NULL REFERENCES company(company_id),
  to_company_id    NUMBER NOT NULL REFERENCES company(company_id),
  from_clearing_coa_id NUMBER NOT NULL REFERENCES coa(coa_id),  -- "Due to <to_company>" in from_company's books
  to_clearing_coa_id   NUMBER NOT NULL REFERENCES coa(coa_id),  -- "Due from <from_company>" in to_company's books
  CONSTRAINT uq_ic_map UNIQUE (from_company_id, to_company_id)
);
-- An inter-company transaction posts TWO vouchers (one per company), each
-- hitting its own clearing account, linked by a shared source_doc_id/reference.

-- ----------------------------------------------------------------------------
-- 6. STOCK TRANSFER (branch-to-branch / warehouse-to-warehouse)
-- ----------------------------------------------------------------------------
CREATE TABLE stock_transfer_hdr (
  transfer_id    NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id     NUMBER NOT NULL REFERENCES company(company_id),
  transfer_no    VARCHAR2(30) NOT NULL,
  transfer_date  DATE NOT NULL,
  from_branch_id NUMBER NOT NULL REFERENCES branch(branch_id),
  from_warehouse_id NUMBER NOT NULL REFERENCES warehouse(warehouse_id),
  to_branch_id   NUMBER NOT NULL REFERENCES branch(branch_id),
  to_warehouse_id NUMBER NOT NULL REFERENCES warehouse(warehouse_id),
  status         VARCHAR2(10) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','POSTED','CANCELLED')),
  created_by     NUMBER NOT NULL REFERENCES app_user(user_id),
  created_on     TIMESTAMP DEFAULT SYSTIMESTAMP,
  CONSTRAINT uq_transfer_no UNIQUE (company_id, transfer_no)
);

CREATE TABLE stock_transfer_line (
  line_id      NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  transfer_id  NUMBER NOT NULL REFERENCES stock_transfer_hdr(transfer_id),
  item_id      NUMBER NOT NULL REFERENCES item(item_id),
  qty          NUMBER(18,4) NOT NULL CHECK (qty > 0)
  -- unit_cost is NOT entered here - it is taken from the FROM warehouse's
  -- current weighted-average cost at posting time (TRF_OUT), and becomes the
  -- TRF_IN cost at the TO warehouse (transfers move value, not just quantity).
);
