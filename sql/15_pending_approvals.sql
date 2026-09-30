-- ============================================================================
-- Pending Approvals inbox — the approver-facing half of the approval_rule
-- workflow added earlier. approval_instance had no submitted-date or amount
-- column, so the inbox would have nothing to show but a bare doc_id; this
-- adds both. Also seeds the module_function row + Super Admin grant so the
-- new screen is menu-driven and permission-gated like everything else.
--
-- Safe to re-run.
-- ============================================================================

SET DEFINE OFF

-- ----------------------------------------------------------------------------
-- 1. Columns (guarded so the script can be re-run)
-- ----------------------------------------------------------------------------
DECLARE
  PROCEDURE add_column (p_ddl VARCHAR2) IS
  BEGIN
    EXECUTE IMMEDIATE p_ddl;
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLCODE != -1430 THEN RAISE; END IF;  -- ORA-01430: column already exists
  END;
BEGIN
  add_column('ALTER TABLE approval_instance ADD (
     submitted_on TIMESTAMP DEFAULT SYSTIMESTAMP,
     doc_amount   NUMBER(18,2))');
END;
/

-- ----------------------------------------------------------------------------
-- 2. Menu entry
-- ----------------------------------------------------------------------------
MERGE INTO module_function t
USING (SELECT 'PENDING_APPROVALS' AS c FROM dual) s
   ON (t.module_code = s.c)
WHEN MATCHED THEN
  UPDATE SET module_name = 'Pending Approvals', module_group = 'ADMIN', sort_order = 105
WHEN NOT MATCHED THEN
  INSERT (module_code, module_name, module_group, sort_order, build_status)
  VALUES ('PENDING_APPROVALS', 'Pending Approvals', 'ADMIN', 105, 'PENDING');
COMMIT;

-- ----------------------------------------------------------------------------
-- 3. Super Admin must be able to see the new module, same as every module
--    added after the initial menu tree seed.
-- ----------------------------------------------------------------------------
INSERT INTO role_permission (role_id, module_code, can_view, can_create,
                             can_edit, can_post, can_cancel, can_print, can_approve)
SELECT r.role_id, 'PENDING_APPROVALS', 'Y','Y','Y','Y','Y','Y','Y'
  FROM role r
 WHERE r.company_id IS NULL
   AND r.role_name = 'Super Admin'
   AND NOT EXISTS (SELECT 1 FROM role_permission rp
                    WHERE rp.role_id = r.role_id
                      AND rp.module_code = 'PENDING_APPROVALS');
COMMIT;

UPDATE module_function
   SET build_status = 'COMPLETED',
       build_notes  = 'Lists approval_instance rows PENDING at a step where one of the caller''s roles is the approval_rule approver (the join is the authorization, re-checked atomically in the Approve/Reject UPDATE). Verified against the live schema with manually-seeded rows, including that a non-approver cannot see or act on a row. Empty in real use until a posting flow creates instances.',
       completed_on = SYSDATE
 WHERE module_code = 'PENDING_APPROVALS';
COMMIT;
