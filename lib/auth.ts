import "server-only";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { query, execute } from "@/lib/oracle";
import { ACTIONS } from "@/lib/permissions";
import type { PermissionMap, ScopeRow, SessionUser } from "@/lib/permissions";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

type UserRow = {
  USER_ID: number;
  USERNAME: string;
  FULL_NAME: string;
  PASSWORD_HASH: string;
  IS_ACTIVE: string;
  LOCKED_UNTIL: Date | null;
};

type PermRow = {
  MODULE_CODE: string;
  CAN_VIEW: string;
  CAN_CREATE: string;
  CAN_EDIT: string;
  CAN_POST: string;
  CAN_CANCEL: string;
  CAN_PRINT: string;
  CAN_APPROVE: string;
};

function packPermissions(rows: PermRow[]): PermissionMap {
  const map: PermissionMap = {};
  for (const r of rows) {
    // A module may appear once per role, so OR the grants together.
    let letters = map[r.MODULE_CODE] ?? "";
    const add = (flag: string, letter: string) => {
      if (flag === "Y" && !letters.includes(letter)) letters += letter;
    };
    add(r.CAN_VIEW, ACTIONS.VIEW);
    add(r.CAN_CREATE, ACTIONS.CREATE);
    add(r.CAN_EDIT, ACTIONS.EDIT);
    add(r.CAN_POST, ACTIONS.POST);
    add(r.CAN_CANCEL, ACTIONS.CANCEL);
    add(r.CAN_PRINT, ACTIONS.PRINT);
    add(r.CAN_APPROVE, ACTIONS.APPROVE);
    map[r.MODULE_CODE] = letters;
  }
  return map;
}

async function loadProfile(userId: number) {
  const [roles, perms, access] = await Promise.all([
    query<{ ROLE_NAME: string }>(
      `SELECT r.role_name
         FROM user_role ur
         JOIN role r ON r.role_id = ur.role_id
        WHERE ur.user_id = :id AND r.active_yn = 'Y'
        ORDER BY r.role_name`,
      { id: userId },
    ),
    query<PermRow>(
      `SELECT rp.module_code, rp.can_view, rp.can_create, rp.can_edit,
              rp.can_post, rp.can_cancel, rp.can_print, rp.can_approve
         FROM user_role ur
         JOIN role r ON r.role_id = ur.role_id
         JOIN role_permission rp ON rp.role_id = ur.role_id
        WHERE ur.user_id = :id AND r.active_yn = 'Y'`,
      { id: userId },
    ),
    query<{ COMPANY_ID: number; BRANCH_ID: number | null; WAREHOUSE_ID: number | null }>(
      `SELECT company_id, branch_id, warehouse_id
         FROM user_company_access
        WHERE user_id = :id`,
      { id: userId },
    ),
  ]);

  return {
    roles: roles.map((r) => r.ROLE_NAME),
    permissions: packPermissions(perms),
    access: access.map<ScopeRow>((a) => ({
      companyId: a.COMPANY_ID,
      branchId: a.BRANCH_ID,
      warehouseId: a.WAREHOUSE_ID,
    })),
  };
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials.password) return null;

        const rows = await query<UserRow>(
          `SELECT user_id, username, full_name, password_hash, is_active, locked_until
             FROM app_user
            WHERE username = :username`,
          { username: credentials.username },
        );
        const user = rows[0];

        // Same rejection for unknown user and wrong password, so the response
        // does not reveal which usernames exist.
        if (!user) return null;
        if (user.IS_ACTIVE !== "Y") return null;
        if (user.LOCKED_UNTIL && user.LOCKED_UNTIL.getTime() > Date.now()) return null;

        const ok = await bcrypt.compare(credentials.password, user.PASSWORD_HASH);

        if (!ok) {
          await execute(
            `UPDATE app_user
                SET failed_attempts = failed_attempts + 1,
                    locked_until = CASE WHEN failed_attempts + 1 >= :maxTries
                                        THEN SYSTIMESTAMP + NUMTODSINTERVAL(:mins, 'MINUTE')
                                        ELSE locked_until END
              WHERE user_id = :id`,
            { maxTries: MAX_FAILED_ATTEMPTS, mins: LOCK_MINUTES, id: user.USER_ID },
          );
          return null;
        }

        await execute(
          `UPDATE app_user
              SET failed_attempts = 0, locked_until = NULL, last_login = SYSTIMESTAMP
            WHERE user_id = :id`,
          { id: user.USER_ID },
        );

        const profile = await loadProfile(user.USER_ID);

        return {
          id: String(user.USER_ID),
          name: user.FULL_NAME,
          username: user.USERNAME,
          ...profile,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as unknown as SessionUser & { id: string; name: string };
        token.userId = Number(u.id);
        token.username = u.username;
        token.fullName = u.name;
        token.roles = u.roles;
        token.permissions = u.permissions;
        token.access = u.access;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        userId: token.userId as number,
        username: token.username as string,
        fullName: token.fullName as string,
        roles: token.roles as string[],
        permissions: token.permissions as PermissionMap,
        access: token.access as ScopeRow[],
      };
      return session;
    },
  },
};
