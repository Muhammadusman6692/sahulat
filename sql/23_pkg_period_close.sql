-- ============================================================================
-- PKG_PERIOD_CLOSE — checklist-gated period close/reopen, with an audit trail
--
-- Phase 1 (close_period / reopen_period) treats every period alike. Phase 2
-- adds year-end closing: closing the fiscal year's last period routes through
-- close_fiscal_year instead, which zeroes every postable INCOME/EXPENSE
-- account's balance for the year into the company's RETAINED_EARNINGS
-- default account (sql/22_period_close.sql), then closes the period and the
-- fiscal year together. reopen_fiscal_year is the mirror: reopen the last
-- period, post a reversal of the closing entry, cancel the original, reopen
-- the year. See the Period Close plan for the full design.
-- ============================================================================
CREATE OR REPLACE PACKAGE pkg_period_close AS

  -- Rejects if the period still has a DRAFT voucher, or if posted debits
  -- don't equal posted credits (defensive — pkg_gl already guarantees this
  -- per voucher). Rejects if this is the fiscal year's last period — use
  -- close_fiscal_year for that. Otherwise flips the period to CLOSED and
  -- logs it.
  PROCEDURE close_period (
    p_period_id IN NUMBER,
    p_user_id   IN NUMBER,
    p_reason    IN VARCHAR2 DEFAULT NULL
  );

  -- p_reason is mandatory. Rejects if the period's fiscal year is itself
  -- CLOSED (reopen the fiscal year first).
  PROCEDURE reopen_period (
    p_period_id IN NUMBER,
    p_user_id   IN NUMBER,
    p_reason    IN VARCHAR2
  );

  -- One row per postable INCOME/EXPENSE account with a nonzero posted
  -- balance across the fiscal year: coa_id, account_code, account_name,
  -- account_nature, zero_debit, zero_credit — the line that would zero it
  -- out. Used by the UI confirm modal and by close_fiscal_year itself, so
  -- preview and actual posting can never disagree. Net income is the
  -- caller's SUM(zero_debit) - SUM(zero_credit) over these rows.
  FUNCTION preview_year_end_close (
    p_fy_id IN NUMBER
  ) RETURN SYS_REFCURSOR;

  -- Only valid on the fiscal year's last period, and only once every other
  -- period in the year is already CLOSED. Runs the same DRAFT/balance
  -- checks close_period does, builds the closing entry from
  -- preview_year_end_close (voucher_type 'CLOSING', dated the period's
  -- end_date, source_module 'PERIOD_CLOSE', source_doc_id = fy_id), posts
  -- it via pkg_gl, then closes the period and the fiscal year together.
  -- Skips posting entirely if there is no INCOME/EXPENSE movement to close.
  PROCEDURE close_fiscal_year (
    p_fy_id  IN NUMBER,
    p_user_id IN NUMBER,
    p_reason IN VARCHAR2 DEFAULT NULL
  );

  -- p_reason is mandatory. Reopens the last period, cancels the fiscal
  -- year's posted CLOSING voucher via pkg_gl.cancel_voucher (if any), then
  -- reopens the year. No separate reversal is posted — every balance query
  -- in this app already filters status='POSTED', so cancelling alone fully
  -- restores the pre-close balances; posting a mirror reversal on top of
  -- that would double the correction.
  PROCEDURE reopen_fiscal_year (
    p_fy_id   IN NUMBER,
    p_user_id IN NUMBER,
    p_reason  IN VARCHAR2
  );

END pkg_period_close;
/

CREATE OR REPLACE PACKAGE BODY pkg_period_close AS

  PROCEDURE close_period (
    p_period_id IN NUMBER,
    p_user_id   IN NUMBER,
    p_reason    IN VARCHAR2 DEFAULT NULL
  ) IS
    v_fy_id      NUMBER;
    v_period_no  NUMBER;
    v_status     VARCHAR2(10);
    v_max_no     NUMBER;
    v_draft_cnt  NUMBER;
    v_total_dr   NUMBER;
    v_total_cr   NUMBER;
  BEGIN
    SELECT fy_id, period_no, status INTO v_fy_id, v_period_no, v_status
    FROM fiscal_period WHERE period_id = p_period_id FOR UPDATE;

    IF v_status = 'CLOSED' THEN
      RAISE_APPLICATION_ERROR(-20401, 'This period is already closed');
    END IF;

    SELECT MAX(period_no) INTO v_max_no FROM fiscal_period WHERE fy_id = v_fy_id;
    IF v_period_no = v_max_no THEN
      RAISE_APPLICATION_ERROR(-20407,
        'This is the fiscal year''s last period — use year-end close instead');
    END IF;

    SELECT COUNT(*) INTO v_draft_cnt
    FROM gl_voucher_hdr
    WHERE period_id = p_period_id AND status = 'DRAFT';

    IF v_draft_cnt > 0 THEN
      RAISE_APPLICATION_ERROR(-20402,
        v_draft_cnt || ' draft voucher(s) still exist in this period - post or cancel them first');
    END IF;

    SELECT NVL(SUM(l.debit_amt),0), NVL(SUM(l.credit_amt),0)
    INTO v_total_dr, v_total_cr
    FROM gl_voucher_line l
    JOIN gl_voucher_hdr h ON h.voucher_id = l.voucher_id
    WHERE h.period_id = p_period_id AND h.status = 'POSTED';

    IF v_total_dr != v_total_cr THEN
      RAISE_APPLICATION_ERROR(-20403,
        'Posted entries in this period do not balance: debit ' || v_total_dr || ' credit ' || v_total_cr);
    END IF;

    UPDATE fiscal_period SET status = 'CLOSED' WHERE period_id = p_period_id;

    INSERT INTO period_close_log (fy_id, period_id, action, reason, performed_by)
    VALUES (v_fy_id, p_period_id, 'PERIOD_CLOSE', p_reason, p_user_id);
  END close_period;

  PROCEDURE reopen_period (
    p_period_id IN NUMBER,
    p_user_id   IN NUMBER,
    p_reason    IN VARCHAR2
  ) IS
    v_fy_id     NUMBER;
    v_status    VARCHAR2(10);
    v_fy_status VARCHAR2(10);
  BEGIN
    IF p_reason IS NULL OR TRIM(p_reason) IS NULL THEN
      RAISE_APPLICATION_ERROR(-20404, 'A reason is required to reopen a period');
    END IF;

    SELECT fy_id, status INTO v_fy_id, v_status
    FROM fiscal_period WHERE period_id = p_period_id FOR UPDATE;

    IF v_status = 'OPEN' THEN
      RAISE_APPLICATION_ERROR(-20405, 'This period is already open');
    END IF;

    SELECT status INTO v_fy_status FROM fiscal_year WHERE fy_id = v_fy_id;
    IF v_fy_status = 'CLOSED' THEN
      RAISE_APPLICATION_ERROR(-20406, 'The fiscal year is closed - reopen the fiscal year first');
    END IF;

    UPDATE fiscal_period SET status = 'OPEN' WHERE period_id = p_period_id;

    INSERT INTO period_close_log (fy_id, period_id, action, reason, performed_by)
    VALUES (v_fy_id, p_period_id, 'PERIOD_REOPEN', p_reason, p_user_id);
  END reopen_period;

  FUNCTION preview_year_end_close (
    p_fy_id IN NUMBER
  ) RETURN SYS_REFCURSOR IS
    v_cursor SYS_REFCURSOR;
  BEGIN
    OPEN v_cursor FOR
      SELECT c.coa_id, c.account_code, c.account_name, c.account_nature,
             CASE WHEN bal.net < 0 THEN -bal.net ELSE 0 END AS zero_debit,
             CASE WHEN bal.net > 0 THEN bal.net  ELSE 0 END AS zero_credit
        FROM coa c
        JOIN (
          SELECT l.coa_id, SUM(l.debit_amt) - SUM(l.credit_amt) AS net
            FROM gl_voucher_line l
            JOIN gl_voucher_hdr h ON h.voucher_id = l.voucher_id
            JOIN fiscal_period fp ON fp.period_id = h.period_id
           WHERE fp.fy_id = p_fy_id AND h.status = 'POSTED'
           GROUP BY l.coa_id
        ) bal ON bal.coa_id = c.coa_id
       WHERE c.account_nature IN ('INCOME','EXPENSE')
         AND bal.net != 0
       ORDER BY c.account_code;
    RETURN v_cursor;
  END preview_year_end_close;

  PROCEDURE close_fiscal_year (
    p_fy_id   IN NUMBER,
    p_user_id IN NUMBER,
    p_reason  IN VARCHAR2 DEFAULT NULL
  ) IS
    v_company_id    NUMBER;
    v_branch_id     NUMBER;
    v_fy_status     VARCHAR2(10);
    v_last_period   NUMBER;
    v_last_status   VARCHAR2(10);
    v_end_date      DATE;
    v_open_others   NUMBER;
    v_draft_cnt     NUMBER;
    v_total_dr      NUMBER;
    v_total_cr      NUMBER;
    v_voucher_id    NUMBER;
    v_sum_debit     NUMBER := 0;
    v_sum_credit    NUMBER := 0;
    v_net_income    NUMBER;
    v_re_coa_id     NUMBER;
    v_cur           SYS_REFCURSOR;
    v_coa_id        NUMBER;
    v_acct_code     coa.account_code%TYPE;
    v_acct_name     coa.account_name%TYPE;
    v_acct_nature   coa.account_nature%TYPE;
    v_zero_debit    NUMBER;
    v_zero_credit   NUMBER;
  BEGIN
    SELECT company_id, status INTO v_company_id, v_fy_status
    FROM fiscal_year WHERE fy_id = p_fy_id FOR UPDATE;

    IF v_fy_status = 'CLOSED' THEN
      RAISE_APPLICATION_ERROR(-20408, 'This fiscal year is already closed');
    END IF;

    -- A closing entry is a company-level document, but gl_voucher_hdr.branch_id
    -- is NOT NULL, so it posts to whichever branch already carries this
    -- company's JV numbering — the same branch CPV/CRV numbering was seeded
    -- against (sql/19_numbering_series_cash_voucher.sql).
    BEGIN
      SELECT MIN(branch_id) INTO v_branch_id
      FROM numbering_series WHERE company_id = v_company_id AND doc_type = 'JV';
    EXCEPTION
      WHEN NO_DATA_FOUND THEN v_branch_id := NULL;
    END;
    IF v_branch_id IS NULL THEN
      RAISE_APPLICATION_ERROR(-20413, 'No branch with JV numbering configured for this company');
    END IF;

    SELECT period_id, status, end_date INTO v_last_period, v_last_status, v_end_date
    FROM fiscal_period
    WHERE fy_id = p_fy_id AND period_no = (SELECT MAX(period_no) FROM fiscal_period WHERE fy_id = p_fy_id)
    FOR UPDATE;

    IF v_last_status = 'CLOSED' THEN
      RAISE_APPLICATION_ERROR(-20401, 'This period is already closed');
    END IF;

    SELECT COUNT(*) INTO v_open_others
    FROM fiscal_period WHERE fy_id = p_fy_id AND period_id != v_last_period AND status = 'OPEN';
    IF v_open_others > 0 THEN
      RAISE_APPLICATION_ERROR(-20409, 'Every other period must be closed before the fiscal year can be closed');
    END IF;

    SELECT COUNT(*) INTO v_draft_cnt
    FROM gl_voucher_hdr WHERE period_id = v_last_period AND status = 'DRAFT';
    IF v_draft_cnt > 0 THEN
      RAISE_APPLICATION_ERROR(-20402,
        v_draft_cnt || ' draft voucher(s) still exist in this period - post or cancel them first');
    END IF;

    SELECT NVL(SUM(l.debit_amt),0), NVL(SUM(l.credit_amt),0)
    INTO v_total_dr, v_total_cr
    FROM gl_voucher_line l
    JOIN gl_voucher_hdr h ON h.voucher_id = l.voucher_id
    WHERE h.period_id = v_last_period AND h.status = 'POSTED';
    IF v_total_dr != v_total_cr THEN
      RAISE_APPLICATION_ERROR(-20403,
        'Posted entries in this period do not balance: debit ' || v_total_dr || ' credit ' || v_total_cr);
    END IF;

    v_cur := preview_year_end_close(p_fy_id);
    LOOP
      FETCH v_cur INTO v_coa_id, v_acct_code, v_acct_name, v_acct_nature, v_zero_debit, v_zero_credit;
      EXIT WHEN v_cur%NOTFOUND;

      IF v_voucher_id IS NULL THEN
        v_voucher_id := pkg_gl.create_voucher(
          v_company_id, v_branch_id, 'CLOSING', v_end_date,
          'PERIOD_CLOSE', p_fy_id, 'Year-end closing entry', p_user_id);
      END IF;

      IF v_zero_debit > 0 THEN
        pkg_gl.add_line(v_voucher_id, v_coa_id, p_debit => v_zero_debit);
        v_sum_debit := v_sum_debit + v_zero_debit;
      ELSE
        pkg_gl.add_line(v_voucher_id, v_coa_id, p_credit => v_zero_credit);
        v_sum_credit := v_sum_credit + v_zero_credit;
      END IF;
    END LOOP;
    CLOSE v_cur;

    IF v_voucher_id IS NOT NULL THEN
      v_net_income := v_sum_debit - v_sum_credit;
      IF v_net_income != 0 THEN
        BEGIN
          SELECT coa_id INTO v_re_coa_id
          FROM company_default_account
          WHERE company_id = v_company_id AND role_code = 'RETAINED_EARNINGS';
        EXCEPTION
          WHEN NO_DATA_FOUND THEN
            RAISE_APPLICATION_ERROR(-20410,
              'No Retained Earnings account configured for this company — set it on the Default GL Accounts screen first');
        END;

        IF v_net_income > 0 THEN
          pkg_gl.add_line(v_voucher_id, v_re_coa_id, p_credit => v_net_income);
        ELSE
          pkg_gl.add_line(v_voucher_id, v_re_coa_id, p_debit => -v_net_income);
        END IF;
      END IF;

      pkg_gl.post_voucher(v_voucher_id, p_user_id);
    END IF;

    UPDATE fiscal_period SET status = 'CLOSED' WHERE period_id = v_last_period;
    INSERT INTO period_close_log (fy_id, period_id, action, reason, closing_voucher_id, performed_by)
    VALUES (p_fy_id, v_last_period, 'PERIOD_CLOSE', p_reason, v_voucher_id, p_user_id);

    UPDATE fiscal_year SET status = 'CLOSED' WHERE fy_id = p_fy_id;
    INSERT INTO period_close_log (fy_id, period_id, action, reason, closing_voucher_id, performed_by)
    VALUES (p_fy_id, NULL, 'FY_CLOSE', p_reason, v_voucher_id, p_user_id);
  END close_fiscal_year;

  PROCEDURE reopen_fiscal_year (
    p_fy_id   IN NUMBER,
    p_user_id IN NUMBER,
    p_reason  IN VARCHAR2
  ) IS
    v_fy_status        VARCHAR2(10);
    v_last_period      NUMBER;
    v_closing_voucher  NUMBER;
  BEGIN
    IF p_reason IS NULL OR TRIM(p_reason) IS NULL THEN
      RAISE_APPLICATION_ERROR(-20411, 'A reason is required to reopen a fiscal year');
    END IF;

    SELECT status INTO v_fy_status
    FROM fiscal_year WHERE fy_id = p_fy_id FOR UPDATE;

    IF v_fy_status = 'OPEN' THEN
      RAISE_APPLICATION_ERROR(-20412, 'This fiscal year is already open');
    END IF;

    SELECT period_id INTO v_last_period
    FROM fiscal_period
    WHERE fy_id = p_fy_id AND period_no = (SELECT MAX(period_no) FROM fiscal_period WHERE fy_id = p_fy_id)
    FOR UPDATE;

    UPDATE fiscal_period SET status = 'OPEN' WHERE period_id = v_last_period;
    INSERT INTO period_close_log (fy_id, period_id, action, reason, performed_by)
    VALUES (p_fy_id, v_last_period, 'PERIOD_REOPEN', p_reason, p_user_id);

    BEGIN
      SELECT voucher_id INTO v_closing_voucher
      FROM gl_voucher_hdr
      WHERE source_module = 'PERIOD_CLOSE' AND source_doc_id = p_fy_id
        AND voucher_type = 'CLOSING' AND status = 'POSTED';
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        v_closing_voucher := NULL;
    END;

    -- No closing voucher exists when the year had no INCOME/EXPENSE
    -- movement at all (close_fiscal_year skips posting in that case) —
    -- nothing to undo.
    IF v_closing_voucher IS NOT NULL THEN
      pkg_gl.cancel_voucher(v_closing_voucher, p_user_id, 'Reversed on fiscal year reopen: ' || p_reason);
    END IF;

    UPDATE fiscal_year SET status = 'OPEN' WHERE fy_id = p_fy_id;
    INSERT INTO period_close_log (fy_id, period_id, action, reason, closing_voucher_id, performed_by)
    VALUES (p_fy_id, NULL, 'FY_REOPEN', p_reason, v_closing_voucher, p_user_id);
  END reopen_fiscal_year;

END pkg_period_close;
/
