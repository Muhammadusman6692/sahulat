-- ============================================================================
-- PKG_PERIOD_CLOSE — checklist-gated period close/reopen, with an audit trail
--
-- Phase 1: close_period / reopen_period only, treating every period alike.
-- Year-end closing (closing the last period of a fiscal year into Retained
-- Earnings, and the matching fiscal-year close/reopen) is added in a later
-- CREATE OR REPLACE once the Period Close screen's basic flow has shipped —
-- see sql/22_period_close.sql's header and the Period Close plan.
-- ============================================================================
CREATE OR REPLACE PACKAGE pkg_period_close AS

  -- Rejects if the period still has a DRAFT voucher, or if posted debits
  -- don't equal posted credits (defensive — pkg_gl already guarantees this
  -- per voucher). Otherwise flips the period to CLOSED and logs it.
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

END pkg_period_close;
/

CREATE OR REPLACE PACKAGE BODY pkg_period_close AS

  PROCEDURE close_period (
    p_period_id IN NUMBER,
    p_user_id   IN NUMBER,
    p_reason    IN VARCHAR2 DEFAULT NULL
  ) IS
    v_fy_id      NUMBER;
    v_status     VARCHAR2(10);
    v_draft_cnt  NUMBER;
    v_total_dr   NUMBER;
    v_total_cr   NUMBER;
  BEGIN
    SELECT fy_id, status INTO v_fy_id, v_status
    FROM fiscal_period WHERE period_id = p_period_id FOR UPDATE;

    IF v_status = 'CLOSED' THEN
      RAISE_APPLICATION_ERROR(-20401, 'This period is already closed');
    END IF;

    SELECT COUNT(*) INTO v_draft_cnt
    FROM gl_voucher_hdr
    WHERE period_id = p_period_id AND status = 'DRAFT';

    IF v_draft_cnt > 0 THEN
      RAISE_APPLICATION_ERROR(-20402,
        v_draft_cnt || ' draft voucher(s) still exist in this period — post or cancel them first');
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
      RAISE_APPLICATION_ERROR(-20406, 'The fiscal year is closed — reopen the fiscal year first');
    END IF;

    UPDATE fiscal_period SET status = 'OPEN' WHERE period_id = p_period_id;

    INSERT INTO period_close_log (fy_id, period_id, action, reason, performed_by)
    VALUES (v_fy_id, p_period_id, 'PERIOD_REOPEN', p_reason, p_user_id);
  END reopen_period;

END pkg_period_close;
/
