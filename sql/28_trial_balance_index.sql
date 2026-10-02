-- ============================================================================
-- TRIAL_BALANCE support index — the trial balance scans gl_voucher_hdr by
-- company_id/status/voucher_date for every postable account's opening and
-- period movement; nothing indexed that combination before this.
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
  add_index('CREATE INDEX ix_gl_hdr_co_status_date ON gl_voucher_hdr(company_id, status, voucher_date)');
END;
/
