-- ============================================================================
-- DEVELOPMENT SEED — Chart of Accounts for JTC
--
-- A small but structurally complete 4-level tree: enough Group/Control/
-- Sub-Control accounts to exercise the parent picker and the level-1..4
-- badges, plus posting accounts for the party control accounts referenced by
-- ar_coa_id/ap_coa_id and the tax control accounts referenced by tax_master.
--
-- Uses the trg_coa_level_chk trigger's own rule (child level = parent level
-- + 1) via normal INSERTs — nothing here bypasses it. Safe to re-run.
--
-- CUSTOMER/SUPPLIER accounts seeded here (marked below) are placeholder
-- leaf accounts only — normally Party Master creates this kind of account
-- itself, alongside the `party` row whose ar_coa_id/ap_coa_id points back at
-- it (see sql/16_party_master.sql). Because these were inserted directly,
-- they start with no backing party row, so JV/CV reject them with "No party
-- is linked to the selected account" until one is added, e.g.:
--   INSERT INTO party (company_id, party_code, party_name, is_customer,
--                       is_supplier, ar_coa_id, ap_coa_id, active_yn)
--   VALUES (:companyId, '<code>', '<name>', 'Y'/'N', 'Y'/'N', <coa_id or NULL>,
--           <coa_id or NULL>, 'Y');
-- ============================================================================

SET DEFINE OFF

DECLARE
  v_company_id NUMBER;
  v_dummy NUMBER;

  FUNCTION acct (
    p_code   VARCHAR2,
    p_name   VARCHAR2,
    p_parent VARCHAR2,
    p_level  NUMBER,
    p_nature VARCHAR2,
    p_side   VARCHAR2,
    p_control VARCHAR2 DEFAULT NULL
  ) RETURN NUMBER IS
    v_id        NUMBER;
    v_parent_id NUMBER;
  BEGIN
    BEGIN
      SELECT coa_id INTO v_id FROM coa
       WHERE company_id = v_company_id AND account_code = p_code;
      RETURN v_id;
    EXCEPTION WHEN NO_DATA_FOUND THEN NULL;
    END;

    IF p_parent IS NOT NULL THEN
      SELECT coa_id INTO v_parent_id FROM coa
       WHERE company_id = v_company_id AND account_code = p_parent;
    ELSE
      v_parent_id := NULL;
    END IF;

    INSERT INTO coa (company_id, account_code, account_name, parent_id,
                     account_level, account_nature, normal_side, is_control_ac)
    VALUES (v_company_id, p_code, p_name, v_parent_id,
            p_level, p_nature, p_side, p_control)
    RETURNING coa_id INTO v_id;

    RETURN v_id;
  END;

BEGIN
  SELECT company_id INTO v_company_id FROM company WHERE company_code = 'JTC';

  -- 1. ASSETS
  v_dummy := acct('1',           'ASSETS',                 NULL,  1, 'ASSET',     'D');
  v_dummy := acct('1-01',        'Current Assets',         '1',   2, 'ASSET',     'D');
  v_dummy := acct('1-01-001',    'Trade Debtors',          '1-01',3, 'ASSET',     'D');
  v_dummy := acct('1-01-001-0001','Al-Madina Traders',     '1-01-001', 4, 'ASSET', 'D', 'CUSTOMER');
  v_dummy := acct('1-01-001-0002','Shaheen Distributors',  '1-01-001', 4, 'ASSET', 'D', 'CUSTOMER'); -- needs a backing party row, see note above
  v_dummy := acct('1-01-002',    'Stock in Trade',         '1-01',3, 'ASSET',     'D');
  v_dummy := acct('1-01-002-0001','Inventory - Main Store','1-01-002', 4, 'ASSET', 'D');
  v_dummy := acct('1-01-003',    'Cash & Bank',            '1-01',3, 'ASSET',     'D');
  v_dummy := acct('1-01-003-0001','Cash in Hand - Lahore', '1-01-003', 4, 'ASSET', 'D', 'CASH');
  v_dummy := acct('1-01-003-0002','Bank - Main Account',   '1-01-003', 4, 'ASSET', 'D', 'BANK');
  v_dummy := acct('1-02',        'Fixed Assets',           '1',   2, 'ASSET',     'D');
  v_dummy := acct('1-02-001',    'Property & Equipment',   '1-02',3, 'ASSET',     'D');
  v_dummy := acct('1-02-001-0001','Furniture & Fixtures',  '1-02-001', 4, 'ASSET', 'D');

  -- 2. LIABILITIES
  v_dummy := acct('2',           'LIABILITIES',            NULL,  1, 'LIABILITY', 'C');
  v_dummy := acct('2-01',        'Current Liabilities',    '2',   2, 'LIABILITY', 'C');
  v_dummy := acct('2-01-001',    'Trade Creditors',        '2-01',3, 'LIABILITY', 'C');
  v_dummy := acct('2-01-001-0001','Sunshine Distributors (Supplier)', '2-01-001', 4, 'LIABILITY', 'C', 'SUPPLIER'); -- needs a backing party row, see note above
  v_dummy := acct('2-01-002',    'Tax Payable',            '2-01',3, 'LIABILITY', 'C');
  v_dummy := acct('2-01-002-0001','Output Sales Tax - FBR','2-01-002', 4, 'LIABILITY', 'C');

  -- 3. EQUITY
  v_dummy := acct('3',           'EQUITY',                 NULL,  1, 'EQUITY',    'C');
  v_dummy := acct('3-01',        'Owner''s Equity',        '3',   2, 'EQUITY',    'C');
  v_dummy := acct('3-01-001',    'Capital Account',        '3-01',3, 'EQUITY',    'C');
  v_dummy := acct('3-01-001-0001','Capital - Proprietor',  '3-01-001', 4, 'EQUITY', 'C');

  -- 4. INCOME
  v_dummy := acct('4',           'INCOME',                 NULL,  1, 'INCOME',    'C');
  v_dummy := acct('4-01',        'Sales Revenue',          '4',   2, 'INCOME',    'C');
  v_dummy := acct('4-01-001',    'Sales',                  '4-01',3, 'INCOME',    'C');
  v_dummy := acct('4-01-001-0001','Sales - Trading',       '4-01-001', 4, 'INCOME', 'C');
  v_dummy := acct('4-01-001-0002','Sales - POS',           '4-01-001', 4, 'INCOME', 'C');

  -- 5. EXPENSES
  v_dummy := acct('5',           'EXPENSES',               NULL,  1, 'EXPENSE',   'D');
  v_dummy := acct('5-01',        'Cost of Sales',          '5',   2, 'EXPENSE',   'D');
  v_dummy := acct('5-01-001',    'Cost of Goods Sold',     '5-01',3, 'EXPENSE',   'D');
  v_dummy := acct('5-01-001-0001','COGS - Trading',        '5-01-001', 4, 'EXPENSE', 'D');
  v_dummy := acct('5-02',        'Operating Expenses',     '5',   2, 'EXPENSE',   'D');
  v_dummy := acct('5-02-001',    'Administrative Expenses','5-02',3, 'EXPENSE',   'D');
  v_dummy := acct('5-02-001-0001','Salaries & Wages',      '5-02-001', 4, 'EXPENSE', 'D');
  v_dummy := acct('5-02-001-0002','Rent Expense',          '5-02-001', 4, 'EXPENSE', 'D');

  COMMIT;
END;
/

SELECT account_level, COUNT(*) AS accounts
  FROM coa c JOIN company co ON co.company_id = c.company_id
 WHERE co.company_code = 'JTC'
 GROUP BY account_level ORDER BY account_level;
