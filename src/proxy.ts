import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Next.js 16 convention: this file replaces middleware.ts.
// Clerk only runs when keys are configured (Phase 0 stub) so the app
// boots and CI builds without secrets. No routes are gated yet.
const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

const proxy = clerkEnabled
  ? clerkMiddleware()
  : (): NextResponse => NextResponse.next();

export default proxy;

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
