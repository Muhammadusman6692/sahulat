-- ============================================================================
-- Trial Balance build status
-- ============================================================================

UPDATE module_function
   SET build_status = 'COMPLETED',
       build_notes  = 'Per-account trial balance over coa/gl_voucher_hdr/gl_voucher_line: opening balance, gross period Dr/Cr, netted closing balance, subtotalled by account_nature, grand total with in-balance check. Branch, zero-balance toggle, CLOSING toggle. Drill-down to GL Report, print. Fix: line+header joined before coa (sibling LEFT JOINs let a CANCELLED/DRAFT voucher leak in) - verified vs GL Report live.', -- max 400 chars (build_notes column)
       completed_on = SYSDATE
 WHERE module_code = 'TRIAL_BALANCE';
COMMIT;
