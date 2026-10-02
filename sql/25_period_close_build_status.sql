-- ============================================================================
-- Period Close build status
-- ============================================================================

UPDATE module_function
   SET build_status = 'COMPLETED',
       build_notes  = 'Checklist-gated close/reopen per period (blocks on drafts, or an unbalanced posted total) via pkg_period_close, logged to period_close_log. Closing a year''s last period zeroes every INCOME/EXPENSE balance into RETAINED_EARNINGS in one CLOSING voucher; reopening cancels it. Replaces the old raw toggle on Fiscal Years. Verified live: full close/reopen cycle round-trips balances exactly.',
       completed_on = SYSDATE
 WHERE module_code = 'PERIOD_CLOSE';
COMMIT;
