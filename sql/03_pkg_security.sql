-- ============================================================================
-- PKG_SECURITY - server-side permission enforcement (defense in depth)
-- Called by every posting/edit/cancel procedure BEFORE any DML.
-- Next.js/middleware also checks the same role_permission table for UI
-- show/hide, but this is the layer that cannot be bypassed by a direct
-- REST call.
-- ============================================================================
CREATE OR REPLACE PACKAGE pkg_security AS

  -- Raises -20101 if the user's roles do not grant the requested action on
  -- the module. p_action in ('VIEW','CREATE','EDIT','POST','CANCEL','PRINT','APPROVE').
  PROCEDURE check_permission (
    p_user_id     IN NUMBER,
    p_module_code IN VARCHAR2,
    p_action      IN VARCHAR2
  );

  -- Raises -20102 if the user is not scoped to this company/branch/warehouse.
  -- p_branch_id / p_warehouse_id may be NULL to check company-level only.
  PROCEDURE check_scope (
    p_user_id      IN NUMBER,
    p_company_id   IN NUMBER,
    p_branch_id    IN NUMBER DEFAULT NULL,
    p_warehouse_id IN NUMBER DEFAULT NULL
  );

  FUNCTION has_permission (
    p_user_id     IN NUMBER,
    p_module_code IN VARCHAR2,
    p_action      IN VARCHAR2
  ) RETURN BOOLEAN;

END pkg_security;
/

CREATE OR REPLACE PACKAGE BODY pkg_security AS

  FUNCTION has_permission (
    p_user_id     IN NUMBER,
    p_module_code IN VARCHAR2,
    p_action      IN VARCHAR2
  ) RETURN BOOLEAN IS
    v_count NUMBER;
    v_col   VARCHAR2(20);
  BEGIN
    v_col := CASE UPPER(p_action)
               WHEN 'VIEW'    THEN 'can_view'
               WHEN 'CREATE'  THEN 'can_create'
               WHEN 'EDIT'    THEN 'can_edit'
               WHEN 'POST'    THEN 'can_post'
               WHEN 'CANCEL'  THEN 'can_cancel'
               WHEN 'PRINT'   THEN 'can_print'
               WHEN 'APPROVE' THEN 'can_approve'
               ELSE NULL
             END;
    IF v_col IS NULL THEN
      RAISE_APPLICATION_ERROR(-20100, 'Unknown permission action: ' || p_action);
    END IF;

    EXECUTE IMMEDIATE '
      SELECT COUNT(*)
      FROM user_role ur
      JOIN role_permission rp ON rp.role_id = ur.role_id
      JOIN role r ON r.role_id = ur.role_id
      WHERE ur.user_id = :1
        AND rp.module_code = :2
        AND rp.' || v_col || ' = ''Y''
        AND r.active_yn = ''Y'''
      INTO v_count USING p_user_id, p_module_code;

    RETURN v_count > 0;
  END has_permission;

  PROCEDURE check_permission (
    p_user_id     IN NUMBER,
    p_module_code IN VARCHAR2,
    p_action      IN VARCHAR2
  ) IS
  BEGIN
    IF NOT has_permission(p_user_id, p_module_code, p_action) THEN
      RAISE_APPLICATION_ERROR(-20101,
        'User ' || p_user_id || ' lacks ' || p_action || ' permission on ' || p_module_code);
    END IF;
  END check_permission;

  PROCEDURE check_scope (
    p_user_id      IN NUMBER,
    p_company_id   IN NUMBER,
    p_branch_id    IN NUMBER DEFAULT NULL,
    p_warehouse_id IN NUMBER DEFAULT NULL
  ) IS
    v_count NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_count
    FROM user_company_access
    WHERE user_id = p_user_id
      AND company_id = p_company_id
      AND (branch_id IS NULL OR branch_id = p_branch_id)
      AND (warehouse_id IS NULL OR warehouse_id = p_warehouse_id);

    IF v_count = 0 THEN
      RAISE_APPLICATION_ERROR(-20102,
        'User ' || p_user_id || ' is not authorized for company/branch/warehouse scope');
    END IF;
  END check_scope;

END pkg_security;
/
