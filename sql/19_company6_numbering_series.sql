-- ============================================================================
-- Numbering series for company 6 (Jahangir Poultry and Dairy) — it had NONE
-- at all, on either branch, so every numbered document (Journal Voucher,
-- Sales/Purchase Invoice or Return, GRN) fails for this company today.
--
-- FSD (Hockey Stadium, the lower branch_id) gets the plain prefixes, the
-- same role LHR plays for JTC; ISB (Industrial Area) gets its own
-- "ISB-" prefixed series so the two branches' counters never collide --
-- voucher_no/invoice_no etc. are unique per company, not per branch.
--
-- Safe to re-run.
-- ============================================================================

DECLARE
  v_company_id NUMBER;
  v_fsd_branch NUMBER;
  v_isb_branch NUMBER;
  v_fy_id      NUMBER;

  PROCEDURE seed_series (p_branch_id NUMBER, p_doc_type VARCHAR2, p_prefix VARCHAR2, p_pad NUMBER) IS
  BEGIN
    MERGE INTO numbering_series t
    USING (SELECT v_company_id AS c, p_branch_id AS b, p_doc_type AS d FROM dual) s
       ON (t.company_id = s.c AND NVL(t.branch_id,-1) = s.b
           AND NVL(t.terminal_id,-1) = -1 AND t.doc_type = s.d)
    WHEN NOT MATCHED THEN
      INSERT (company_id, branch_id, doc_type, prefix, next_number, pad_length, fy_id)
      VALUES (s.c, s.b, p_doc_type, p_prefix, 1, p_pad, v_fy_id);
  END;
BEGIN
  SELECT company_id INTO v_company_id FROM company WHERE company_code = 'JPD';
  SELECT branch_id INTO v_fsd_branch FROM branch
   WHERE company_id = v_company_id AND branch_code = 'FSD';
  SELECT branch_id INTO v_isb_branch FROM branch
   WHERE company_id = v_company_id AND branch_code = 'ISB';
  SELECT fy_id INTO v_fy_id FROM fiscal_year WHERE company_id = v_company_id;

  seed_series(v_fsd_branch, 'SINV', 'SINV-', 6);
  seed_series(v_fsd_branch, 'SRET', 'SRET-', 6);
  seed_series(v_fsd_branch, 'JV',   'JV-',   6);
  seed_series(v_fsd_branch, 'PINV', 'PINV-', 6);
  seed_series(v_fsd_branch, 'PRET', 'PRET-', 6);
  seed_series(v_fsd_branch, 'GRN',  'GRN/',  5);

  seed_series(v_isb_branch, 'SINV', 'ISB-SINV-', 6);
  seed_series(v_isb_branch, 'SRET', 'ISB-SRET-', 6);
  seed_series(v_isb_branch, 'JV',   'ISB-JV-',   6);
  seed_series(v_isb_branch, 'PINV', 'ISB-PINV-', 6);
  seed_series(v_isb_branch, 'PRET', 'ISB-PRET-', 6);
  seed_series(v_isb_branch, 'GRN',  'ISB-GRN/',  5);

  COMMIT;
END;
/

SELECT ns.doc_type, ns.prefix, ns.next_number, ns.pad_length, b.branch_code
  FROM numbering_series ns
  JOIN company c ON c.company_id = ns.company_id
  JOIN branch b ON b.branch_id = ns.branch_id
 WHERE c.company_code = 'JPD'
 ORDER BY b.branch_code, ns.doc_type;
