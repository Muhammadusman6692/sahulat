-- ============================================================================
-- MODULE TYPE (Setup / Transaction / Report)
--
-- Adds module_type to module_function so the sidebar can split a module group
-- that mixes kinds of screens (e.g. ACCOUNTING has both vouchers and ledger
-- reports) into labelled sub-sections, the way module_group already splits
-- the menu into ADMIN/ACCOUNTING/TRADING/etc.
--
-- Safe to re-run.
-- ============================================================================

SET DEFINE OFF

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
     module_type VARCHAR2(12)
                 CHECK (module_type IN (''SETUP'',''TRANSACTION'',''REPORT'')))');
END;
/

DECLARE
  PROCEDURE t (p_code VARCHAR2, p_type VARCHAR2) IS
  BEGIN
    UPDATE module_function SET module_type = p_type WHERE module_code = p_code;
  END;
BEGIN
  -- Admin: setup/master data, plus the Pending Approvals worklist (a transaction)
  t('COMPANY_MAINT',      'SETUP');
  t('BRANCH_MAINT',       'SETUP');
  t('WAREHOUSE_MAINT',    'SETUP');
  t('FISCAL_MAINT',       'SETUP');
  t('COA_MAINT',          'SETUP');
  t('DEFAULT_ACCT_MAINT', 'SETUP');
  t('NUMBERING_MAINT',    'SETUP');
  t('USER_MAINT',         'SETUP');
  t('ROLE_MAINT',         'SETUP');
  t('APPROVAL_MAINT',     'SETUP');
  t('PENDING_APPROVALS',  'TRANSACTION');
  t('TAX_MAINT',          'SETUP');
  t('UOM_MAINT',          'SETUP');
  t('ITEM_CAT_MAINT',     'SETUP');
  t('ITEM_BRAND_MAINT',   'SETUP');
  t('ITEM_MAINT',         'SETUP');
  t('PARTY_MAINT',        'SETUP');

  -- Accounting: vouchers are transactions, statements/ledgers are reports
  t('JV_ENTRY',      'TRANSACTION');
  t('CASH_VOUCHER',  'TRANSACTION');
  t('BANK_VOUCHER',  'TRANSACTION');
  t('PERIOD_CLOSE',  'TRANSACTION');
  t('GL_REPORT',     'REPORT');
  t('TRIAL_BALANCE', 'REPORT');
  t('PROFIT_LOSS',   'REPORT');
  t('BALANCE_SHEET', 'REPORT');
  t('PARTY_LEDGER',  'REPORT');
  t('AGING_REPORT',  'REPORT');

  -- Trading: documents are transactions, stock views are reports
  t('QUOTATION',        'TRANSACTION');
  t('SALES_ORDER',      'TRANSACTION');
  t('DELIVERY_NOTE',    'TRANSACTION');
  t('SALES_INVOICE',    'TRANSACTION');
  t('SALES_RETURN',     'TRANSACTION');
  t('PURCHASE_ORDER',   'TRANSACTION');
  t('GRN',              'TRANSACTION');
  t('PURCHASE_INVOICE', 'TRANSACTION');
  t('PURCHASE_RETURN',  'TRANSACTION');
  t('STOCK_TRANSFER',   'TRANSACTION');
  t('STOCK_ADJUSTMENT', 'TRANSACTION');
  t('STOCK_LEDGER_RPT', 'REPORT');
  t('REORDER_RPT',      'REPORT');

  -- POS: terminal setup, everything else is a till transaction
  t('POS_TERMINAL_MAINT','SETUP');
  t('POS_SHIFT_OPEN',    'TRANSACTION');
  t('POS_SALE',          'TRANSACTION');
  t('POS_SHIFT_CLOSE',   'TRANSACTION');
  t('POS_RETURN',        'TRANSACTION');
  t('POS_SYNC_STATUS',   'TRANSACTION');

  -- Distribution: route/outlet/scheme masters vs. the day's run
  t('DIST_ROUTE_MAINT',   'SETUP');
  t('DIST_SALESMAN_MAINT','SETUP');
  t('DIST_OUTLET_MAINT',  'SETUP');
  t('DIST_SCHEME_MAINT',  'SETUP');
  t('DIST_ORDER',         'TRANSACTION');
  t('DIST_DISPATCH',      'TRANSACTION');
  t('DIST_DELIVERY',      'TRANSACTION');
  t('DIST_RECOVERY',      'TRANSACTION');
  t('DIST_SETTLEMENT',    'TRANSACTION');
  t('DIST_SYNC_STATUS',   'TRANSACTION');

  -- Tax: a submission log is a report
  t('TAX_SUBMISSION_LOG', 'REPORT');

  -- Reports: all reports
  t('RPT_SALES_REGISTER',    'REPORT');
  t('RPT_PURCHASE_REGISTER', 'REPORT');
  t('RPT_STOCK_VALUATION',   'REPORT');
  t('RPT_POS_ZREPORT',       'REPORT');
  t('RPT_ROUTE_SETTLEMENT',  'REPORT');

  COMMIT;
END;
/

SELECT module_group, module_type, COUNT(*) AS modules
  FROM module_function
 WHERE module_group != 'LEGACY'
 GROUP BY module_group, module_type
 ORDER BY module_group, module_type;
