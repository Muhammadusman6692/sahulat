-- ============================================================================
-- PHASE 1 - FOUNDATION DDL - PART 1: MASTERS
-- Trading + POS + Distribution ERP
-- Target: Oracle 19c/23ai
-- Author context: Muhammad Usman - Jahangir Group
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. COMPANY / BRANCH / WAREHOUSE
-- ----------------------------------------------------------------------------
CREATE TABLE company (
  company_id     NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_code   VARCHAR2(10)  NOT NULL UNIQUE,
  company_name   VARCHAR2(200) NOT NULL,
  ntn_no         VARCHAR2(30),           -- FBR NTN
  strn_no        VARCHAR2(30),           -- Sales Tax Registration No.
  address        VARCHAR2(400),
  fy_start_month NUMBER(2) DEFAULT 7 NOT NULL,  -- July
  base_currency  VARCHAR2(3) DEFAULT 'PKR' NOT NULL,
  active_yn      CHAR(1) DEFAULT 'Y' CHECK (active_yn IN ('Y','N')),
  created_on     TIMESTAMP DEFAULT SYSTIMESTAMP,
  created_by     NUMBER
);

CREATE TABLE branch (
  branch_id      NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id     NUMBER NOT NULL REFERENCES company(company_id),
  branch_code    VARCHAR2(10)  NOT NULL,
  branch_name    VARCHAR2(200) NOT NULL,
  address        VARCHAR2(400),
  strn_no        VARCHAR2(30),           -- branch may have its own STRN for provincial tax
  active_yn      CHAR(1) DEFAULT 'Y' CHECK (active_yn IN ('Y','N')),
  CONSTRAINT uq_branch UNIQUE (company_id, branch_code)
);

CREATE TABLE warehouse (
  warehouse_id   NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id     NUMBER NOT NULL REFERENCES company(company_id),
  branch_id      NUMBER NOT NULL REFERENCES branch(branch_id),
  warehouse_code VARCHAR2(10)  NOT NULL,
  warehouse_name VARCHAR2(200) NOT NULL,
  is_shared      CHAR(1) DEFAULT 'N' CHECK (is_shared IN ('Y','N')), -- used by >1 branch
  active_yn      CHAR(1) DEFAULT 'Y' CHECK (active_yn IN ('Y','N')),
  CONSTRAINT uq_warehouse UNIQUE (company_id, warehouse_code)
);

-- A warehouse can be linked to more than one branch (shared warehouse case)
CREATE TABLE branch_warehouse (
  branch_id     NUMBER NOT NULL REFERENCES branch(branch_id),
  warehouse_id  NUMBER NOT NULL REFERENCES warehouse(warehouse_id),
  PRIMARY KEY (branch_id, warehouse_id)
);

-- ----------------------------------------------------------------------------
-- 2. CHART OF ACCOUNTS  (4 levels: Group > Control > Sub-Control > Posting)
--    Format: 1-02-003-0001   |  company-specific rows, code CAN repeat across companies
-- ----------------------------------------------------------------------------
CREATE TABLE coa (
  coa_id        NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id    NUMBER NOT NULL REFERENCES company(company_id),
  account_code  VARCHAR2(20) NOT NULL,     -- e.g. 1-02-003-0001
  account_name  VARCHAR2(200) NOT NULL,
  parent_id     NUMBER REFERENCES coa(coa_id),
  account_level NUMBER(1) NOT NULL CHECK (account_level BETWEEN 1 AND 4),
                 -- 1=Group, 2=Control, 3=Sub-Control, 4=Posting Account
  account_nature VARCHAR2(20) NOT NULL CHECK (account_nature IN
                 ('ASSET','LIABILITY','EQUITY','INCOME','EXPENSE')),
  normal_side   CHAR(1) NOT NULL CHECK (normal_side IN ('D','C')),
  is_postable   CHAR(1) GENERATED ALWAYS AS (CASE WHEN account_level = 4 THEN 'Y' ELSE 'N' END),
  is_control_ac VARCHAR2(20),              -- 'CUSTOMER','SUPPLIER','CASH','BANK', NULL = ordinary
  cost_center_required CHAR(1) DEFAULT 'N' CHECK (cost_center_required IN ('Y','N')),
  active_yn     CHAR(1) DEFAULT 'Y' CHECK (active_yn IN ('Y','N')),
  is_default_seed CHAR(1) DEFAULT 'N',     -- Y = part of the compulsory seed set copied to every new company
  CONSTRAINT uq_coa UNIQUE (company_id, account_code)
);
CREATE INDEX ix_coa_parent ON coa(parent_id);

-- Level-consistency guard: a child's level must be exactly parent's level + 1
CREATE OR REPLACE TRIGGER trg_coa_level_chk
BEFORE INSERT OR UPDATE ON coa
FOR EACH ROW
DECLARE
  v_parent_level NUMBER;
BEGIN
  IF :NEW.parent_id IS NOT NULL THEN
    SELECT account_level INTO v_parent_level FROM coa WHERE coa_id = :NEW.parent_id;
    IF :NEW.account_level != v_parent_level + 1 THEN
      RAISE_APPLICATION_ERROR(-20001, 'COA level must be parent level + 1');
    END IF;
  ELSIF :NEW.account_level != 1 THEN
    RAISE_APPLICATION_ERROR(-20002, 'Only Group (level 1) accounts may have no parent');
  END IF;
END;
/

-- Financial year & period locking
CREATE TABLE fiscal_year (
  fy_id        NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id   NUMBER NOT NULL REFERENCES company(company_id),
  fy_name      VARCHAR2(20) NOT NULL,      -- e.g. FY2026-27
  start_date   DATE NOT NULL,              -- 1-Jul
  end_date     DATE NOT NULL,              -- 30-Jun
  status       VARCHAR2(10) DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED')),
  CONSTRAINT uq_fy UNIQUE (company_id, fy_name)
);

CREATE TABLE fiscal_period (
  period_id    NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fy_id        NUMBER NOT NULL REFERENCES fiscal_year(fy_id),
  period_no    NUMBER(2) NOT NULL,         -- 1..12
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  status       VARCHAR2(10) DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED')),
  CONSTRAINT uq_period UNIQUE (fy_id, period_no)
);

-- ----------------------------------------------------------------------------
-- 3. NUMBERING SERIES (shared structure across companies; terminal-specific
--    series supported for offline POS)
-- ----------------------------------------------------------------------------
CREATE TABLE numbering_series (
  series_id     NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id    NUMBER NOT NULL REFERENCES company(company_id),
  branch_id     NUMBER REFERENCES branch(branch_id),          -- NULL = company-wide
  terminal_id   NUMBER,                                       -- NULL = not terminal-specific; FK added after pos_terminal exists
  doc_type      VARCHAR2(15) NOT NULL,     -- SINV, PINV, GRN, POS_SALE, DIST_ORD, JV, ...
  prefix        VARCHAR2(15),              -- e.g. 'POS-T05-'
  next_number   NUMBER DEFAULT 1 NOT NULL,
  pad_length    NUMBER DEFAULT 6,
  reset_yearly  CHAR(1) DEFAULT 'Y' CHECK (reset_yearly IN ('Y','N')),
  fy_id         NUMBER REFERENCES fiscal_year(fy_id)           -- current FY this counter belongs to (for yearly reset)
);
-- UNIQUE constraints can't use expressions (NVL); a unique index can.
CREATE UNIQUE INDEX ux_numbering_series ON numbering_series (
  company_id, NVL(branch_id,-1), NVL(terminal_id,-1), doc_type
);

-- ----------------------------------------------------------------------------
-- 4. USERS / ROLES / PERMISSIONS / APPROVALS  (custom auth table, per your decision)
-- ----------------------------------------------------------------------------
CREATE TABLE app_user (
  user_id        NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username       VARCHAR2(50)  NOT NULL UNIQUE,
  password_hash  VARCHAR2(200) NOT NULL,     -- bcrypt/argon2id hash - hashed in Node, never in PL/SQL
  full_name      VARCHAR2(200) NOT NULL,
  email          VARCHAR2(200),
  phone          VARCHAR2(20),
  is_active      CHAR(1) DEFAULT 'Y' CHECK (is_active IN ('Y','N')),
  failed_attempts NUMBER DEFAULT 0,
  locked_until   TIMESTAMP,
  last_login     TIMESTAMP,
  created_on     TIMESTAMP DEFAULT SYSTIMESTAMP
);

-- Scope: a user may be limited to specific company/branch/warehouse.
-- NULL branch_id  = all branches of that company
-- NULL warehouse_id = all warehouses of that branch
CREATE TABLE user_company_access (
  access_id    NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      NUMBER NOT NULL REFERENCES app_user(user_id),
  company_id   NUMBER NOT NULL REFERENCES company(company_id),
  branch_id    NUMBER REFERENCES branch(branch_id),
  warehouse_id NUMBER REFERENCES warehouse(warehouse_id),
  CONSTRAINT uq_uca UNIQUE (user_id, company_id, branch_id, warehouse_id)
);

CREATE TABLE role (
  role_id    NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id NUMBER REFERENCES company(company_id),   -- NULL = global/system role (e.g. Super Admin)
  role_name  VARCHAR2(100) NOT NULL,
  active_yn  CHAR(1) DEFAULT 'Y' CHECK (active_yn IN ('Y','N'))
);
-- UNIQUE constraints can't use expressions (NVL); a unique index can.
CREATE UNIQUE INDEX ux_role ON role (NVL(company_id,-1), role_name);

-- Master list of module/function codes the permission matrix governs.
-- Populate one row per screen/document type (SALES_INVOICE, PO, GRN, POS_SALE,
-- DIST_ORDER, JV, COA_MAINT, USER_MAINT, ...). This is the vocabulary both
-- Next.js middleware and PL/SQL pkg_security check against.
CREATE TABLE module_function (
  module_code   VARCHAR2(30) PRIMARY KEY,
  module_name   VARCHAR2(200) NOT NULL,
  module_group  VARCHAR2(30)   -- TRADING / POS / DISTRIBUTION / ADMIN / ACCOUNTING
);

CREATE TABLE role_permission (
  role_id      NUMBER NOT NULL REFERENCES role(role_id),
  module_code  VARCHAR2(30) NOT NULL REFERENCES module_function(module_code),
  can_view     CHAR(1) DEFAULT 'N' CHECK (can_view    IN ('Y','N')),
  can_create   CHAR(1) DEFAULT 'N' CHECK (can_create  IN ('Y','N')),
  can_edit     CHAR(1) DEFAULT 'N' CHECK (can_edit    IN ('Y','N')),
  can_post     CHAR(1) DEFAULT 'N' CHECK (can_post    IN ('Y','N')),
  can_cancel   CHAR(1) DEFAULT 'N' CHECK (can_cancel  IN ('Y','N')),
  can_print    CHAR(1) DEFAULT 'N' CHECK (can_print   IN ('Y','N')),
  can_approve  CHAR(1) DEFAULT 'N' CHECK (can_approve IN ('Y','N')),
  PRIMARY KEY (role_id, module_code)
);

CREATE TABLE user_role (
  user_id NUMBER NOT NULL REFERENCES app_user(user_id),
  role_id NUMBER NOT NULL REFERENCES role(role_id),
  PRIMARY KEY (user_id, role_id)
);

-- Generic approval workflow: one or more approval steps per module/doc.
CREATE TABLE approval_rule (
  rule_id      NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id   NUMBER NOT NULL REFERENCES company(company_id),
  module_code  VARCHAR2(30) NOT NULL REFERENCES module_function(module_code),
  step_no      NUMBER(2) NOT NULL,
  approver_role_id NUMBER NOT NULL REFERENCES role(role_id),
  min_amount   NUMBER(18,2) DEFAULT 0,     -- rule applies only above this doc amount; 0 = always
  CONSTRAINT uq_appr_rule UNIQUE (company_id, module_code, step_no)
);

CREATE TABLE approval_instance (
  instance_id  NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id   NUMBER NOT NULL REFERENCES company(company_id),
  module_code  VARCHAR2(30) NOT NULL REFERENCES module_function(module_code),
  doc_id       NUMBER NOT NULL,
  step_no      NUMBER(2) NOT NULL,
  status       VARCHAR2(10) DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  acted_by     NUMBER REFERENCES app_user(user_id),
  acted_on     TIMESTAMP,
  remarks      VARCHAR2(400)
);

-- ----------------------------------------------------------------------------
-- 5. PARTY (customer & supplier combined; company-specific, not shared)
-- ----------------------------------------------------------------------------
CREATE TABLE party (
  party_id      NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id    NUMBER NOT NULL REFERENCES company(company_id),
  party_code    VARCHAR2(20) NOT NULL,
  party_name    VARCHAR2(200) NOT NULL,
  is_supplier   CHAR(1) DEFAULT 'N' CHECK (is_supplier IN ('Y','N')),
  is_customer   CHAR(1) DEFAULT 'N' CHECK (is_customer IN ('Y','N')),
  ntn_no        VARCHAR2(30),
  strn_no       VARCHAR2(30),
  phone         VARCHAR2(20),
  address       VARCHAR2(400),
  credit_limit  NUMBER(18,2) DEFAULT 0,
  credit_days   NUMBER(3) DEFAULT 0,
  ar_coa_id     NUMBER REFERENCES coa(coa_id),   -- customer control account (level 4)
  ap_coa_id     NUMBER REFERENCES coa(coa_id),   -- supplier control account (level 4)
  active_yn     CHAR(1) DEFAULT 'Y' CHECK (active_yn IN ('Y','N')),
  CONSTRAINT uq_party UNIQUE (company_id, party_code)
);

-- Distribution-specific: outlet detail on top of party (only when party serves as an outlet)
CREATE TABLE outlet (
  outlet_id    NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  party_id     NUMBER NOT NULL REFERENCES party(party_id),
  route_id     NUMBER,   -- FK added in distribution phase
  latitude     NUMBER,
  longitude    NUMBER,
  active_yn    CHAR(1) DEFAULT 'Y' CHECK (active_yn IN ('Y','N'))
);

-- ----------------------------------------------------------------------------
-- 6. ITEM (single UOM, decimal qty, category, brand)
-- ----------------------------------------------------------------------------
CREATE TABLE item_category (
  category_id   NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id    NUMBER NOT NULL REFERENCES company(company_id),
  category_name VARCHAR2(100) NOT NULL,
  CONSTRAINT uq_item_cat UNIQUE (company_id, category_name)
);

CREATE TABLE item_brand (
  brand_id      NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id    NUMBER NOT NULL REFERENCES company(company_id),
  brand_name    VARCHAR2(100) NOT NULL,
  CONSTRAINT uq_item_brand UNIQUE (company_id, brand_name)
);

CREATE TABLE uom (
  uom_code   VARCHAR2(10) PRIMARY KEY,   -- PCS, KG, LTR, MTR, BOX...
  uom_name   VARCHAR2(50) NOT NULL,
  allow_decimal CHAR(1) DEFAULT 'Y' CHECK (allow_decimal IN ('Y','N'))
);

CREATE TABLE item (
  item_id       NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id    NUMBER NOT NULL REFERENCES company(company_id),
  item_code     VARCHAR2(30) NOT NULL,
  item_name     VARCHAR2(200) NOT NULL,
  category_id   NUMBER REFERENCES item_category(category_id),
  brand_id      NUMBER REFERENCES item_brand(brand_id),
  uom_code      VARCHAR2(10) NOT NULL REFERENCES uom(uom_code),
  barcode       VARCHAR2(50),
  reorder_level NUMBER(18,4) DEFAULT 0,
  tax_id        NUMBER,          -- FK added below after tax_master
  active_yn     CHAR(1) DEFAULT 'Y' CHECK (active_yn IN ('Y','N')),
  CONSTRAINT uq_item UNIQUE (company_id, item_code)
);
CREATE INDEX ix_item_barcode ON item(barcode);

-- Mandatory sale price, effective-dated (never overwritten -- history preserved)
CREATE TABLE item_price (
  item_price_id  NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id     NUMBER NOT NULL REFERENCES company(company_id),
  item_id        NUMBER NOT NULL REFERENCES item(item_id),
  sale_price     NUMBER(18,4) NOT NULL CHECK (sale_price >= 0),
  effective_from DATE NOT NULL,
  effective_to   DATE,
  created_by     NUMBER REFERENCES app_user(user_id),
  created_on     TIMESTAMP DEFAULT SYSTIMESTAMP,
  CONSTRAINT uq_item_price UNIQUE (company_id, item_id, effective_from)
);
CREATE INDEX ix_item_price_lookup ON item_price(company_id, item_id, effective_from, effective_to);

-- ----------------------------------------------------------------------------
-- 7. TAX MASTER (item-wise rates, tax-exclusive pricing, FBR/PRA/SRB ready)
-- ----------------------------------------------------------------------------
CREATE TABLE tax_authority (
  authority_code VARCHAR2(10) PRIMARY KEY,     -- FBR, PRA, SRB, BRA, KPRA
  authority_name VARCHAR2(100) NOT NULL
);

CREATE TABLE tax_master (
  tax_id        NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id    NUMBER NOT NULL REFERENCES company(company_id),
  authority_code VARCHAR2(10) NOT NULL REFERENCES tax_authority(authority_code),
  tax_code      VARCHAR2(20) NOT NULL,          -- e.g. GST-18, PRA-16
  tax_name      VARCHAR2(100) NOT NULL,
  tax_rate      NUMBER(6,3) NOT NULL,           -- percentage, e.g. 18.000
  tax_type      VARCHAR2(20) NOT NULL CHECK (tax_type IN ('SALES_TAX','WITHHOLDING','FURTHER_TAX','EXTRA_TAX')),
  tax_coa_id    NUMBER REFERENCES coa(coa_id),  -- output/input tax posting account (level 4)
  active_yn     CHAR(1) DEFAULT 'Y' CHECK (active_yn IN ('Y','N')),
  CONSTRAINT uq_tax UNIQUE (company_id, tax_code)
);

ALTER TABLE item ADD CONSTRAINT fk_item_tax FOREIGN KEY (tax_id) REFERENCES tax_master(tax_id);

-- FBR/PRA/SRB digital invoicing integration log (each posted sales invoice
-- gets one row per authority submission attempt)
CREATE TABLE tax_authority_submission (
  submission_id  NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id     NUMBER NOT NULL REFERENCES company(company_id),
  authority_code VARCHAR2(10) NOT NULL REFERENCES tax_authority(authority_code),
  doc_type       VARCHAR2(15) NOT NULL,
  doc_id         NUMBER NOT NULL,
  invoice_ref_no VARCHAR2(100),         -- FBR/PRA-returned invoice number (e.g. FBR IRN)
  qr_code_data   VARCHAR2(2000),
  status         VARCHAR2(15) DEFAULT 'PENDING' CHECK (status IN ('PENDING','SUBMITTED','FAILED','ACKNOWLEDGED')),
  request_payload  CLOB,
  response_payload CLOB,
  submitted_on   TIMESTAMP,
  created_on     TIMESTAMP DEFAULT SYSTIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 8. AUDIT TRAIL (generic, applied via trigger-generation pattern per table)
-- ----------------------------------------------------------------------------
CREATE TABLE audit_log (
  audit_id     NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name   VARCHAR2(50) NOT NULL,
  record_pk    VARCHAR2(100) NOT NULL,
  action       VARCHAR2(10) NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  changed_by   NUMBER REFERENCES app_user(user_id),
  changed_on   TIMESTAMP DEFAULT SYSTIMESTAMP,
  old_data     CLOB,   -- JSON snapshot
  new_data     CLOB    -- JSON snapshot
);
CREATE INDEX ix_audit_lookup ON audit_log(table_name, record_pk, changed_on);
