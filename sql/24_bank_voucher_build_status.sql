-- ============================================================================
-- Bank Payment/Receipt build status
-- ============================================================================

UPDATE module_function
   SET build_status = 'COMPLETED',
       build_notes  = 'List/create/edit draft/Post/Cancel for BPV and BRV - via pkg_gl, same shape as Cash Voucher. One fixed bank leg (is_control_ac=''BANK'', locked after create) plus free legs (not CASH/BANK). Instrument detail (type/no./date) in new bank_voucher_detail table, 1:1 on voucher_id. Verified live: posted BPV-000001, drafted/edited/posted/cancelled BRV-000001.',
       completed_on = SYSDATE
 WHERE module_code = 'BANK_VOUCHER';
COMMIT;
