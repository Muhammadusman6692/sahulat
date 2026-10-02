-- ============================================================================
-- Numbering series for CLOSING (year-end closing entry), needed before
-- pkg_period_close.close_fiscal_year can post its first voucher.
--
-- A closing entry is a company-level document, but gl_voucher_hdr.branch_id
-- is NOT NULL, so pkg_period_close posts it to whichever branch already
-- carries the company's JV numbering (the lowest branch_id, if more than
-- one) — matching how it resolves that branch at close time. One row per
-- company that already has JV numbering, not per branch — only that one
-- branch's CLOSING series will ever be used.
--
-- Safe to re-run.
-- ============================================================================

DECLARE
  v_branch_id NUMBER;
  v_fy_id     NUMBER;
BEGIN
  FOR c IN (SELECT DISTINCT company_id FROM numbering_series WHERE doc_type = 'JV') LOOP
    SELECT MIN(branch_id) INTO v_branch_id
    FROM numbering_series WHERE company_id = c.company_id AND doc_type = 'JV';

    SELECT fy_id INTO v_fy_id
    FROM numbering_series
    WHERE company_id = c.company_id AND branch_id = v_branch_id AND doc_type = 'JV';

    MERGE INTO numbering_series t
    USING (SELECT c.company_id AS co, v_branch_id AS b, 'CLOSING' AS d FROM dual) s
       ON (t.company_id = s.co AND NVL(t.branch_id,-1) = s.b
           AND NVL(t.terminal_id,-1) = -1 AND t.doc_type = s.d)
    WHEN NOT MATCHED THEN
      INSERT (company_id, branch_id, doc_type, prefix, next_number, pad_length, fy_id)
      VALUES (s.co, s.b, 'CLOSING', 'CLS-', 1, 6, v_fy_id);
  END LOOP;

  COMMIT;
END;
/

SELECT c.company_code, ns.branch_id, ns.doc_type, ns.prefix, ns.next_number
  FROM numbering_series ns
  JOIN company c ON c.company_id = ns.company_id
 WHERE ns.doc_type = 'CLOSING'
 ORDER BY c.company_code;
