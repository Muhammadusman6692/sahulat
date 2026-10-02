-- ============================================================================
-- Party Ledger build status
-- ============================================================================

UPDATE module_function
   SET build_status = 'COMPLETED',
       build_notes  = 'Party-searchable ledger: combines a party''s AR + AP control accounts into one statement with one running balance (debit-credit netted uniformly) - positive = party owes company, negative = company owes party. Branch/date filters, drill-down, print view. No new tables. Verified live: supplier-only party (AP debit) and a customer with an offsetting SINV/SRET pair. DRAFT lines excluded.',
       completed_on = SYSDATE
 WHERE module_code = 'PARTY_LEDGER';
COMMIT;
