-- ============================================================================
-- Journal Voucher build status
-- ============================================================================

UPDATE module_function
   SET build_status = 'COMPLETED',
       build_notes  = 'List (status/branch/search/date filters), create/edit draft lines, Post and Cancel - via pkg_gl (create_voucher/add_line/post_voucher/cancel_voucher), no new tables needed. Debit=credit enforced client- and server-side. Party required per line only on a Customer/Supplier control account, re-checked against live COA. Verified: created, edited, posted and cancelled a voucher against the live schema.',
       completed_on = SYSDATE
 WHERE module_code = 'JV_ENTRY';
COMMIT;
