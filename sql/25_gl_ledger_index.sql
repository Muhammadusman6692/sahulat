-- ============================================================================
-- GL_REPORT support index — the account ledger inquiry scans gl_voucher_line
-- by coa_id; nothing indexed that column before this.
--
-- Safe to re-run.
-- ============================================================================

DECLARE
  PROCEDURE add_index (p_ddl VARCHAR2) IS
  BEGIN
    EXECUTE IMMEDIATE p_ddl;
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLCODE != -955 THEN RAISE; END IF;  -- ORA-00955: name already used
  END;
BEGIN
  add_index('CREATE INDEX ix_gl_line_coa ON gl_voucher_line(coa_id)');
END;
/
