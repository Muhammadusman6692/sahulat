-- ============================================================================
-- Numbering series for BPV (Bank Payment Voucher) and BRV (Bank Receipt
-- Voucher) — same branch/prefix/pad convention as CPV/CRV
-- (sql/19_numbering_series_cash_voucher.sql), needed by pkg_numbering before
-- the Bank Payment/Receipt screen can create its first voucher.
--
-- Safe to re-run.
-- ============================================================================

-- One BPV/BRV row per branch that already has a JV row (every trading
-- branch), not just the first one — JTC has two (Lahore, Karachi).
DECLARE
  v_company_id NUMBER;
BEGIN
  SELECT company_id INTO v_company_id FROM company WHERE company_code = 'JTC';

  FOR r IN (
    SELECT branch_id, fy_id FROM numbering_series
     WHERE company_id = v_company_id AND doc_type = 'JV'
  ) LOOP
    MERGE INTO numbering_series t
    USING (SELECT v_company_id AS c, r.branch_id AS b, 'BPV' AS d FROM dual) s
       ON (t.company_id = s.c AND NVL(t.branch_id,-1) = s.b
           AND NVL(t.terminal_id,-1) = -1 AND t.doc_type = s.d)
    WHEN NOT MATCHED THEN
      INSERT (company_id, branch_id, doc_type, prefix, next_number, pad_length, fy_id)
      VALUES (s.c, s.b, 'BPV', 'BPV-', 1, 6, r.fy_id);

    MERGE INTO numbering_series t
    USING (SELECT v_company_id AS c, r.branch_id AS b, 'BRV' AS d FROM dual) s
       ON (t.company_id = s.c AND NVL(t.branch_id,-1) = s.b
           AND NVL(t.terminal_id,-1) = -1 AND t.doc_type = s.d)
    WHEN NOT MATCHED THEN
      INSERT (company_id, branch_id, doc_type, prefix, next_number, pad_length, fy_id)
      VALUES (s.c, s.b, 'BRV', 'BRV-', 1, 6, r.fy_id);
  END LOOP;

  COMMIT;
END;
/

SELECT doc_type, prefix, next_number, pad_length FROM numbering_series ns
  JOIN company c ON c.company_id = ns.company_id
 WHERE c.company_code = 'JTC'
 ORDER BY doc_type;
