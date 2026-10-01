-- ============================================================================
-- Cash Payment/Receipt build status
-- ============================================================================

UPDATE module_function
   SET build_status = 'COMPLETED',
       build_notes  = 'List (type/status/branch/search/date filters), create/edit draft, Post and Cancel for CPV and CRV - via pkg_gl, no new tables. One fixed cash leg (coa.is_control_ac=''CASH'', locked after create) plus free legs (any account except CASH/BANK). Party derived from a Customer/Supplier free leg, as JV does. Verified live: posted CPV-000001, drafted/posted/cancelled CRV-000001.',
       completed_on = SYSDATE
 WHERE module_code = 'CASH_VOUCHER';
COMMIT;
