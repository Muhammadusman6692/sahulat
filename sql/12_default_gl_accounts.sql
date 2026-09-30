-- ============================================================================
-- DEFAULT GL ACCOUNTS — company_default_account config table
--
-- The known gap flagged in README.md: "which COA account is 'Sales', 'Output
-- Tax', etc. for auto-posting". role_code is a small, fixed reference list
-- (like module_function), not something an end user creates — so this ships
-- as a DDL + seed script, and the admin screen only edits the coa_id mapping
-- per company, not the role list itself.
--
-- Safe to re-run.
-- ============================================================================

SET DEFINE OFF

CREATE TABLE default_account_role (
  role_code   VARCHAR2(30) PRIMARY KEY,
  role_name   VARCHAR2(200) NOT NULL,
  description VARCHAR2(400)
);

CREATE TABLE company_default_account (
  default_id  NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id  NUMBER NOT NULL REFERENCES company(company_id),
  role_code   VARCHAR2(30) NOT NULL REFERENCES default_account_role(role_code),
  coa_id      NUMBER NOT NULL REFERENCES coa(coa_id),
  CONSTRAINT uq_company_default_account UNIQUE (company_id, role_code)
);

-- ----------------------------------------------------------------------------
-- Roles wired into pkg_posting today. Only these three: post_sales_invoice's
-- commented-out lines needed SALES and OUTPUT_TAX; post_sales_return's
-- reversal needed SALES_RETURN (sales_return_hdr carries only net_amt, no
-- tax breakdown, so the reversal is genuinely a two-line entry, not three).
-- More roles (COGS, INVENTORY, WITHHOLDING_TAX, ...) get added when the
-- posting paths that need them are built — not speculatively now.
-- ----------------------------------------------------------------------------
MERGE INTO default_account_role t
USING (SELECT 'SALES' c FROM dual) s ON (t.role_code = s.c)
WHEN NOT MATCHED THEN INSERT (role_code, role_name, description)
VALUES ('SALES', 'Sales Revenue',
        'Credited for the tax-exclusive amount when a sales invoice posts.');

MERGE INTO default_account_role t
USING (SELECT 'OUTPUT_TAX' c FROM dual) s ON (t.role_code = s.c)
WHEN NOT MATCHED THEN INSERT (role_code, role_name, description)
VALUES ('OUTPUT_TAX', 'Output Sales Tax',
        'Credited for the tax amount when a sales invoice posts.');

MERGE INTO default_account_role t
USING (SELECT 'SALES_RETURN' c FROM dual) s ON (t.role_code = s.c)
WHEN NOT MATCHED THEN INSERT (role_code, role_name, description)
VALUES ('SALES_RETURN', 'Sales Returns & Allowances',
        'Debited for the net return amount when a sales return posts.');

COMMIT;

-- ----------------------------------------------------------------------------
-- Dev seed: JTC's mappings, using existing COA rows for SALES/OUTPUT_TAX and
-- adding the "Sales Returns" posting account the earlier COA seed omitted.
-- ----------------------------------------------------------------------------
DECLARE
  v_company_id NUMBER;
  v_sales_ctrl_id NUMBER;
  v_ret_coa_id NUMBER;
  v_sales_coa_id NUMBER;
  v_tax_coa_id NUMBER;
BEGIN
  SELECT company_id INTO v_company_id FROM company WHERE company_code = 'JTC';

  -- Add "4-01-002 Sales Returns & Allowances" (L3) and its posting child
  -- "4-01-002-0001" (L4), siblings of the existing "4-01-001 Sales" node.
  BEGIN
    SELECT coa_id INTO v_ret_coa_id FROM coa
     WHERE company_id = v_company_id AND account_code = '4-01-002-0001';
  EXCEPTION WHEN NO_DATA_FOUND THEN
    SELECT coa_id INTO v_sales_ctrl_id FROM coa
     WHERE company_id = v_company_id AND account_code = '4-01';

    INSERT INTO coa (company_id, account_code, account_name, parent_id,
                     account_level, account_nature, normal_side)
    VALUES (v_company_id, '4-01-002', 'Sales Returns & Allowances',
            v_sales_ctrl_id, 3, 'INCOME', 'D')
    RETURNING coa_id INTO v_ret_coa_id;  -- reused below as the L3 id first

    INSERT INTO coa (company_id, account_code, account_name, parent_id,
                     account_level, account_nature, normal_side)
    VALUES (v_company_id, '4-01-002-0001', 'Sales Returns - Trading',
            v_ret_coa_id, 4, 'INCOME', 'D')
    RETURNING coa_id INTO v_ret_coa_id;  -- now the L4 posting id
  END;

  SELECT coa_id INTO v_sales_coa_id FROM coa
   WHERE company_id = v_company_id AND account_code = '4-01-001-0001';
  SELECT coa_id INTO v_tax_coa_id FROM coa
   WHERE company_id = v_company_id AND account_code = '2-01-002-0001';

  MERGE INTO company_default_account t
  USING (SELECT v_company_id c, 'SALES' r, v_sales_coa_id a FROM dual) s
     ON (t.company_id = s.c AND t.role_code = s.r)
  WHEN MATCHED THEN UPDATE SET coa_id = s.a
  WHEN NOT MATCHED THEN INSERT (company_id, role_code, coa_id)
    VALUES (s.c, s.r, s.a);

  MERGE INTO company_default_account t
  USING (SELECT v_company_id c, 'OUTPUT_TAX' r, v_tax_coa_id a FROM dual) s
     ON (t.company_id = s.c AND t.role_code = s.r)
  WHEN MATCHED THEN UPDATE SET coa_id = s.a
  WHEN NOT MATCHED THEN INSERT (company_id, role_code, coa_id)
    VALUES (s.c, s.r, s.a);

  MERGE INTO company_default_account t
  USING (SELECT v_company_id c, 'SALES_RETURN' r, v_ret_coa_id a FROM dual) s
     ON (t.company_id = s.c AND t.role_code = s.r)
  WHEN MATCHED THEN UPDATE SET coa_id = s.a
  WHEN NOT MATCHED THEN INSERT (company_id, role_code, coa_id)
    VALUES (s.c, s.r, s.a);

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
