-- ============================================================================
-- General Ledger (account ledger inquiry) build status
-- ============================================================================

UPDATE module_function
   SET build_status = 'COMPLETED',
       build_notes  = 'Account ledger: account LOV + branch/date filters, opening balance + POSTED movements with running balance (per normal_side), closing balance. Drill-down to JV/CPV/CRV/BPV/BRV. Print view. No new tables, added ix_gl_line_coa. Verified live: Bank-Main (cross-voucher-type, branch filter) and a supplier control account (party resolved). DRAFT/CANCELLED confirmed excluded.',
       completed_on = SYSDATE
 WHERE module_code = 'GL_REPORT';
COMMIT;
