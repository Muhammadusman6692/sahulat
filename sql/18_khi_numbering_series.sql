-- ============================================================================
-- Numbering series for the Karachi (KHI) branch of JTC.
--
-- Every numbering_series row so far has branch_id pointing at Lahore (LHR) —
-- Karachi had none for any doc type, so creating any numbered document
-- (Journal Voucher, Sales/Purchase Invoice or Return, GRN) while scoped to
-- KHI failed with a generic Oracle error. voucher_no/invoice_no etc. are
-- unique per company (not per branch — see UQ_VOUCHER_NO on gl_voucher_hdr),
-- so KHI gets its own "KHI-" prefixed series rather than sharing LHR's
-- prefix, which would collide the moment both branches' counters reached
-- the same number.
--
-- Safe to re-run.
-- ============================================================================

DECLARE
  v_company_id NUMBER;
  v_khi_branch NUMBER;
  v_fy_id      NUMBER;

  PROCEDURE seed_series (p_doc_type VARCHAR2, p_prefix VARCHAR2, p_pad NUMBER) IS
  BEGIN
    MERGE INTO numbering_series t
    USING (SELECT v_company_id AS c, v_khi_branch AS b, p_doc_type AS d FROM dual) s
       ON (t.company_id = s.c AND NVL(t.branch_id,-1) = s.b
           AND NVL(t.terminal_id,-1) = -1 AND t.doc_type = s.d)
    WHEN NOT MATCHED THEN
      INSERT (company_id, branch_id, doc_type, prefix, next_number, pad_length, fy_id)
      VALUES (s.c, s.b, p_doc_type, p_prefix, 1, p_pad, v_fy_id);
  END;
BEGIN
  SELECT company_id INTO v_company_id FROM company WHERE company_code = 'JTC';
  SELECT branch_id INTO v_khi_branch FROM branch
   WHERE company_id = v_company_id AND branch_code = 'KHI';

  SELECT fy_id INTO v_fy_id
    FROM numbering_series
   WHERE company_id = v_company_id AND doc_type = 'SINV' AND branch_id != v_khi_branch
     AND ROWNUM = 1;

  seed_series('SINV', 'KHI-SINV-', 6);
  seed_series('SRET', 'KHI-SRET-', 6);
  seed_series('JV',   'KHI-JV-',   6);
  seed_series('PINV', 'KHI-PINV-', 6);
  seed_series('PRET', 'KHI-PRET-', 6);
  seed_series('GRN',  'KHI-GRN/',  5);

  COMMIT;
END;
/

SELECT ns.doc_type, ns.prefix, ns.next_number, ns.pad_length, b.branch_code
  FROM numbering_series ns
  JOIN company c ON c.company_id = ns.company_id
  JOIN branch b ON b.branch_id = ns.branch_id
 WHERE c.company_code = 'JTC'
 ORDER BY b.branch_code, ns.doc_type;
