-- ============================================================================
-- Numbering series for PINV (Purchase Invoice) and PRET (Purchase Return) —
-- the two doc types were already named in 01_masters.sql/02_transactions.sql
-- comments and needed by pkg_posting once purchase posting is built, but no
-- series existed for them yet, so /admin/numbering-series had nothing to show.
--
-- Same branch/prefix/pad convention as the existing SINV/SRET rows.
-- Safe to re-run.
-- ============================================================================

DECLARE
  v_company_id NUMBER;
  v_branch_id  NUMBER;
  v_fy_id      NUMBER;
BEGIN
  SELECT company_id INTO v_company_id FROM company WHERE company_code = 'JTC';

  SELECT branch_id, fy_id INTO v_branch_id, v_fy_id
    FROM numbering_series
   WHERE company_id = v_company_id AND doc_type = 'SINV';

  MERGE INTO numbering_series t
  USING (SELECT v_company_id AS c, v_branch_id AS b, 'PINV' AS d FROM dual) s
     ON (t.company_id = s.c AND NVL(t.branch_id,-1) = s.b
         AND NVL(t.terminal_id,-1) = -1 AND t.doc_type = s.d)
  WHEN NOT MATCHED THEN
    INSERT (company_id, branch_id, doc_type, prefix, next_number, pad_length, fy_id)
    VALUES (s.c, s.b, 'PINV', 'PINV-', 1, 6, v_fy_id);

  MERGE INTO numbering_series t
  USING (SELECT v_company_id AS c, v_branch_id AS b, 'PRET' AS d FROM dual) s
     ON (t.company_id = s.c AND NVL(t.branch_id,-1) = s.b
         AND NVL(t.terminal_id,-1) = -1 AND t.doc_type = s.d)
  WHEN NOT MATCHED THEN
    INSERT (company_id, branch_id, doc_type, prefix, next_number, pad_length, fy_id)
    VALUES (s.c, s.b, 'PRET', 'PRET-', 1, 6, v_fy_id);

  COMMIT;
END;
/

SELECT doc_type, prefix, next_number, pad_length FROM numbering_series ns
  JOIN company c ON c.company_id = ns.company_id
 WHERE c.company_code = 'JTC'
 ORDER BY doc_type;
