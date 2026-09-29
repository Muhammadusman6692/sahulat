import type { PermissionMap, ScopeRow } from "@/lib/permissions";

declare module "next-auth" {
  interface Session {
    user: {
      userId: number;
      username: string;
      fullName: string;
      roles: string[];
      permissions: PermissionMap;
      access: ScopeRow[];
    };
  }

  interface User {
    id: string;
    name: string;
    username: string;
    roles: string[];
    permissions: PermissionMap;
    access: ScopeRow[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: number;
    username: string;
    fullName: string;
    roles: string[];
    permissions: PermissionMap;
    access: ScopeRow[];
  }
}
