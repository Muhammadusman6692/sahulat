-- ============================================================================
-- BUILD-STATUS TRACKING + FULL MENU SEED
--
-- Adds build tracking to module_function and seeds one row per menu item from
-- the agreed menu tree. The sidebar renders a badge per item from these rows.
--
-- sort_order is additive to the brief's three columns: the menu tree is an
-- ordered list, and without it the sidebar cannot reproduce that order.
--
-- Existing module rows are updated in place, never deleted — role_permission
-- has a foreign key to module_code, so removing a row would drop granted
-- permissions with it.
--
-- Safe to re-run.
-- ============================================================================

SET DEFINE OFF

-- ----------------------------------------------------------------------------
-- 1. Columns (guarded so the script can be re-run)
-- ----------------------------------------------------------------------------
DECLARE
  PROCEDURE add_column (p_ddl VARCHAR2) IS
  BEGIN
    EXECUTE IMMEDIATE p_ddl;
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLCODE != -1430 THEN RAISE; END IF;  -- ORA-01430: column already exists
  END;
BEGIN
  add_column('ALTER TABLE module_function ADD (
     build_status VARCHAR2(15) DEFAULT ''PENDING''
                  CHECK (build_status IN (''PENDING'',''IN_PROGRESS'',''COMPLETED'')),
     build_notes  VARCHAR2(400),
     completed_on DATE)');
  add_column('ALTER TABLE module_function ADD (sort_order NUMBER(4) DEFAULT 999)');
END;
/

-- ----------------------------------------------------------------------------
-- 2. Menu tree
-- ----------------------------------------------------------------------------
DECLARE
  v_seq NUMBER := 0;

  PROCEDURE m (p_code VARCHAR2, p_name VARCHAR2, p_group VARCHAR2) IS
  BEGIN
    v_seq := v_seq + 10;
    MERGE INTO module_function t
    USING (SELECT p_code AS c FROM dual) s
       ON (t.module_code = s.c)
    WHEN MATCHED THEN
      UPDATE SET module_name = p_name, module_group = p_group, sort_order = v_seq
    WHEN NOT MATCHED THEN
      INSERT (module_code, module_name, module_group, sort_order, build_status)
      VALUES (p_code, p_name, p_group, v_seq, 'PENDING');
  END;
BEGIN
  -- Admin
  m('COMPANY_MAINT',      'Company Setup',          'ADMIN');
  m('BRANCH_MAINT',       'Branch Setup',           'ADMIN');
  m('WAREHOUSE_MAINT',    'Warehouse Setup',        'ADMIN');
  m('FISCAL_MAINT',       'Fiscal Year & Periods',  'ADMIN');
  m('COA_MAINT',          'Chart of Accounts',      'ADMIN');
  m('DEFAULT_ACCT_MAINT', 'Default GL Accounts',    'ADMIN');
  m('NUMBERING_MAINT',    'Numbering Series',       'ADMIN');
  m('USER_MAINT',         'Users',                  'ADMIN');
  m('ROLE_MAINT',         'Roles & Permissions',    'ADMIN');
  m('APPROVAL_MAINT',     'Approval Rules',         'ADMIN');
  m('TAX_MAINT',          'Tax Authority & Master', 'ADMIN');
  m('UOM_MAINT',          'UOM Master',             'ADMIN');
  m('ITEM_CAT_MAINT',     'Item Category',          'ADMIN');
  m('ITEM_BRAND_MAINT',   'Item Brand',             'ADMIN');
  m('ITEM_MAINT',         'Item Master',            'ADMIN');
  m('PARTY_MAINT',        'Party Master',           'ADMIN');

  -- Accounting
  m('JV_ENTRY',      'Journal Voucher',        'ACCOUNTING');
  m('CASH_VOUCHER',  'Cash Payment/Receipt',   'ACCOUNTING');
  m('BANK_VOUCHER',  'Bank Payment/Receipt',   'ACCOUNTING');
  m('GL_REPORT',     'General Ledger',         'ACCOUNTING');
  m('TRIAL_BALANCE', 'Trial Balance',          'ACCOUNTING');
  m('PROFIT_LOSS',   'Profit & Loss',          'ACCOUNTING');
  m('BALANCE_SHEET', 'Balance Sheet',          'ACCOUNTING');
  m('PARTY_LEDGER',  'Party Ledger',           'ACCOUNTING');
  m('AGING_REPORT',  'Aging Report',           'ACCOUNTING');
  m('PERIOD_CLOSE',  'Period Close',           'ACCOUNTING');

  -- Trading
  m('QUOTATION',        'Quotation',                'TRADING');
  m('SALES_ORDER',      'Sales Order',              'TRADING');
  m('DELIVERY_NOTE',    'Delivery Note',            'TRADING');
  m('SALES_INVOICE',    'Sales Invoice',            'TRADING');
  m('SALES_RETURN',     'Sales Return',             'TRADING');
  m('PURCHASE_ORDER',   'Purchase Order',           'TRADING');
  m('GRN',              'GRN',                      'TRADING');
  m('PURCHASE_INVOICE', 'Purchase Invoice',         'TRADING');
  m('PURCHASE_RETURN',  'Purchase Return',          'TRADING');
  m('STOCK_TRANSFER',   'Stock Transfer',           'TRADING');
  m('STOCK_ADJUSTMENT', 'Stock Adjustment',         'TRADING');
  m('STOCK_LEDGER_RPT', 'Stock Ledger / Card',      'TRADING');
  m('REORDER_RPT',      'Reorder Level Report',     'TRADING');

  -- POS
  m('POS_TERMINAL_MAINT','Terminal Setup',          'POS');
  m('POS_SHIFT_OPEN',    'Shift Open',              'POS');
  m('POS_SALE',          'POS Sale',                'POS');
  m('POS_SHIFT_CLOSE',   'Shift Close / Z-Report',  'POS');
  m('POS_RETURN',        'POS Return',              'POS');
  m('POS_SYNC_STATUS',   'Offline Sync Status',     'POS');

  -- Distribution
  m('DIST_ROUTE_MAINT',   'Route Master',            'DISTRIBUTION');
  m('DIST_SALESMAN_MAINT','Salesman Assignment',     'DISTRIBUTION');
  m('DIST_OUTLET_MAINT',  'Outlet Master',           'DISTRIBUTION');
  m('DIST_ORDER',         'Order Booking',           'DISTRIBUTION');
  m('DIST_DISPATCH',      'Dispatch / Load-out',     'DISTRIBUTION');
  m('DIST_DELIVERY',      'Delivery Confirmation',   'DISTRIBUTION');
  m('DIST_RECOVERY',      'Recovery / Collection',   'DISTRIBUTION');
  m('DIST_SETTLEMENT',    'Route Settlement',        'DISTRIBUTION');
  m('DIST_SCHEME_MAINT',  'Trade Scheme / Slab Discount', 'DISTRIBUTION');
  m('DIST_SYNC_STATUS',   'Offline Sync Status',     'DISTRIBUTION');

  -- Tax
  m('TAX_SUBMISSION_LOG', 'Authority Submission Log', 'TAX');

  -- Reports
  m('RPT_SALES_REGISTER',    'Sales Register',         'REPORTS');
  m('RPT_PURCHASE_REGISTER', 'Purchase Register',      'REPORTS');
  m('RPT_STOCK_VALUATION',   'Stock Valuation',        'REPORTS');
  m('RPT_POS_ZREPORT',       'POS Z-Report',           'REPORTS');
  m('RPT_ROUTE_SETTLEMENT',  'Route Settlement Report','REPORTS');

  COMMIT;
END;
/

-- ----------------------------------------------------------------------------
-- 3. Modules seeded earlier that the menu tree does not name. Kept, because
--    role_permission references them, but parked out of the menu.
-- ----------------------------------------------------------------------------
UPDATE module_function
   SET module_group = 'LEGACY', sort_order = 9000
 WHERE module_code IN ('GL_VOUCHER','POS_SHIFT')
   AND module_group != 'LEGACY';
COMMIT;

-- ----------------------------------------------------------------------------
-- 4. Super Admin must be able to see every new module, or the sidebar would
--    hide the very screens that still need building.
-- ----------------------------------------------------------------------------
INSERT INTO role_permission (role_id, module_code, can_view, can_create,
                             can_edit, can_post, can_cancel, can_print, can_approve)
SELECT r.role_id, m.module_code, 'Y','Y','Y','Y','Y','Y','Y'
  FROM role r
 CROSS JOIN module_function m
 WHERE r.company_id IS NULL
   AND r.role_name = 'Super Admin'
   AND NOT EXISTS (SELECT 1 FROM role_permission rp
                    WHERE rp.role_id = r.role_id
                      AND rp.module_code = m.module_code);
COMMIT;

-- ----------------------------------------------------------------------------
-- 5. Honest starting state for what this session has actually built.
--    Item Master has a working list view but no create/edit form yet, so by
--    the completion rule it is IN_PROGRESS, not COMPLETED.
-- ----------------------------------------------------------------------------
UPDATE module_function
   SET build_status = 'IN_PROGRESS',
       build_notes  = 'List view with search, category/brand/status filters and paging works against the live schema. Create/edit form and soft delete still to build.'
 WHERE module_code = 'ITEM_MAINT';
COMMIT;

UPDATE module_function
   SET build_status = 'COMPLETED',
       build_notes  = 'List, create and edit approval_rule rows (company/document/step -> approver role + min amount). Document dropdown limited to transactional modules. Verified against the live schema: duplicate (company, module, step) rejected with a readable error.',
       completed_on = SYSDATE
 WHERE module_code = 'APPROVAL_MAINT';
COMMIT;

SELECT module_group, build_status, COUNT(*) AS modules
  FROM module_function
 GROUP BY module_group, build_status
 ORDER BY module_group, build_status;
