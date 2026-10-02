-- ============================================================================
-- Profit & Loss build status
-- ============================================================================

UPDATE module_function
   SET build_status = 'COMPLETED',
       build_notes  = 'Posted INCOME/EXPENSE over coa/gl_voucher_hdr/gl_voucher_line, grouped by COA level-2/3, signed per nature so contras net correctly. Gross Profit only if COGS is mapped, via its level-2 ancestor. CLOSING excluded. Branch, FY quick-select, zero-balance toggle, GL drill-down, print. Line+header joined before coa (unlike Trial Balance) so cancelled vouchers do not leak in; verified vs GL Report.', -- max 400 chars (build_notes column)
       completed_on = SYSDATE
 WHERE module_code = 'PROFIT_LOSS';
COMMIT;
