import "server-only";
import bcrypt from "bcryptjs";
import { query, execute, withTransaction, type Tx } from "@/lib/oracle";

export type UserRow = {
  USER_ID: number;
  USERNAME: string;
  FULL_NAME: string;
  EMAIL: string | null;
  IS_ACTIVE: string;
  LOCKED_UNTIL: Date | null;
  ROLES: string | null;
  ACCESS_SUMMARY: string | null;
};

export async function listUsers() {
  return query<UserRow>(
    `SELECT u.user_id, u.username, u.full_name, u.email, u.is_active, u.locked_until,
            (SELECT LISTAGG(r.role_name, ', ') WITHIN GROUP (ORDER BY r.role_name)
               FROM user_role ur JOIN role r ON r.role_id = ur.role_id
              WHERE ur.user_id = u.user_id) AS roles,
            (SELECT LISTAGG(
                      c.company_code || CASE WHEN uca.branch_id IS NOT NULL
                                              THEN ' / ' || b.branch_code ELSE ' (all)' END,
                      ', ') WITHIN GROUP (ORDER BY c.company_code)
               FROM user_company_access uca
               JOIN company c ON c.company_id = uca.company_id
               LEFT JOIN branch b ON b.branch_id = uca.branch_id
              WHERE uca.user_id = u.user_id) AS access_summary
       FROM app_user u
      ORDER BY u.username`,
  );
}

export type UserDetail = {
  USER_ID: number;
  USERNAME: string;
  FULL_NAME: string;
  EMAIL: string | null;
  PHONE: string | null;
  IS_ACTIVE: string;
  LOCKED_UNTIL: Date | null;
  FAILED_ATTEMPTS: number;
};

export async function getUser(userId: number) {
  const rows = await query<UserDetail>(
    `SELECT user_id, username, full_name, email, phone, is_active,
            locked_until, failed_attempts
       FROM app_user WHERE user_id = :id`,
    { id: userId },
  );
  return rows[0] ?? null;
}

export async function getUserRoleIds(userId: number) {
  const rows = await query<{ ROLE_ID: number }>(
    `SELECT role_id FROM user_role WHERE user_id = :id`,
    { id: userId },
  );
  return rows.map((r) => r.ROLE_ID);
}

export type AccessRow = {
  companyId: number;
  branchId: number | null;
  warehouseId: number | null;
};

export async function getUserAccessRows(userId: number): Promise<AccessRow[]> {
  const rows = await query<{
    COMPANY_ID: number;
    BRANCH_ID: number | null;
    WAREHOUSE_ID: number | null;
  }>(
    `SELECT company_id, branch_id, warehouse_id
       FROM user_company_access WHERE user_id = :id`,
    { id: userId },
  );
  return rows.map((r) => ({
    companyId: r.COMPANY_ID,
    branchId: r.BRANCH_ID,
    warehouseId: r.WAREHOUSE_ID,
  }));
}

/** Roles module (ROLE_MAINT) doesn't exist yet, so this lives here for now. */
export async function listActiveRoles() {
  return query<{ ROLE_ID: number; ROLE_NAME: string; COMPANY_CODE: string | null }>(
    `SELECT r.role_id, r.role_name, c.company_code
       FROM role r
       LEFT JOIN company c ON c.company_id = r.company_id
      WHERE r.active_yn = 'Y'
      ORDER BY r.role_name`,
  );
}

export type UserInput = {
  username: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  activeYn: "Y" | "N";
};

async function replaceRoles(tx: Tx, userId: number, roleIds: number[]) {
  await tx.execute(`DELETE FROM user_role WHERE user_id = :id`, { id: userId });
  for (const roleId of roleIds) {
    await tx.execute(
      `INSERT INTO user_role (user_id, role_id) VALUES (:userId, :roleId)`,
      { userId, roleId },
    );
  }
}

async function replaceAccess(tx: Tx, userId: number, rows: AccessRow[]) {
  await tx.execute(`DELETE FROM user_company_access WHERE user_id = :id`, { id: userId });
  for (const row of rows) {
    await tx.execute(
      `INSERT INTO user_company_access (user_id, company_id, branch_id, warehouse_id)
       VALUES (:userId, :companyId, :branchId, :warehouseId)`,
      {
        userId,
        companyId: row.companyId,
        branchId: row.branchId,
        warehouseId: row.warehouseId,
      },
    );
  }
}

export async function createUser(
  input: UserInput,
  password: string,
  roleIds: number[],
  accessRows: AccessRow[],
) {
  const passwordHash = await bcrypt.hash(password, 10);

  await withTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO app_user (username, password_hash, full_name, email, phone, is_active)
       VALUES (:username, :passwordHash, :fullName, :email, :phone, :activeYn)`,
      { ...input, passwordHash },
    );

    // Read the id back on the unique username rather than an OUT bind, which
    // the driver rejects elsewhere in this codebase.
    const [created] = await tx.query<{ USER_ID: number }>(
      `SELECT user_id FROM app_user WHERE username = :username`,
      { username: input.username },
    );
    if (!created) throw new Error("User row was not found after insert");

    await replaceRoles(tx, created.USER_ID, roleIds);
    await replaceAccess(tx, created.USER_ID, accessRows);
  });
}

/** username is fixed once created — the same identity-lock rule as every other master here. */
export async function updateUser(
  userId: number,
  input: Omit<UserInput, "username">,
  roleIds: number[],
  accessRows: AccessRow[],
) {
  await withTransaction(async (tx) => {
    await tx.execute(
      `UPDATE app_user
          SET full_name = :fullName, email = :email, phone = :phone, is_active = :activeYn
        WHERE user_id = :userId`,
      { ...input, userId },
    );
    await replaceRoles(tx, userId, roleIds);
    await replaceAccess(tx, userId, accessRows);
  });
}

/** Also clears any lockout, since a freshly-set password invalidates whatever attempt locked the account. */
export async function setUserPassword(userId: number, password: string) {
  const passwordHash = await bcrypt.hash(password, 10);
  await execute(
    `UPDATE app_user
        SET password_hash = :passwordHash, failed_attempts = 0, locked_until = NULL
      WHERE user_id = :userId`,
    { passwordHash, userId },
  );
}

export async function unlockUser(userId: number) {
  await execute(
    `UPDATE app_user SET failed_attempts = 0, locked_until = NULL WHERE user_id = :userId`,
    { userId },
  );
}
