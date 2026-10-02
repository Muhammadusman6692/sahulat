-- ============================================================================
-- Balance Sheet build status
-- ============================================================================

UPDATE module_function
   SET build_status = 'COMPLETED',
       build_notes  = 'As-at balance sheet over coa/gl tables: cumulative POSTED balances incl. CLOSING, rolled up the COA tree to level 2/3/4. Unclosed profit from INCOME/EXPENSE shown under equity, split current FY vs prior years. Optional comparative date, branch filter, zero toggle, balance check. Drill-down to GL Report, print view. No new tables. Verified live.', -- max 400 chars (build_notes column)
       completed_on = SYSDATE
 WHERE module_code = 'BALANCE_SHEET';
COMMIT;
