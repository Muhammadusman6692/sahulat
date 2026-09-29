-- ============================================================================
-- DEVELOPMENT SEED — opening stock
--
-- Posts one opening receipt per item through pkg_stock.post_txn so the stock
-- ledger, the posting-order sequence and the weighted-average recost engine are
-- all exercised, rather than rows being inserted behind the package's back.
--
-- Opening cost is set at 72% of the current sale price, which is only a
-- plausible trading margin for development data.
--
-- Re-running adds another receipt layer, so it is guarded: it does nothing if
-- any ADJ_IN opening stock already exists.
-- ============================================================================

SET DEFINE OFF

DECLARE
  v_company_id   NUMBER;
  v_branch_id    NUMBER;
  v_warehouse_id NUMBER;
  v_user_id      NUMBER;
  v_existing     NUMBER;
  v_doc_id       NUMBER := 1;
  v_line         NUMBER := 0;
  v_cost         NUMBER;
  v_qty          NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_existing
    FROM stock_ledger WHERE doc_type = 'ADJ_IN';
  IF v_existing > 0 THEN
    DBMS_OUTPUT.PUT_LINE('Opening stock already posted - nothing to do.');
    RETURN;
  END IF;

  SELECT company_id INTO v_company_id FROM company WHERE company_code = 'JTC';
  SELECT branch_id INTO v_branch_id
    FROM branch WHERE company_id = v_company_id AND branch_code = 'LHR';
  SELECT warehouse_id INTO v_warehouse_id
    FROM warehouse WHERE company_id = v_company_id AND warehouse_code = 'MAIN';
  SELECT user_id INTO v_user_id FROM app_user WHERE username = 'usman';

  FOR r IN (
    SELECT i.item_id, i.reorder_level,
           (SELECT ip.sale_price
              FROM item_price ip
             WHERE ip.item_id = i.item_id
             ORDER BY ip.effective_from DESC
             FETCH FIRST 1 ROW ONLY) AS sale_price
      FROM item i
     WHERE i.company_id = v_company_id
       AND i.active_yn = 'Y'
     ORDER BY i.item_code
  ) LOOP
    v_line := v_line + 1;

    -- Roughly three times the reorder level, so most items sit comfortably
    -- above it and a couple deliberately do not.
    v_qty  := GREATEST(ROUND(NVL(r.reorder_level, 0) * 3), 10);
    v_cost := ROUND(NVL(r.sale_price, 100) * 0.72, 4);

    pkg_stock.post_txn(
      p_company_id      => v_company_id,
      p_branch_id       => v_branch_id,
      p_warehouse_id    => v_warehouse_id,
      p_item_id         => r.item_id,
      p_txn_date        => DATE '2026-07-01',
      p_direction       => 'I',
      p_doc_type        => 'ADJ_IN',
      p_doc_id          => v_doc_id,
      p_doc_line_id     => v_line,
      p_qty             => v_qty,
      p_user_id         => v_user_id,
      p_fixed_unit_cost => v_cost
    );
  END LOOP;

  COMMIT;
END;
/

-- Verify the recost engine populated cost and running balances.
SELECT i.item_code,
       sl.qty,
       sl.unit_cost,
       sl.running_qty,
       sl.running_value
  FROM stock_ledger sl
  JOIN item i ON i.item_id = sl.item_id
 ORDER BY i.item_code
 FETCH FIRST 6 ROWS ONLY;
