-- ============================================================================
-- PERIOD CLOSE — audit log table + the Retained Earnings default account role
--
-- period_close_log records every close/reopen action taken through
-- pkg_period_close (sql/23_pkg_period_close.sql). fy_id is always set;
-- period_id is set only for period-level actions (NULL for FY_CLOSE/
-- FY_REOPEN rows). closing_voucher_id is set only when the action posted or
-- reversed the year-end CLOSING voucher.
--
-- RETAINED_EARNINGS is added to default_account_role now, alongside this
-- table, so it is configured on the existing Default GL Accounts screen
-- (app/(admin)/admin/default-accounts/) before the year-end closing
-- procedures that depend on it ship.
--
-- Safe to re-run.
-- ============================================================================

SET DEFINE OFF

CREATE TABLE period_close_log (
  log_id              NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fy_id               NUMBER NOT NULL REFERENCES fiscal_year(fy_id),
  period_id           NUMBER REFERENCES fiscal_period(period_id),
  action              VARCHAR2(20) NOT NULL CHECK (action IN
                       ('PERIOD_CLOSE','PERIOD_REOPEN','FY_CLOSE','FY_REOPEN')),
  reason              VARCHAR2(400),
  closing_voucher_id  NUMBER REFERENCES gl_voucher_hdr(voucher_id),
  performed_by        NUMBER NOT NULL REFERENCES app_user(user_id),
  performed_on        TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
);
CREATE INDEX ix_period_close_log_fy ON period_close_log(fy_id);

MERGE INTO default_account_role t
USING (SELECT 'RETAINED_EARNINGS' c FROM dual) s ON (t.role_code = s.c)
WHEN NOT MATCHED THEN INSERT (role_code, role_name, description)
VALUES ('RETAINED_EARNINGS', 'Retained Earnings',
        'Credited (profit) or debited (loss) with the fiscal year''s net Income/Expense movement when the year-end closing entry posts.');

COMMIT;
