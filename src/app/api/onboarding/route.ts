import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

const clerkEnabled = (): boolean => Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

/**
 * Onboarding state lives in Clerk publicMetadata so it follows the user
 * across devices. Without Clerk (dev bypass) the walkthrough never shows.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  if (!clerkEnabled()) {
    return NextResponse.json({ onboarded: true });
  }
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  return NextResponse.json({ onboarded: user.publicMetadata.onboarded === true });
}

export async function POST(request: Request): Promise<NextResponse> {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  if (clerkEnabled()) {
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, { publicMetadata: { onboarded: true } });
  }
  return NextResponse.json({ onboarded: true });
}
