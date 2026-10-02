-- ============================================================================
-- Bank Payment/Receipt instrument details (BPV/BRV) — one row per
-- gl_voucher_hdr row, kept OUT of gl_voucher_hdr itself since that table is
-- shared by every voucher-posting module (JV, CPV/CRV, SINV, PINV, ...) and
-- a cheque/instrument isn't meaningful outside this one.
--
-- No deferred-posting / post-dated-cheque logic here: instrument_date is a
-- record-keeping field only, the GL still posts at the moment the voucher is
-- posted. PDC clearing workflow is out of scope for this pass.
--
-- Safe to re-run.
-- ============================================================================

DECLARE
  PROCEDURE create_if_missing IS
  BEGIN
    EXECUTE IMMEDIATE '
      CREATE TABLE bank_voucher_detail (
        voucher_id      NUMBER PRIMARY KEY REFERENCES gl_voucher_hdr(voucher_id),
        instrument_type VARCHAR2(20) NOT NULL
                         CHECK (instrument_type IN
                           (''CHEQUE'',''ONLINE_TRANSFER'',''PAY_ORDER'',''DD'',''RTGS'')),
        instrument_no   VARCHAR2(30),
        instrument_date DATE
      )';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLCODE != -955 THEN RAISE; END IF;  -- ORA-00955: table already exists
  END;
BEGIN
  create_if_missing;
END;
/
