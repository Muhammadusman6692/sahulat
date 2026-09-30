-- ============================================================================
-- PARTY MASTER — AR/AP control-parent roles
--
-- Party Master auto-creates a level-4 ledger account for every customer and
-- supplier the first time it is saved (Dr/Cr control sub-account, named after
-- the party, under the company's receivable/payable control parent). These
-- two roles tell the app which level-1..3 COA node is that parent for a given
-- company — set on the Default GL Accounts screen, same mechanism the other
-- posting roles already use, just pointing at a non-postable parent instead
-- of a level-4 posting account.
--
-- Safe to re-run.
-- ============================================================================

SET DEFINE OFF

MERGE INTO default_account_role t
USING (SELECT 'AR_CONTROL' c FROM dual) s ON (t.role_code = s.c)
WHEN NOT MATCHED THEN INSERT (role_code, role_name, description)
VALUES ('AR_CONTROL', 'Accounts Receivable — Control Parent',
        'Parent account (level 1-3) under which Party Master creates each customer''s own ledger account automatically.');

MERGE INTO default_account_role t
USING (SELECT 'AP_CONTROL' c FROM dual) s ON (t.role_code = s.c)
WHEN NOT MATCHED THEN INSERT (role_code, role_name, description)
VALUES ('AP_CONTROL', 'Accounts Payable — Control Parent',
        'Parent account (level 1-3) under which Party Master creates each supplier''s own ledger account automatically.');

COMMIT;

-- ----------------------------------------------------------------------------
-- Dev seed: JTC already has "Trade Debtors" / "Trade Creditors" from the COA
-- seed (sql/11_seed_coa_dev.sql) — point the two new roles at them.
-- ----------------------------------------------------------------------------
DECLARE
  v_company_id NUMBER;
  v_ar_coa_id  NUMBER;
  v_ap_coa_id  NUMBER;
BEGIN
  SELECT company_id INTO v_company_id FROM company WHERE company_code = 'JTC';

  SELECT coa_id INTO v_ar_coa_id FROM coa
   WHERE company_id = v_company_id AND account_code = '1-01-001';
  SELECT coa_id INTO v_ap_coa_id FROM coa
   WHERE company_id = v_company_id AND account_code = '2-01-001';

  MERGE INTO company_default_account t
  USING (SELECT v_company_id c, 'AR_CONTROL' r, v_ar_coa_id a FROM dual) s
     ON (t.company_id = s.c AND t.role_code = s.r)
  WHEN MATCHED THEN UPDATE SET coa_id = s.a
  WHEN NOT MATCHED THEN INSERT (company_id, role_code, coa_id) VALUES (s.c, s.r, s.a);

  MERGE INTO company_default_account t
  USING (SELECT v_company_id c, 'AP_CONTROL' r, v_ap_coa_id a FROM dual) s
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
   AND r.role_code IN ('AR_CONTROL', 'AP_CONTROL')
 ORDER BY r.role_code;
