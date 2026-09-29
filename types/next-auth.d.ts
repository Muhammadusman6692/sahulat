declare module "next-auth" {
  /**
   * Identity only. Permissions and scope are read per request in lib/dal.ts,
   * never carried in the token.
   */
  interface Session {
    user: {
      userId: number;
      username: string;
      fullName: string;
    };
  }

  interface User {
    id: string;
    name: string;
    username: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: number;
    username: string;
    fullName: string;
  }
}

export {};
