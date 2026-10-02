-- ============================================================================
-- Aging Report build status
-- ============================================================================

UPDATE module_function
   SET build_status = 'COMPLETED',
       build_notes  = 'Combined AR+AP aging per party, FIFO-allocated over posted control lines: a debit opens/extends an aged parcel, a credit retires oldest parcels first; unconsumed credit becomes a negative Advance. Due date = voucher_date + credit_days. Buckets Not Due/1-30/31-60/61-90/90+. Drill-down + print. No new tables. Verified vs live data for 3 parties, FIFO hand-traced and matched exactly. DRAFT excluded.',
       completed_on = SYSDATE
 WHERE module_code = 'AGING_REPORT';
COMMIT;
