-- ============================================================================
-- DEVELOPMENT SEED — item catalogue
--
-- Illustrative FMCG trading catalogue so the Items screen, stock screens and
-- invoice line pickers have something real to work against. Safe to re-run.
-- Depends on 07_seed_dev.sql (company, UOM and tax rows).
-- ============================================================================

SET DEFINE OFF

DECLARE
  v_company_id NUMBER;
  v_gst        NUMBER;
  v_exempt     NUMBER;

  FUNCTION category_id (p_name VARCHAR2) RETURN NUMBER IS
    v_id NUMBER;
  BEGIN
    SELECT category_id INTO v_id
      FROM item_category
     WHERE company_id = v_company_id AND category_name = p_name;
    RETURN v_id;
  EXCEPTION WHEN NO_DATA_FOUND THEN
    INSERT INTO item_category (company_id, category_name)
    VALUES (v_company_id, p_name)
    RETURNING category_id INTO v_id;
    RETURN v_id;
  END;

  FUNCTION brand_id (p_name VARCHAR2) RETURN NUMBER IS
    v_id NUMBER;
  BEGIN
    IF p_name IS NULL THEN RETURN NULL; END IF;
    SELECT b.brand_id INTO v_id
      FROM item_brand b
     WHERE b.company_id = v_company_id AND b.brand_name = p_name;
    RETURN v_id;
  EXCEPTION WHEN NO_DATA_FOUND THEN
    INSERT INTO item_brand (company_id, brand_name)
    VALUES (v_company_id, p_name)
    RETURNING brand_id INTO v_id;
    RETURN v_id;
  END;

  PROCEDURE add_item (
    p_code     VARCHAR2,
    p_name     VARCHAR2,
    p_category VARCHAR2,
    p_brand    VARCHAR2,
    p_uom      VARCHAR2,
    p_price    NUMBER,
    p_reorder  NUMBER,
    p_barcode  VARCHAR2 DEFAULT NULL,
    p_exempt   BOOLEAN  DEFAULT FALSE,
    p_active   VARCHAR2 DEFAULT 'Y'
  ) IS
    v_item_id  NUMBER;
    v_exists   NUMBER;
    v_tax_id   NUMBER;
    v_cat_id   NUMBER;
    v_brand_id NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_exists
      FROM item WHERE company_id = v_company_id AND item_code = p_code;
    IF v_exists > 0 THEN RETURN; END IF;

    -- All three are resolved before the INSERT: a PL/SQL BOOLEAN cannot appear
    -- inside a SQL statement, and a locally declared function cannot be called
    -- from one (PLS-00231).
    v_tax_id   := CASE WHEN p_exempt THEN v_exempt ELSE v_gst END;
    v_cat_id   := category_id(p_category);
    v_brand_id := brand_id(p_brand);

    INSERT INTO item (company_id, item_code, item_name, category_id, brand_id,
                      uom_code, barcode, reorder_level, tax_id, active_yn)
    VALUES (v_company_id, p_code, p_name, v_cat_id, v_brand_id,
            p_uom, p_barcode, p_reorder, v_tax_id, p_active)
    RETURNING item_id INTO v_item_id;

    -- Mandatory sale price, effective from the start of the fiscal year.
    INSERT INTO item_price (company_id, item_id, sale_price, effective_from)
    VALUES (v_company_id, v_item_id, p_price, DATE '2026-07-01');
  END;

BEGIN
  SELECT company_id INTO v_company_id FROM company WHERE company_code = 'JTC';
  SELECT tax_id INTO v_gst
    FROM tax_master WHERE company_id = v_company_id AND tax_code = 'GST-18';
  SELECT tax_id INTO v_exempt
    FROM tax_master WHERE company_id = v_company_id AND tax_code = 'EXEMPT';

  add_item('OIL-SUN-5L',  'Sunflower Cooking Oil 5L',        'Edible Oil',     'Sunshine',      'PCS', 1450,  100, '8964000101018');
  add_item('OIL-CAN-3L',  'Canola Cooking Oil 3L',           'Edible Oil',     'Sunshine',      'PCS',  980,  120, '8964000101025');
  add_item('GHE-BAN-1K',  'Banaspati Ghee 1kg',              'Edible Oil',     'Sunshine',      'PCS',  640,  250, '8964000101032');
  add_item('GHE-BAN-5K',  'Banaspati Ghee 5kg tin',          'Edible Oil',     'Sunshine',      'PCS', 3120,   60, '8964000101049');

  add_item('RIC-SK-25',   'Basmati Rice Super Kernel 25kg',  'Rice & Grains',  'Kernel Gold',   'BAG', 8750,   40, '8964000202017');
  add_item('RIC-SK-5',    'Basmati Rice Super Kernel 5kg',   'Rice & Grains',  'Kernel Gold',   'BAG', 1820,   90, '8964000202024');
  add_item('RIC-SEL-25',  'Sella Rice 25kg',                 'Rice & Grains',  'Kernel Gold',   'BAG', 7400,   30, '8964000202031');
  add_item('FLR-ATA-10',  'Wheat Flour Chakki Atta 10kg',    'Rice & Grains',  'Golden Harvest','BAG', 1250,  150, '8964000202048');
  add_item('LEN-MAS-1K',  'Masoor Lentils 1kg',              'Rice & Grains',  NULL,            'PCS',  380,  200, '8964000202055', p_exempt => TRUE);
  add_item('LEN-CHN-1K',  'Chana Daal 1kg',                  'Rice & Grains',  NULL,            'PCS',  340,  200, '8964000202062', p_exempt => TRUE);

  add_item('MLK-TP-1L-12','Tetra Pack Milk 1L - carton of 12','Dairy',         'Dairy Best',    'CTN', 2040,   60, '8964000303016');
  add_item('MLK-POW-900', 'Milk Powder 900g',                'Dairy',          'Dairy Best',    'PCS', 1560,   80, '8964000303023');
  add_item('BTR-SLT-200', 'Salted Butter 200g',              'Dairy',          'Dairy Best',    'PCS',  520,  100, '8964000303030');

  add_item('SUG-REF-50',  'Refined Sugar 50kg',              'Sugar',          NULL,            'BAG', 9300,   25, '8964000404015');
  add_item('SUG-REF-1K',  'Refined Sugar 1kg',               'Sugar',          NULL,            'PCS',  198,  300, '8964000404022');

  add_item('TEA-BLK-950', 'Black Tea Loose 950g',            'Beverages',      'Chai Ghar',     'PCS', 1190,  120, '8964000505014');
  add_item('TEA-BLK-475', 'Black Tea Loose 475g',            'Beverages',      'Chai Ghar',     'PCS',  620,  150, '8964000505021');
  add_item('SFT-COL-15',  'Soft Drink Cola 1.5L',            'Beverages',      'Sparkle',       'PCS',  220,  240, '8964000505038');
  add_item('SFT-COL-24',  'Soft Drink Cola 250ml x24',       'Beverages',      'Sparkle',       'CTN', 1680,   50, '8964000505045');

  add_item('SLT-IOD-800', 'Iodised Salt 800g',               'Grocery',        NULL,            'PCS',   65,  400, '8964000606013', p_exempt => TRUE);
  add_item('BIS-ASS-200', 'Assorted Biscuits 200g',          'Confectionery',  'Golden Harvest','PCS',   90,  500, '8964000707012');
  add_item('BIS-CHO-120', 'Chocolate Cream Biscuits 120g',   'Confectionery',  'Golden Harvest','PCS',   70,  500, '8964000707029');

  add_item('SOP-BTH-3',   'Bath Soap 3-pack',                'Home Care',      'Sparkle',       'PCS',  145,  260, '8964000808011');
  add_item('DTG-POW-1K',  'Detergent Powder 1kg',            'Home Care',      NULL,            'PCS',  310,    0, '8964000808028',
           p_active => 'N');

  COMMIT;
END;
/

SELECT (SELECT COUNT(*) FROM item)          AS items,
       (SELECT COUNT(*) FROM item_category) AS categories,
       (SELECT COUNT(*) FROM item_brand)    AS brands,
       (SELECT COUNT(*) FROM item_price)    AS prices
  FROM dual;
