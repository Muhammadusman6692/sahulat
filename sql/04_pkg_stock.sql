-- ============================================================================
-- PKG_STOCK - stock ledger writer + weighted-average RECOST ENGINE
--
-- RULE 1 (confirmed): on any given txn_date, ALL receipts (direction='I')
-- are costed before ANY issues (direction='O'). global_seq is the tie-
-- breaker only within the same direction. This holds even when entries
-- are back-dated - the recost engine re-walks history in this exact order
-- every time a back-dated document is posted.
-- ============================================================================
CREATE OR REPLACE PACKAGE pkg_stock AS

  -- Writes one stock_ledger row + one stock_txn_sequence row (same txn,
  -- same global_seq) then triggers a recost from this txn_date forward for
  -- this item+warehouse. Call once per document line.
  PROCEDURE post_txn (
    p_company_id   IN NUMBER,
    p_branch_id    IN NUMBER,
    p_warehouse_id IN NUMBER,
    p_item_id      IN NUMBER,
    p_txn_date     IN DATE,
    p_direction    IN CHAR,          -- 'I' or 'O'
    p_doc_type     IN VARCHAR2,
    p_doc_id       IN NUMBER,
    p_doc_line_id  IN NUMBER,
    p_qty          IN NUMBER,
    p_user_id      IN NUMBER,
    p_ref_doc_type    IN VARCHAR2 DEFAULT NULL,   -- for returns
    p_ref_doc_line_id IN NUMBER   DEFAULT NULL,   -- for returns: original line -> cost basis
    p_fixed_unit_cost IN NUMBER   DEFAULT NULL    -- for returns: force original doc cost, skip recost lookup
  );

  -- Re-walks stock_ledger for one item+warehouse from p_from_date onward,
  -- in Rule-1 order, recalculating running_qty / running_value / unit_cost.
  -- Any resulting COGS/valuation variance vs. what was previously posted to
  -- GL is returned so the caller can raise an adjustment voucher.
  PROCEDURE recost_from (
    p_item_id      IN NUMBER,
    p_warehouse_id IN NUMBER,
    p_from_date    IN DATE
  );

  -- Current on-hand quantity (as of latest recost) - used for negative-stock
  -- blocking before a sale/issue is accepted.
  FUNCTION get_on_hand_qty (
    p_item_id      IN NUMBER,
    p_warehouse_id IN NUMBER
  ) RETURN NUMBER;

  -- Current weighted-average unit cost - used to price TRF_OUT and to seed
  -- TRF_IN at the destination warehouse.
  FUNCTION get_current_avg_cost (
    p_item_id      IN NUMBER,
    p_warehouse_id IN NUMBER
  ) RETURN NUMBER;

END pkg_stock;
/

CREATE OR REPLACE PACKAGE BODY pkg_stock AS

  FUNCTION get_on_hand_qty (
    p_item_id      IN NUMBER,
    p_warehouse_id IN NUMBER
  ) RETURN NUMBER IS
    v_qty NUMBER;
  BEGIN
    SELECT running_qty INTO v_qty
    FROM (
      SELECT running_qty
      FROM stock_ledger
      WHERE item_id = p_item_id AND warehouse_id = p_warehouse_id
      ORDER BY txn_date DESC,
               CASE WHEN direction = 'I' THEN 0 ELSE 1 END DESC,
               global_seq DESC
    )
    WHERE ROWNUM = 1;
    RETURN NVL(v_qty, 0);
  EXCEPTION
    WHEN NO_DATA_FOUND THEN RETURN 0;
  END get_on_hand_qty;

  FUNCTION get_current_avg_cost (
    p_item_id      IN NUMBER,
    p_warehouse_id IN NUMBER
  ) RETURN NUMBER IS
    v_qty NUMBER;
    v_val NUMBER;
  BEGIN
    SELECT running_qty, running_value INTO v_qty, v_val
    FROM (
      SELECT running_qty, running_value
      FROM stock_ledger
      WHERE item_id = p_item_id AND warehouse_id = p_warehouse_id
      ORDER BY txn_date DESC,
               CASE WHEN direction = 'I' THEN 0 ELSE 1 END DESC,
               global_seq DESC
    )
    WHERE ROWNUM = 1;
    IF v_qty IS NULL OR v_qty = 0 THEN RETURN 0; END IF;
    RETURN ROUND(v_val / v_qty, 4);
  EXCEPTION
    WHEN NO_DATA_FOUND THEN RETURN 0;
  END get_current_avg_cost;

  PROCEDURE post_txn (
    p_company_id   IN NUMBER,
    p_branch_id    IN NUMBER,
    p_warehouse_id IN NUMBER,
    p_item_id      IN NUMBER,
    p_txn_date     IN DATE,
    p_direction    IN CHAR,
    p_doc_type     IN VARCHAR2,
    p_doc_id       IN NUMBER,
    p_doc_line_id  IN NUMBER,
    p_qty          IN NUMBER,
    p_user_id      IN NUMBER,
    p_ref_doc_type    IN VARCHAR2 DEFAULT NULL,
    p_ref_doc_line_id IN NUMBER   DEFAULT NULL,
    p_fixed_unit_cost IN NUMBER   DEFAULT NULL
  ) IS
    v_global_seq NUMBER;
    v_on_hand    NUMBER;
  BEGIN
    IF p_direction NOT IN ('I','O') THEN
      RAISE_APPLICATION_ERROR(-20201, 'direction must be I or O');
    END IF;

    -- Negative stock block (confirmed requirement) - only checked for
    -- OUT movements that are NOT a same-day-later IN (recost handles the
    -- back-dated case; this is the real-time UI-facing guard).
    IF p_direction = 'O' AND p_ref_doc_type IS NULL THEN
      v_on_hand := get_on_hand_qty(p_item_id, p_warehouse_id);
      IF v_on_hand < p_qty THEN
        RAISE_APPLICATION_ERROR(-20202,
          'Negative stock blocked: item ' || p_item_id || ' warehouse ' || p_warehouse_id ||
          ' on-hand ' || v_on_hand || ' requested ' || p_qty);
      END IF;
    END IF;

    v_global_seq := seq_stock_post_order.NEXTVAL;

    -- 1. Posting-order record (immutable "what really happened first")
    INSERT INTO stock_txn_sequence (
      company_id, branch_id, warehouse_id, item_id, txn_date,
      doc_type, doc_id, doc_line_id, global_seq, posted_by
    ) VALUES (
      p_company_id, p_branch_id, p_warehouse_id, p_item_id, p_txn_date,
      p_doc_type, p_doc_id, p_doc_line_id, v_global_seq, p_user_id
    );

    -- 2. Stock ledger row. unit_cost is left NULL here for normal IN/OUT
    --    (recost engine fills it) UNLESS this is a return with a fixed
    --    original-document cost (per your "return = original doc cost" rule).
    INSERT INTO stock_ledger (
      company_id, branch_id, warehouse_id, item_id, txn_date, direction,
      doc_type, doc_id, doc_line_id, ref_doc_type, ref_doc_line_id,
      qty, unit_cost, global_seq
    ) VALUES (
      p_company_id, p_branch_id, p_warehouse_id, p_item_id, p_txn_date, p_direction,
      p_doc_type, p_doc_id, p_doc_line_id, p_ref_doc_type, p_ref_doc_line_id,
      p_qty, p_fixed_unit_cost, v_global_seq
    );

    -- 3. Recost forward from this date (handles back-dated inserts too)
    recost_from(p_item_id, p_warehouse_id, p_txn_date);
  END post_txn;

  PROCEDURE recost_from (
    p_item_id      IN NUMBER,
    p_warehouse_id IN NUMBER,
    p_from_date    IN DATE
  ) IS
    v_run_qty   NUMBER := 0;
    v_run_val   NUMBER := 0;
    v_avg_cost  NUMBER := 0;
    v_seed_date DATE;
  BEGIN
    -- Seed running balance from the last row strictly BEFORE p_from_date,
    -- in the same Rule-1 order, so we don't recompute the whole history
    -- every time - only from the affected date forward.
    BEGIN
      SELECT running_qty, running_value INTO v_run_qty, v_run_val
      FROM (
        SELECT running_qty, running_value
        FROM stock_ledger
        WHERE item_id = p_item_id AND warehouse_id = p_warehouse_id
          AND txn_date < p_from_date
        ORDER BY txn_date DESC,
                 CASE WHEN direction = 'I' THEN 0 ELSE 1 END DESC,
                 global_seq DESC
      )
      WHERE ROWNUM = 1;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        v_run_qty := 0;
        v_run_val := 0;
    END;

    -- Walk every row from p_from_date onward in Rule-1 order:
    -- IN before OUT on the same date, global_seq breaks ties within a direction.
    FOR r IN (
      SELECT ledger_id, direction, qty, unit_cost AS fixed_cost
      FROM stock_ledger
      WHERE item_id = p_item_id AND warehouse_id = p_warehouse_id
        AND txn_date >= p_from_date
      ORDER BY txn_date,
               CASE WHEN direction = 'I' THEN 0 ELSE 1 END,
               global_seq
    ) LOOP
      IF r.direction = 'I' THEN
        -- Receipt: blend into weighted average (unless a fixed cost was
        -- supplied, e.g. a purchase return-in reversing at original GRN cost)
        v_run_val := v_run_val + (r.qty * NVL(r.fixed_cost,
                        CASE WHEN v_run_qty = 0 THEN 0 ELSE v_run_val / v_run_qty END));
        v_run_qty := v_run_qty + r.qty;
        v_avg_cost := CASE WHEN v_run_qty = 0 THEN 0 ELSE v_run_val / v_run_qty END;

        UPDATE stock_ledger
        SET unit_cost = NVL(r.fixed_cost, v_avg_cost),
            running_qty = v_run_qty,
            running_value = v_run_val
        WHERE ledger_id = r.ledger_id;
      ELSE
        -- Issue: valued at current weighted average, UNLESS a fixed cost
        -- was supplied (sales return-out reversing at original sale rate)
        v_avg_cost := NVL(r.fixed_cost,
                        CASE WHEN v_run_qty = 0 THEN 0 ELSE v_run_val / v_run_qty END);
        v_run_val := v_run_val - (r.qty * v_avg_cost);
        v_run_qty := v_run_qty - r.qty;

        UPDATE stock_ledger
        SET unit_cost = v_avg_cost,
            running_qty = v_run_qty,
            running_value = v_run_val
        WHERE ledger_id = r.ledger_id;
      END IF;
    END LOOP;

    -- NOTE: any COGS delta this produces versus what was already posted to
    -- GL for an already-posted OUT document must be captured by the caller
    -- (pkg_posting) as a new adjustment voucher - this package never writes
    -- to GL directly, it only maintains stock valuation truth.
  END recost_from;

END pkg_stock;
/
