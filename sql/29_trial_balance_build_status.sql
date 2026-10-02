-- ============================================================================
-- Trial Balance build status
-- ============================================================================

UPDATE module_function
   SET build_status = 'COMPLETED',
       build_notes  = 'Per-account trial balance over coa/gl_voucher_hdr/gl_voucher_line: opening balance (POSTED lines before dateFrom), gross period Dr/Cr in range, netted closing balance, grouped and subtotalled by account_nature, grand total with an in-balance check. Branch filter, zero-balance toggle, year-end CLOSING-entries toggle (default excluded). Drill-down to GL Report, print view. No new tables, added ix_gl_hdr_co_status_date. Verified live: grand total ties, branch filter narrows correctly, CANCELLED voucher excluded, closing toggle zeroes INCOME/EXPENSE after a year-end close.',
       completed_on = SYSDATE
 WHERE module_code = 'TRIAL_BALANCE';
COMMIT;
