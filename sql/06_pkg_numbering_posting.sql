-- ============================================================================
-- PKG_NUMBERING - document number generation, incl. terminal-specific series
-- for offline POS (your point 20)
-- ============================================================================
CREATE OR REPLACE PACKAGE pkg_numbering AS
  FUNCTION get_next_number (
    p_company_id  IN NUMBER,
    p_branch_id   IN NUMBER,
    p_terminal_id IN NUMBER,       -- NULL for non-POS documents
    p_doc_type    IN VARCHAR2
  ) RETURN VARCHAR2;
END pkg_numbering;
/

CREATE OR REPLACE PACKAGE BODY pkg_numbering AS
  FUNCTION get_next_number (
    p_company_id  IN NUMBER,
    p_branch_id   IN NUMBER,
    p_terminal_id IN NUMBER,
    p_doc_type    IN VARCHAR2
  ) RETURN VARCHAR2 IS
    v_next   NUMBER;
    v_prefix VARCHAR2(15);
    v_pad    NUMBER;
    v_no     VARCHAR2(30);
  BEGIN
    -- Row-level lock prevents two concurrent posts issuing the same number
    -- (critical at 50 POS terminals + 500 users hitting this concurrently)
    SELECT next_number, prefix, pad_length
    INTO v_next, v_prefix, v_pad
    FROM numbering_series
    WHERE company_id = p_company_id
      AND NVL(branch_id,-1) = NVL(p_branch_id,-1)
      AND NVL(terminal_id,-1) = NVL(p_terminal_id,-1)
      AND doc_type = p_doc_type
    FOR UPDATE;

    v_no := NVL(v_prefix,'') || LPAD(v_next, v_pad, '0');

    UPDATE numbering_series
    SET next_number = next_number + 1
    WHERE company_id = p_company_id
      AND NVL(branch_id,-1) = NVL(p_branch_id,-1)
      AND NVL(terminal_id,-1) = NVL(p_terminal_id,-1)
      AND doc_type = p_doc_type;

    RETURN v_no;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE_APPLICATION_ERROR(-20401,
        'No numbering series configured for company=' || p_company_id ||
        ' branch=' || p_branch_id || ' terminal=' || p_terminal_id ||
        ' doc_type=' || p_doc_type);
  END get_next_number;
END pkg_numbering;
/

-- ============================================================================
-- PKG_POSTING - orchestrates one business document into: stock_ledger +
-- stock_txn_sequence (via pkg_stock) + gl_voucher (via pkg_gl), inside a
-- single transaction. Example shown: post_sales_invoice. PO/GRN/Purchase
-- Invoice/Returns/Stock Transfer follow the identical shape.
--
-- Every procedure here:
--   1. calls pkg_security.check_permission + check_scope FIRST
--   2. does all stock/GL work
--   3. is the ONLY code path allowed to write to sales_inv_hdr.status,
--      stock_ledger, and gl_voucher_hdr - APEX/Next.js/ORDS never insert
--      into these directly.
-- ============================================================================
CREATE OR REPLACE PACKAGE pkg_posting AS

  -- Raises -20510 if the company has no mapping for p_role_code in
  -- company_default_account. Exposed on the package spec so the admin
  -- screen (or a future pre-posting check) can validate a company's setup
  -- without tripping the error mid-posting.
  FUNCTION get_default_account (
    p_company_id IN NUMBER,
    p_role_code  IN VARCHAR2
  ) RETURN NUMBER;

  PROCEDURE post_sales_invoice (
    p_inv_id  IN NUMBER,
    p_user_id IN NUMBER
  );

  PROCEDURE post_sales_return (
    p_ret_id  IN NUMBER,
    p_user_id IN NUMBER
  );

  PROCEDURE post_stock_transfer (
    p_transfer_id IN NUMBER,
    p_user_id     IN NUMBER
  );

END pkg_posting;
/

CREATE OR REPLACE PACKAGE BODY pkg_posting AS

  FUNCTION get_default_account (
    p_company_id IN NUMBER,
    p_role_code  IN VARCHAR2
  ) RETURN NUMBER IS
    v_coa_id NUMBER;
  BEGIN
    SELECT coa_id INTO v_coa_id
      FROM company_default_account
     WHERE company_id = p_company_id AND role_code = p_role_code;
    RETURN v_coa_id;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE_APPLICATION_ERROR(-20510,
        'No default GL account configured for role ' || p_role_code ||
        ' in company ' || p_company_id ||
        ' - set it on the Default GL Accounts screen before posting.');
  END get_default_account;

  PROCEDURE post_sales_invoice (
    p_inv_id  IN NUMBER,
    p_user_id IN NUMBER
  ) IS
    v_hdr        sales_inv_hdr%ROWTYPE;
    v_voucher_id NUMBER;
    v_ar_coa_id  NUMBER;
    v_sales_coa_id NUMBER;
    v_tax_coa_id NUMBER;
  BEGIN
    SELECT * INTO v_hdr FROM sales_inv_hdr WHERE inv_id = p_inv_id FOR UPDATE;

    IF v_hdr.status != 'DRAFT' THEN
      RAISE_APPLICATION_ERROR(-20501, 'Invoice is not in DRAFT status');
    END IF;

    -- 1. Permission + scope check (server-side, cannot be bypassed by direct API call)
    pkg_security.check_permission(p_user_id, 'SALES_INVOICE', 'POST');
    pkg_security.check_scope(p_user_id, v_hdr.company_id, v_hdr.branch_id, v_hdr.warehouse_id);

    -- 2. Stock ledger: one OUT movement per line (negative-stock check happens inside pkg_stock)
    FOR r IN (SELECT * FROM sales_inv_line WHERE inv_id = p_inv_id) LOOP
      pkg_stock.post_txn(
        p_company_id   => v_hdr.company_id,
        p_branch_id    => v_hdr.branch_id,
        p_warehouse_id => v_hdr.warehouse_id,
        p_item_id      => r.item_id,
        p_txn_date     => v_hdr.inv_date,
        p_direction    => 'O',
        p_doc_type     => 'SINV',
        p_doc_id       => v_hdr.inv_id,
        p_doc_line_id  => r.line_id,
        p_qty          => r.qty,
        p_user_id      => p_user_id
      );
    END LOOP;

    -- 3. GL: Dr Customer (AR control) / Cr Sales / Cr Output Tax
    SELECT ar_coa_id INTO v_ar_coa_id FROM party WHERE party_id = v_hdr.party_id;
    v_sales_coa_id := get_default_account(v_hdr.company_id, 'SALES');
    v_tax_coa_id   := get_default_account(v_hdr.company_id, 'OUTPUT_TAX');

    v_voucher_id := pkg_gl.create_voucher(
      p_company_id    => v_hdr.company_id,
      p_branch_id     => v_hdr.branch_id,
      p_voucher_type  => 'SINV',
      p_voucher_date  => v_hdr.inv_date,
      p_source_module => 'SALES_INVOICE',
      p_source_doc_id => v_hdr.inv_id,
      p_narration     => 'Sales Invoice ' || v_hdr.inv_no,
      p_user_id       => p_user_id
    );

    pkg_gl.add_line(v_voucher_id, v_ar_coa_id, p_debit => v_hdr.net_amt, p_party_id => v_hdr.party_id);

    -- pkg_gl.add_line raises if both debit and credit are zero, so a fully
    -- discounted line (gross = discount) or an all-exempt invoice (tax = 0)
    -- skips that line rather than erroring on a legitimate zero amount.
    IF v_hdr.gross_amt - v_hdr.discount_amt > 0 THEN
      pkg_gl.add_line(v_voucher_id, v_sales_coa_id, p_credit => v_hdr.gross_amt - v_hdr.discount_amt);
    END IF;
    IF v_hdr.tax_amt > 0 THEN
      pkg_gl.add_line(v_voucher_id, v_tax_coa_id, p_credit => v_hdr.tax_amt);
    END IF;

    pkg_gl.post_voucher(v_voucher_id, p_user_id);

    -- 4. Flip status
    UPDATE sales_inv_hdr
    SET status = 'POSTED', posted_by = p_user_id, posted_on = SYSTIMESTAMP
    WHERE inv_id = p_inv_id;
  END post_sales_invoice;

  PROCEDURE post_sales_return (
    p_ret_id  IN NUMBER,
    p_user_id IN NUMBER
  ) IS
    v_hdr sales_return_hdr%ROWTYPE;
    v_voucher_id NUMBER;
    v_ar_coa_id NUMBER;
    v_sales_return_coa_id NUMBER;
  BEGIN
    SELECT * INTO v_hdr FROM sales_return_hdr WHERE ret_id = p_ret_id FOR UPDATE;
    IF v_hdr.status != 'DRAFT' THEN
      RAISE_APPLICATION_ERROR(-20502, 'Return is not in DRAFT status');
    END IF;

    pkg_security.check_permission(p_user_id, 'SALES_RETURN', 'POST');
    pkg_security.check_scope(p_user_id, v_hdr.company_id, v_hdr.branch_id, v_hdr.warehouse_id);

    -- Stock IN, at ORIGINAL sale rate (your confirmed rule) - fixed_unit_cost
    -- forces the recost engine to use this exact cost rather than blend a
    -- new weighted average from current cost.
    FOR r IN (
      SELECT rl.*, sil.rate AS orig_rate
      FROM sales_return_line rl
      JOIN sales_inv_line sil ON sil.line_id = rl.orig_line_id
      WHERE rl.ret_id = p_ret_id
    ) LOOP
      pkg_stock.post_txn(
        p_company_id      => v_hdr.company_id,
        p_branch_id       => v_hdr.branch_id,
        p_warehouse_id    => v_hdr.warehouse_id,
        p_item_id         => r.item_id,
        p_txn_date        => v_hdr.ret_date,
        p_direction       => 'I',
        p_doc_type        => 'SRET',
        p_doc_id          => v_hdr.ret_id,
        p_doc_line_id     => r.line_id,
        p_qty             => r.qty,
        p_user_id         => p_user_id,
        p_ref_doc_type    => 'SINV',
        p_ref_doc_line_id => r.orig_line_id,
        p_fixed_unit_cost => r.orig_rate
      );
    END LOOP;

    UPDATE sales_return_hdr
    SET status = 'POSTED'
    WHERE ret_id = p_ret_id;

    -- GL reversal: Dr Sales Return / Cr Customer. sales_return_hdr carries
    -- only net_amt (no gross/discount/tax breakdown on the return itself),
    -- so this is genuinely a two-line entry, not a mirror of the invoice's
    -- three lines.
    IF v_hdr.net_amt > 0 THEN
      SELECT ar_coa_id INTO v_ar_coa_id FROM party WHERE party_id = v_hdr.party_id;
      v_sales_return_coa_id := get_default_account(v_hdr.company_id, 'SALES_RETURN');

      v_voucher_id := pkg_gl.create_voucher(
        p_company_id    => v_hdr.company_id,
        p_branch_id     => v_hdr.branch_id,
        p_voucher_type  => 'SRET',
        p_voucher_date  => v_hdr.ret_date,
        p_source_module => 'SALES_RETURN',
        p_source_doc_id => v_hdr.ret_id,
        p_narration     => 'Sales Return ' || v_hdr.ret_no,
        p_user_id       => p_user_id
      );

      pkg_gl.add_line(v_voucher_id, v_sales_return_coa_id, p_debit => v_hdr.net_amt);
      pkg_gl.add_line(v_voucher_id, v_ar_coa_id, p_credit => v_hdr.net_amt, p_party_id => v_hdr.party_id);

      pkg_gl.post_voucher(v_voucher_id, p_user_id);
    END IF;
  END post_sales_return;

  PROCEDURE post_stock_transfer (
    p_transfer_id IN NUMBER,
    p_user_id     IN NUMBER
  ) IS
    v_hdr stock_transfer_hdr%ROWTYPE;
    v_cost NUMBER;
  BEGIN
    SELECT * INTO v_hdr FROM stock_transfer_hdr WHERE transfer_id = p_transfer_id FOR UPDATE;
    IF v_hdr.status != 'DRAFT' THEN
      RAISE_APPLICATION_ERROR(-20503, 'Transfer is not in DRAFT status');
    END IF;

    pkg_security.check_permission(p_user_id, 'STOCK_TRANSFER', 'POST');
    pkg_security.check_scope(p_user_id, v_hdr.company_id, v_hdr.from_branch_id, v_hdr.from_warehouse_id);

    FOR r IN (SELECT * FROM stock_transfer_line WHERE transfer_id = p_transfer_id) LOOP
      -- Cost captured at the FROM warehouse's current weighted average
      v_cost := pkg_stock.get_current_avg_cost(r.item_id, v_hdr.from_warehouse_id);

      pkg_stock.post_txn(
        p_company_id => v_hdr.company_id, p_branch_id => v_hdr.from_branch_id,
        p_warehouse_id => v_hdr.from_warehouse_id, p_item_id => r.item_id,
        p_txn_date => v_hdr.transfer_date, p_direction => 'O',
        p_doc_type => 'TRF_OUT', p_doc_id => v_hdr.transfer_id, p_doc_line_id => r.line_id,
        p_qty => r.qty, p_user_id => p_user_id
      );

      pkg_stock.post_txn(
        p_company_id => v_hdr.company_id, p_branch_id => v_hdr.to_branch_id,
        p_warehouse_id => v_hdr.to_warehouse_id, p_item_id => r.item_id,
        p_txn_date => v_hdr.transfer_date, p_direction => 'I',
        p_doc_type => 'TRF_IN', p_doc_id => v_hdr.transfer_id, p_doc_line_id => r.line_id,
        p_qty => r.qty, p_user_id => p_user_id, p_fixed_unit_cost => v_cost
      );
    END LOOP;

    UPDATE stock_transfer_hdr SET status = 'POSTED' WHERE transfer_id = p_transfer_id;
  END post_stock_transfer;

END pkg_posting;
/
