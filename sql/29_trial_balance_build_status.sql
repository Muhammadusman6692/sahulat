-- ============================================================================
-- Trial Balance build status
-- ============================================================================

UPDATE module_function
   SET build_status = 'COMPLETED',
       build_notes  = 'Per-account trial balance over coa/gl_voucher_hdr/gl_voucher_line: opening balance, gross period Dr/Cr, netted closing balance, subtotalled by account_nature, grand total with in-balance check. Branch filter, zero-balance toggle, year-end CLOSING toggle (default excluded). Drill-down to GL Report, print view. No new tables, added ix_gl_hdr_co_status_date. Verified live against real data.', -- max 400 chars (build_notes column)
       completed_on = SYSDATE
 WHERE module_code = 'TRIAL_BALANCE';
COMMIT;
