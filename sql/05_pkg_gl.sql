-- ============================================================================
-- PKG_GL - general ledger voucher posting (balanced double-entry enforced)
-- ============================================================================
CREATE OR REPLACE PACKAGE pkg_gl AS

  -- Creates a voucher header in DRAFT status. Returns the new voucher_id.
  FUNCTION create_voucher (
    p_company_id    IN NUMBER,
    p_branch_id     IN NUMBER,
    p_voucher_type  IN VARCHAR2,
    p_voucher_date  IN DATE,
    p_source_module IN VARCHAR2,
    p_source_doc_id IN NUMBER,
    p_narration     IN VARCHAR2,
    p_user_id       IN NUMBER
  ) RETURN NUMBER;

  -- Adds one debit or credit line. Exactly one of p_debit/p_credit must be > 0.
  PROCEDURE add_line (
    p_voucher_id IN NUMBER,
    p_coa_id     IN NUMBER,
    p_debit      IN NUMBER DEFAULT 0,
    p_credit     IN NUMBER DEFAULT 0,
    p_party_id   IN NUMBER DEFAULT NULL,
    p_narration  IN VARCHAR2 DEFAULT NULL
  );

  -- Validates: postable accounts only, debit total = credit total, period
  -- open, then flips status to POSTED. Raises on any failure - nothing is
  -- left half-posted.
  PROCEDURE post_voucher (
    p_voucher_id IN NUMBER,
    p_user_id    IN NUMBER
  );

  PROCEDURE cancel_voucher (
    p_voucher_id IN NUMBER,
    p_user_id    IN NUMBER,
    p_reason     IN VARCHAR2
  );

END pkg_gl;
/

CREATE OR REPLACE PACKAGE BODY pkg_gl AS

  FUNCTION create_voucher (
    p_company_id    IN NUMBER,
    p_branch_id     IN NUMBER,
    p_voucher_type  IN VARCHAR2,
    p_voucher_date  IN DATE,
    p_source_module IN VARCHAR2,
    p_source_doc_id IN NUMBER,
    p_narration     IN VARCHAR2,
    p_user_id       IN NUMBER
  ) RETURN NUMBER IS
    v_voucher_id NUMBER;
    v_period_id  NUMBER;
    v_period_status fiscal_period.status%TYPE;
    v_voucher_no VARCHAR2(30);
  BEGIN
    SELECT fp.period_id, fp.status INTO v_period_id, v_period_status
    FROM fiscal_period fp
    JOIN fiscal_year fy ON fy.fy_id = fp.fy_id
    WHERE fy.company_id = p_company_id
      AND p_voucher_date BETWEEN fp.start_date AND fp.end_date;

    IF v_period_status = 'CLOSED' THEN
      RAISE_APPLICATION_ERROR(-20301, 'Fiscal period is closed for date ' || TO_CHAR(p_voucher_date,'YYYY-MM-DD'));
    END IF;

    v_voucher_no := pkg_numbering.get_next_number(p_company_id, p_branch_id, NULL, p_voucher_type);

    INSERT INTO gl_voucher_hdr (
      company_id, branch_id, voucher_no, voucher_type, voucher_date,
      period_id, source_module, source_doc_id, narration, created_by
    ) VALUES (
      p_company_id, p_branch_id, v_voucher_no, p_voucher_type, p_voucher_date,
      v_period_id, p_source_module, p_source_doc_id, p_narration, p_user_id
    ) RETURNING voucher_id INTO v_voucher_id;

    RETURN v_voucher_id;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE_APPLICATION_ERROR(-20302, 'No open fiscal period found for date ' || TO_CHAR(p_voucher_date,'YYYY-MM-DD'));
  END create_voucher;

  PROCEDURE add_line (
    p_voucher_id IN NUMBER,
    p_coa_id     IN NUMBER,
    p_debit      IN NUMBER DEFAULT 0,
    p_credit     IN NUMBER DEFAULT 0,
    p_party_id   IN NUMBER DEFAULT NULL,
    p_narration  IN VARCHAR2 DEFAULT NULL
  ) IS
    v_postable CHAR(1);
  BEGIN
    SELECT is_postable INTO v_postable FROM coa WHERE coa_id = p_coa_id;
    IF v_postable != 'Y' THEN
      RAISE_APPLICATION_ERROR(-20303, 'Account ' || p_coa_id || ' is not a postable (level 4) account');
    END IF;

    IF (p_debit > 0 AND p_credit > 0) OR (p_debit = 0 AND p_credit = 0) THEN
      RAISE_APPLICATION_ERROR(-20304, 'Exactly one of debit/credit must be greater than zero');
    END IF;

    INSERT INTO gl_voucher_line (voucher_id, coa_id, debit_amt, credit_amt, party_id, narration)
    VALUES (p_voucher_id, p_coa_id, p_debit, p_credit, p_party_id, p_narration);
  END add_line;

  PROCEDURE post_voucher (
    p_voucher_id IN NUMBER,
    p_user_id    IN NUMBER
  ) IS
    v_total_dr NUMBER;
    v_total_cr NUMBER;
    v_status   VARCHAR2(10);
    v_period_id NUMBER;
    v_period_status VARCHAR2(10);
  BEGIN
    SELECT status, period_id INTO v_status, v_period_id
    FROM gl_voucher_hdr WHERE voucher_id = p_voucher_id FOR UPDATE;

    IF v_status != 'DRAFT' THEN
      RAISE_APPLICATION_ERROR(-20305, 'Voucher is not in DRAFT status');
    END IF;

    SELECT status INTO v_period_status FROM fiscal_period WHERE period_id = v_period_id;
    IF v_period_status = 'CLOSED' THEN
      RAISE_APPLICATION_ERROR(-20306, 'Fiscal period is closed');
    END IF;

    SELECT NVL(SUM(debit_amt),0), NVL(SUM(credit_amt),0)
    INTO v_total_dr, v_total_cr
    FROM gl_voucher_line WHERE voucher_id = p_voucher_id;

    IF v_total_dr != v_total_cr THEN
      RAISE_APPLICATION_ERROR(-20307,
        'Voucher not balanced: debit ' || v_total_dr || ' credit ' || v_total_cr);
    END IF;

    IF v_total_dr = 0 THEN
      RAISE_APPLICATION_ERROR(-20308, 'Voucher has no lines');
    END IF;

    UPDATE gl_voucher_hdr
    SET status = 'POSTED', posted_by = p_user_id, posted_on = SYSTIMESTAMP
    WHERE voucher_id = p_voucher_id;
  END post_voucher;

  PROCEDURE cancel_voucher (
    p_voucher_id IN NUMBER,
    p_user_id    IN NUMBER,
    p_reason     IN VARCHAR2
  ) IS
    v_status VARCHAR2(10);
  BEGIN
    SELECT status INTO v_status FROM gl_voucher_hdr WHERE voucher_id = p_voucher_id FOR UPDATE;
    IF v_status != 'POSTED' THEN
      RAISE_APPLICATION_ERROR(-20309, 'Only POSTED vouchers can be cancelled');
    END IF;
    -- Cancellation never deletes/edits posted rows; a REVERSAL voucher should
    -- be raised by the caller (mirrror debit/credit) and this just flags status.
    UPDATE gl_voucher_hdr
    SET status = 'CANCELLED', narration = narration || ' [CANCELLED: ' || p_reason || ']'
    WHERE voucher_id = p_voucher_id;
  END cancel_voucher;

END pkg_gl;
/
