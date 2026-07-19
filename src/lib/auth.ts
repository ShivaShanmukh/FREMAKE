import { auth } from "@clerk/nextjs/server";

/**
 * Resolves the authenticated user for API routes.
 *
 * Real path: Clerk (when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set).
 *
 * Dev bypass: ONLY when Clerk is not configured AND DEV_AUTH_BYPASS=1 is
 * set explicitly, the `x-dev-user` request header names the user. This
 * exists so the ledger and route guards can be exercised end-to-end before
 * Clerk keys arrive. Never set DEV_AUTH_BYPASS in a deployed environment —
 * with Clerk keys present the bypass is dead code.
 */
export async function requireUserId(request: Request): Promise<string | null> {
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    const { userId } = await auth();
    return userId;
  }
  if (process.env.DEV_AUTH_BYPASS === "1") {
    const devUser = request.headers.get("x-dev-user");
    return devUser && devUser.length > 0 ? devUser : null;
  }
  return null;
}
