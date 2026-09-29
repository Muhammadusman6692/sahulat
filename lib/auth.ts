import "server-only";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { query, execute } from "@/lib/oracle";

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

/**
 * The token carries identity only. Permissions and scope are read per request
 * in lib/dal.ts so that granting or revoking access takes effect immediately
 * rather than at the user's next sign-in.
 */
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

        // Unknown user and wrong password fail identically, so the response
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

        return {
          id: String(user.USER_ID),
          name: user.FULL_NAME,
          username: user.USERNAME,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = Number(user.id);
        token.username = (user as { username: string }).username;
        token.fullName = user.name ?? "";
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        userId: token.userId as number,
        username: token.username as string,
        fullName: token.fullName as string,
      };
      return session;
    },
  },
};
