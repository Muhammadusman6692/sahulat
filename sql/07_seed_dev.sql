-- ============================================================================
-- DEVELOPMENT SEED — minimum rows needed to sign in and exercise the app.
--
-- !! DEV ONLY !!  This creates a user with the well-known password Admin@123.
-- Do not run this against production, and change the password immediately if
-- this schema is ever exposed. Production users must be created through the
-- admin screens so the hash is generated in Node, never pasted from here.
--
-- Safe to re-run: every insert is guarded by an existence check.
-- ============================================================================

-- Literals below contain '&' (e.g. 'Roles & Permissions'). Without this, SQLcl
-- treats it as a substitution variable and cancels the block.
SET DEFINE OFF

-- ----------------------------------------------------------------------------
-- 1. MODULE VOCABULARY — the module_code values pkg_security checks against
-- ----------------------------------------------------------------------------
DECLARE
  PROCEDURE add_module (p_code VARCHAR2, p_name VARCHAR2, p_group VARCHAR2) IS
  BEGIN
    MERGE INTO module_function t
    USING (SELECT p_code AS c FROM dual) s
       ON (t.module_code = s.c)
    WHEN NOT MATCHED THEN
      INSERT (module_code, module_name, module_group)
      VALUES (p_code, p_name, p_group);
  END;
BEGIN
  add_module('SALES_INVOICE',    'Sales Invoice',        'TRADING');
  add_module('SALES_RETURN',     'Sales Return',         'TRADING');
  add_module('PURCHASE_ORDER',   'Purchase Order',       'TRADING');
  add_module('GRN',              'Goods Receipt Note',   'TRADING');
  add_module('PURCHASE_INVOICE', 'Purchase Invoice',     'TRADING');
  add_module('PURCHASE_RETURN',  'Purchase Return',      'TRADING');
  add_module('STOCK_TRANSFER',   'Stock Transfer',       'TRADING');
  add_module('POS_SALE',         'POS Sale',             'POS');
  add_module('POS_SHIFT',        'POS Shift / Z-Report', 'POS');
  add_module('DIST_ORDER',       'Distribution Order',   'DISTRIBUTION');
  add_module('DIST_DELIVERY',    'Delivery Confirmation','DISTRIBUTION');
  add_module('DIST_RECOVERY',    'Cash Recovery',        'DISTRIBUTION');
  add_module('GL_VOUCHER',       'GL Voucher',           'ACCOUNTING');
  add_module('PERIOD_CLOSE',     'Period Close',         'ACCOUNTING');
  add_module('COMPANY_MAINT',    'Companies',            'ADMIN');
  add_module('BRANCH_MAINT',     'Branches',             'ADMIN');
  add_module('WAREHOUSE_MAINT',  'Warehouses',           'ADMIN');
  add_module('COA_MAINT',        'Chart of Accounts',    'ADMIN');
  add_module('PARTY_MAINT',      'Parties',              'ADMIN');
  add_module('ITEM_MAINT',       'Items',                'ADMIN');
  add_module('TAX_MAINT',        'Tax Master',           'ADMIN');
  add_module('USER_MAINT',       'Users',                'ADMIN');
  add_module('ROLE_MAINT',       'Roles & Permissions',  'ADMIN');
  add_module('NUMBERING_MAINT',  'Numbering Series',     'ADMIN');
  COMMIT;
END;
/

-- ----------------------------------------------------------------------------
-- 2. COMPANY / BRANCH / WAREHOUSE / UOM / TAX
-- ----------------------------------------------------------------------------
DECLARE
  v_company_id   NUMBER;
  v_branch_id    NUMBER;
  v_warehouse_id NUMBER;
  v_fy_id        NUMBER;
  v_authority    VARCHAR2(10) := 'FBR';
BEGIN
  BEGIN
    SELECT company_id INTO v_company_id FROM company WHERE company_code = 'JTC';
  EXCEPTION WHEN NO_DATA_FOUND THEN
    INSERT INTO company (company_code, company_name, ntn_no, strn_no, address,
                         fy_start_month, base_currency)
    VALUES ('JTC', 'Jahangir Trading Co.', '3520112-8', '17-00-9902-441-19',
            'Badami Bagh, Lahore', 7, 'PKR')
    RETURNING company_id INTO v_company_id;
  END;

  BEGIN
    SELECT branch_id INTO v_branch_id
      FROM branch WHERE company_id = v_company_id AND branch_code = 'LHR';
  EXCEPTION WHEN NO_DATA_FOUND THEN
    INSERT INTO branch (company_id, branch_code, branch_name, address)
    VALUES (v_company_id, 'LHR', 'Lahore - Badami Bagh', 'Badami Bagh, Lahore')
    RETURNING branch_id INTO v_branch_id;
  END;

  BEGIN
    SELECT warehouse_id INTO v_warehouse_id
      FROM warehouse WHERE company_id = v_company_id AND warehouse_code = 'MAIN';
  EXCEPTION WHEN NO_DATA_FOUND THEN
    INSERT INTO warehouse (company_id, branch_id, warehouse_code, warehouse_name)
    VALUES (v_company_id, v_branch_id, 'MAIN', 'Main Store')
    RETURNING warehouse_id INTO v_warehouse_id;
  END;

  MERGE INTO branch_warehouse t
  USING (SELECT v_branch_id AS b, v_warehouse_id AS w FROM dual) s
     ON (t.branch_id = s.b AND t.warehouse_id = s.w)
  WHEN NOT MATCHED THEN INSERT (branch_id, warehouse_id) VALUES (s.b, s.w);

  -- Fiscal year 2026-27 (July..June) plus its twelve periods
  BEGIN
    SELECT fy_id INTO v_fy_id
      FROM fiscal_year WHERE company_id = v_company_id AND fy_name = 'FY2026-27';
  EXCEPTION WHEN NO_DATA_FOUND THEN
    INSERT INTO fiscal_year (company_id, fy_name, start_date, end_date, status)
    VALUES (v_company_id, 'FY2026-27', DATE '2026-07-01', DATE '2027-06-30', 'OPEN')
    RETURNING fy_id INTO v_fy_id;

    FOR i IN 1 .. 12 LOOP
      INSERT INTO fiscal_period (fy_id, period_no, start_date, end_date, status)
      VALUES (v_fy_id, i,
              ADD_MONTHS(DATE '2026-07-01', i - 1),
              LAST_DAY(ADD_MONTHS(DATE '2026-07-01', i - 1)),
              'OPEN');
    END LOOP;
  END;

  -- Numbering series
  MERGE INTO numbering_series t
  USING (SELECT v_company_id AS c, v_branch_id AS b, 'SINV' AS d FROM dual) s
     ON (t.company_id = s.c AND NVL(t.branch_id,-1) = s.b
         AND NVL(t.terminal_id,-1) = -1 AND t.doc_type = s.d)
  WHEN NOT MATCHED THEN
    INSERT (company_id, branch_id, doc_type, prefix, next_number, pad_length, fy_id)
    VALUES (s.c, s.b, 'SINV', 'SINV-', 1, 6, v_fy_id);

  MERGE INTO numbering_series t
  USING (SELECT v_company_id AS c, v_branch_id AS b, 'SRET' AS d FROM dual) s
     ON (t.company_id = s.c AND NVL(t.branch_id,-1) = s.b
         AND NVL(t.terminal_id,-1) = -1 AND t.doc_type = s.d)
  WHEN NOT MATCHED THEN
    INSERT (company_id, branch_id, doc_type, prefix, next_number, pad_length, fy_id)
    VALUES (s.c, s.b, 'SRET', 'SRET-', 1, 6, v_fy_id);

  MERGE INTO numbering_series t
  USING (SELECT v_company_id AS c, v_branch_id AS b, 'JV' AS d FROM dual) s
     ON (t.company_id = s.c AND NVL(t.branch_id,-1) = s.b
         AND NVL(t.terminal_id,-1) = -1 AND t.doc_type = s.d)
  WHEN NOT MATCHED THEN
    INSERT (company_id, branch_id, doc_type, prefix, next_number, pad_length, fy_id)
    VALUES (s.c, s.b, 'JV', 'JV-', 1, 6, v_fy_id);

  -- Units of measure
  MERGE INTO uom t USING (SELECT 'PCS' c FROM dual) s ON (t.uom_code = s.c)
  WHEN NOT MATCHED THEN INSERT (uom_code, uom_name, allow_decimal) VALUES ('PCS','Pieces','N');
  MERGE INTO uom t USING (SELECT 'BAG' c FROM dual) s ON (t.uom_code = s.c)
  WHEN NOT MATCHED THEN INSERT (uom_code, uom_name, allow_decimal) VALUES ('BAG','Bag','N');
  MERGE INTO uom t USING (SELECT 'CTN' c FROM dual) s ON (t.uom_code = s.c)
  WHEN NOT MATCHED THEN INSERT (uom_code, uom_name, allow_decimal) VALUES ('CTN','Carton','N');
  MERGE INTO uom t USING (SELECT 'KG' c FROM dual) s ON (t.uom_code = s.c)
  WHEN NOT MATCHED THEN INSERT (uom_code, uom_name, allow_decimal) VALUES ('KG','Kilogram','Y');
  MERGE INTO uom t USING (SELECT 'LTR' c FROM dual) s ON (t.uom_code = s.c)
  WHEN NOT MATCHED THEN INSERT (uom_code, uom_name, allow_decimal) VALUES ('LTR','Litre','Y');

  -- Tax authorities and one GST rate
  MERGE INTO tax_authority t USING (SELECT 'FBR' c FROM dual) s ON (t.authority_code = s.c)
  WHEN NOT MATCHED THEN INSERT (authority_code, authority_name)
  VALUES ('FBR','Federal Board of Revenue');
  MERGE INTO tax_authority t USING (SELECT 'PRA' c FROM dual) s ON (t.authority_code = s.c)
  WHEN NOT MATCHED THEN INSERT (authority_code, authority_name)
  VALUES ('PRA','Punjab Revenue Authority');
  MERGE INTO tax_authority t USING (SELECT 'SRB' c FROM dual) s ON (t.authority_code = s.c)
  WHEN NOT MATCHED THEN INSERT (authority_code, authority_name)
  VALUES ('SRB','Sindh Revenue Board');

  MERGE INTO tax_master t
  USING (SELECT v_company_id AS c, 'GST-18' AS tc FROM dual) s
     ON (t.company_id = s.c AND t.tax_code = s.tc)
  WHEN NOT MATCHED THEN
    INSERT (company_id, authority_code, tax_code, tax_name, tax_rate, tax_type)
    VALUES (s.c, v_authority, 'GST-18', 'Sales Tax 18%', 18.000, 'SALES_TAX');

  MERGE INTO tax_master t
  USING (SELECT v_company_id AS c, 'EXEMPT' AS tc FROM dual) s
     ON (t.company_id = s.c AND t.tax_code = s.tc)
  WHEN NOT MATCHED THEN
    INSERT (company_id, authority_code, tax_code, tax_name, tax_rate, tax_type)
    VALUES (s.c, v_authority, 'EXEMPT', 'Exempt / Zero rated', 0.000, 'SALES_TAX');

  COMMIT;
END;
/

-- ----------------------------------------------------------------------------
-- 3. ROLES, PERMISSIONS, USER, SCOPE
-- ----------------------------------------------------------------------------
DECLARE
  v_company_id NUMBER;
  v_branch_id  NUMBER;
  v_admin_role NUMBER;
  v_acct_role  NUMBER;
  v_user_id    NUMBER;
  -- bcrypt hash of Admin@123, cost 10. DEV ONLY.
  c_hash CONSTANT VARCHAR2(200) :=
    '$2b$10$hdUX7IC8D4.KvueshVMpuuyIJUxCwx0uWMcmoB2cxIYWSdaaA82Aq';
BEGIN
  SELECT company_id INTO v_company_id FROM company WHERE company_code = 'JTC';
  SELECT branch_id  INTO v_branch_id
    FROM branch WHERE company_id = v_company_id AND branch_code = 'LHR';

  -- Super Admin: global role (company_id NULL), everything allowed
  BEGIN
    SELECT role_id INTO v_admin_role
      FROM role WHERE company_id IS NULL AND role_name = 'Super Admin';
  EXCEPTION WHEN NO_DATA_FOUND THEN
    INSERT INTO role (company_id, role_name) VALUES (NULL, 'Super Admin')
    RETURNING role_id INTO v_admin_role;
  END;

  INSERT INTO role_permission (role_id, module_code, can_view, can_create,
                               can_edit, can_post, can_cancel, can_print, can_approve)
  SELECT v_admin_role, m.module_code, 'Y','Y','Y','Y','Y','Y','Y'
    FROM module_function m
   WHERE NOT EXISTS (SELECT 1 FROM role_permission rp
                      WHERE rp.role_id = v_admin_role
                        AND rp.module_code = m.module_code);

  -- Branch Accountant: the subset shown in the UI mockup
  BEGIN
    SELECT role_id INTO v_acct_role
      FROM role WHERE company_id = v_company_id AND role_name = 'Branch Accountant';
  EXCEPTION WHEN NO_DATA_FOUND THEN
    INSERT INTO role (company_id, role_name) VALUES (v_company_id, 'Branch Accountant')
    RETURNING role_id INTO v_acct_role;
  END;

  INSERT INTO role_permission (role_id, module_code, can_view, can_create,
                               can_edit, can_post, can_cancel, can_print, can_approve)
  SELECT v_acct_role, m.module_code,
         'Y',
         CASE WHEN m.module_code IN ('SALES_INVOICE','SALES_RETURN','GRN',
                                     'STOCK_TRANSFER','GL_VOUCHER') THEN 'Y' ELSE 'N' END,
         CASE WHEN m.module_code IN ('SALES_INVOICE','GRN','GL_VOUCHER') THEN 'Y' ELSE 'N' END,
         CASE WHEN m.module_code IN ('SALES_INVOICE','SALES_RETURN','GRN',
                                     'GL_VOUCHER') THEN 'Y' ELSE 'N' END,
         CASE WHEN m.module_code = 'GL_VOUCHER' THEN 'Y' ELSE 'N' END,
         'Y',
         'N'
    FROM module_function m
   WHERE m.module_group IN ('TRADING','ACCOUNTING')
     AND NOT EXISTS (SELECT 1 FROM role_permission rp
                      WHERE rp.role_id = v_acct_role
                        AND rp.module_code = m.module_code);

  -- The developer's own login
  BEGIN
    SELECT user_id INTO v_user_id FROM app_user WHERE username = 'usman';
  EXCEPTION WHEN NO_DATA_FOUND THEN
    INSERT INTO app_user (username, password_hash, full_name, email)
    VALUES ('usman', c_hash, 'Muhammad Usman', 'mianusman1430@gmail.com')
    RETURNING user_id INTO v_user_id;
  END;

  MERGE INTO user_role t
  USING (SELECT v_user_id AS u, v_admin_role AS r FROM dual) s
     ON (t.user_id = s.u AND t.role_id = s.r)
  WHEN NOT MATCHED THEN INSERT (user_id, role_id) VALUES (s.u, s.r);

  -- A deliberately restricted second login, so permission gating can be tested
  -- against something other than a role that is allowed everything. Branch
  -- Accountant has no ADMIN modules at all, so /admin/* must be refused.
  DECLARE
    v_acct_user NUMBER;
  BEGIN
    BEGIN
      SELECT user_id INTO v_acct_user FROM app_user WHERE username = 'accountant';
    EXCEPTION WHEN NO_DATA_FOUND THEN
      INSERT INTO app_user (username, password_hash, full_name)
      VALUES ('accountant', c_hash, 'Ayesha Khan')
      RETURNING user_id INTO v_acct_user;
    END;

    MERGE INTO user_role t
    USING (SELECT v_acct_user AS u, v_acct_role AS r FROM dual) s
       ON (t.user_id = s.u AND t.role_id = s.r)
    WHEN NOT MATCHED THEN INSERT (user_id, role_id) VALUES (s.u, s.r);

    MERGE INTO user_company_access t
    USING (SELECT v_acct_user AS u, v_company_id AS c, v_branch_id AS b FROM dual) s
       ON (t.user_id = s.u AND t.company_id = s.c AND t.branch_id = s.b
           AND t.warehouse_id IS NULL)
    WHEN NOT MATCHED THEN
      INSERT (user_id, company_id, branch_id, warehouse_id)
      VALUES (s.u, s.c, s.b, NULL);
  END;

  -- Scope: whole company, all branches and warehouses (NULLs mean unrestricted)
  MERGE INTO user_company_access t
  USING (SELECT v_user_id AS u, v_company_id AS c FROM dual) s
     ON (t.user_id = s.u AND t.company_id = s.c
         AND t.branch_id IS NULL AND t.warehouse_id IS NULL)
  WHEN NOT MATCHED THEN
    INSERT (user_id, company_id, branch_id, warehouse_id)
    VALUES (s.u, s.c, NULL, NULL);

  COMMIT;
END;
/

-- ----------------------------------------------------------------------------
-- 4. VERIFY
-- ----------------------------------------------------------------------------
SELECT u.username, u.full_name, r.role_name,
       (SELECT COUNT(*) FROM role_permission rp WHERE rp.role_id = r.role_id) AS perms
  FROM app_user u
  JOIN user_role ur ON ur.user_id = u.user_id
  JOIN role r       ON r.role_id  = ur.role_id;
