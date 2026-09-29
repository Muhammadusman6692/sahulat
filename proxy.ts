import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/forbidden"];

/**
 * Optimistic redirect only — it checks that a session cookie is present and
 * never reads the database. Real authentication and permission checks live in
 * lib/dal.ts, which runs per page/route/Server Action. Server Actions POST to
 * the route they live on, so anything excluded by the matcher below skips this
 * entirely; that is fine precisely because this is not the gate.
 */
export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const hasSession =
    req.cookies.has("next-auth.session-token") ||
    req.cookies.has("__Secure-next-auth.session-token");

  if (!hasSession) {
    const url = new URL("/login", req.nextUrl);
    if (pathname !== "/") url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Without a matcher this would also run on _next/static and block the app's
// own CSS and JS.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
