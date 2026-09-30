-- ============================================================================
-- MORE DEFAULT GL ROLES — cost side of a sale, and the purchase side
--
-- Confirmed with the user (2026-09-30) before writing this: GRN and Delivery
-- never post to GL — only Purchase Invoice and Sales Invoice do. So there is
-- no "GRN Clearing" role; a Purchase Invoice's entry is Dr Inventory / Dr
-- Input Tax / Cr Accounts Payable, the same three-line shape a Sales Invoice
-- already has (Dr AR / Cr Sales / Cr Output Tax), just mirrored.
--
-- COGS and INVENTORY cover the sale's cost side (Dr COGS / Cr Inventory),
-- which pkg_posting does not post yet — these are config slots for when that
-- gets wired, the same way SALES/OUTPUT_TAX sat unused until this screen
-- existed. Nothing in pkg_posting is touched by this script.
--
-- Safe to re-run.
-- ============================================================================

SET DEFINE OFF

MERGE INTO default_account_role t
USING (SELECT 'COGS' c FROM dual) s ON (t.role_code = s.c)
WHEN NOT MATCHED THEN INSERT (role_code, role_name, description)
VALUES ('COGS', 'Cost of Goods Sold',
        'Debited for the item''s weighted-average cost when a sale posts.');

MERGE INTO default_account_role t
USING (SELECT 'INVENTORY' c FROM dual) s ON (t.role_code = s.c)
WHEN NOT MATCHED THEN INSERT (role_code, role_name, description)
VALUES ('INVENTORY', 'Inventory / Stock in Trade',
        'Credited on a sale (cost leaving stock) and debited on a purchase invoice (stock received and invoiced).');

MERGE INTO default_account_role t
USING (SELECT 'INPUT_TAX' c FROM dual) s ON (t.role_code = s.c)
WHEN NOT MATCHED THEN INSERT (role_code, role_name, description)
VALUES ('INPUT_TAX', 'Input Sales Tax (Purchases)',
        'Debited for the recoverable tax amount when a purchase invoice posts.');

MERGE INTO default_account_role t
USING (SELECT 'PURCHASE_RETURN' c FROM dual) s ON (t.role_code = s.c)
WHEN NOT MATCHED THEN INSERT (role_code, role_name, description)
VALUES ('PURCHASE_RETURN', 'Purchase Returns & Allowances',
        'Credited for the net return amount when a purchase return posts.');

MERGE INTO default_account_role t
USING (SELECT 'CASH' c FROM dual) s ON (t.role_code = s.c)
WHEN NOT MATCHED THEN INSERT (role_code, role_name, description)
VALUES ('CASH', 'Cash on Hand',
        'Default cash account for a cash-settled sale (POS), used instead of the customer''s AR account.');

COMMIT;

-- ----------------------------------------------------------------------------
-- Dev seed: JTC's mappings. COGS, INVENTORY and CASH reuse accounts already
-- in the COA seed; INPUT_TAX and PURCHASE_RETURN need new posting accounts,
-- added the same way "Sales Returns & Allowances" was added earlier.
-- ----------------------------------------------------------------------------
DECLARE
  v_company_id NUMBER;
  v_ctrl_id    NUMBER;
  v_input_tax_coa_id NUMBER;
  v_pur_ret_coa_id   NUMBER;
  v_cogs_coa_id       NUMBER;
  v_inventory_coa_id  NUMBER;
  v_cash_coa_id       NUMBER;
BEGIN
  SELECT company_id INTO v_company_id FROM company WHERE company_code = 'JTC';

  -- "1-01-004 Tax Recoverable" (L3) > "1-01-004-0001 Input Sales Tax - FBR" (L4)
  BEGIN
    SELECT coa_id INTO v_input_tax_coa_id FROM coa
     WHERE company_id = v_company_id AND account_code = '1-01-004-0001';
  EXCEPTION WHEN NO_DATA_FOUND THEN
    SELECT coa_id INTO v_ctrl_id FROM coa
     WHERE company_id = v_company_id AND account_code = '1-01';

    INSERT INTO coa (company_id, account_code, account_name, parent_id,
                     account_level, account_nature, normal_side)
    VALUES (v_company_id, '1-01-004', 'Tax Recoverable', v_ctrl_id, 3, 'ASSET', 'D')
    RETURNING coa_id INTO v_input_tax_coa_id;

    INSERT INTO coa (company_id, account_code, account_name, parent_id,
                     account_level, account_nature, normal_side)
    VALUES (v_company_id, '1-01-004-0001', 'Input Sales Tax - FBR',
            v_input_tax_coa_id, 4, 'ASSET', 'D')
    RETURNING coa_id INTO v_input_tax_coa_id;
  END;

  -- "5-01-002 Purchase Returns & Allowances" (L3) > "5-01-002-0001" (L4),
  -- sibling of the existing "5-01-001 Cost of Goods Sold" node.
  BEGIN
    SELECT coa_id INTO v_pur_ret_coa_id FROM coa
     WHERE company_id = v_company_id AND account_code = '5-01-002-0001';
  EXCEPTION WHEN NO_DATA_FOUND THEN
    SELECT coa_id INTO v_ctrl_id FROM coa
     WHERE company_id = v_company_id AND account_code = '5-01';

    INSERT INTO coa (company_id, account_code, account_name, parent_id,
                     account_level, account_nature, normal_side)
    VALUES (v_company_id, '5-01-002', 'Purchase Returns & Allowances',
            v_ctrl_id, 3, 'EXPENSE', 'C')
    RETURNING coa_id INTO v_pur_ret_coa_id;

    INSERT INTO coa (company_id, account_code, account_name, parent_id,
                     account_level, account_nature, normal_side)
    VALUES (v_company_id, '5-01-002-0001', 'Purchase Returns - Trading',
            v_pur_ret_coa_id, 4, 'EXPENSE', 'C')
    RETURNING coa_id INTO v_pur_ret_coa_id;
  END;

  SELECT coa_id INTO v_cogs_coa_id FROM coa
   WHERE company_id = v_company_id AND account_code = '5-01-001-0001';
  SELECT coa_id INTO v_inventory_coa_id FROM coa
   WHERE company_id = v_company_id AND account_code = '1-01-002-0001';
  SELECT coa_id INTO v_cash_coa_id FROM coa
   WHERE company_id = v_company_id AND account_code = '1-01-003-0001';

  MERGE INTO company_default_account t
  USING (SELECT v_company_id c, 'COGS' r, v_cogs_coa_id a FROM dual) s
     ON (t.company_id = s.c AND t.role_code = s.r)
  WHEN MATCHED THEN UPDATE SET coa_id = s.a
  WHEN NOT MATCHED THEN INSERT (company_id, role_code, coa_id) VALUES (s.c, s.r, s.a);

  MERGE INTO company_default_account t
  USING (SELECT v_company_id c, 'INVENTORY' r, v_inventory_coa_id a FROM dual) s
     ON (t.company_id = s.c AND t.role_code = s.r)
  WHEN MATCHED THEN UPDATE SET coa_id = s.a
  WHEN NOT MATCHED THEN INSERT (company_id, role_code, coa_id) VALUES (s.c, s.r, s.a);

  MERGE INTO company_default_account t
  USING (SELECT v_company_id c, 'INPUT_TAX' r, v_input_tax_coa_id a FROM dual) s
     ON (t.company_id = s.c AND t.role_code = s.r)
  WHEN MATCHED THEN UPDATE SET coa_id = s.a
  WHEN NOT MATCHED THEN INSERT (company_id, role_code, coa_id) VALUES (s.c, s.r, s.a);

  MERGE INTO company_default_account t
  USING (SELECT v_company_id c, 'PURCHASE_RETURN' r, v_pur_ret_coa_id a FROM dual) s
     ON (t.company_id = s.c AND t.role_code = s.r)
  WHEN MATCHED THEN UPDATE SET coa_id = s.a
  WHEN NOT MATCHED THEN INSERT (company_id, role_code, coa_id) VALUES (s.c, s.r, s.a);

  MERGE INTO company_default_account t
  USING (SELECT v_company_id c, 'CASH' r, v_cash_coa_id a FROM dual) s
     ON (t.company_id = s.c AND t.role_code = s.r)
  WHEN MATCHED THEN UPDATE SET coa_id = s.a
  WHEN NOT MATCHED THEN INSERT (company_id, role_code, coa_id) VALUES (s.c, s.r, s.a);

  COMMIT;
END;
/

SELECT r.role_code, r.role_name, c.account_code, c.account_name
  FROM company_default_account cda
  JOIN default_account_role r ON r.role_code = cda.role_code
  JOIN coa c ON c.coa_id = cda.coa_id
  JOIN company co ON co.company_id = cda.company_id
 WHERE co.company_code = 'JTC'
 ORDER BY r.role_code;
