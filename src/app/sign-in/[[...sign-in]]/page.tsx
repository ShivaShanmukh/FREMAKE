import { SignIn } from "@clerk/nextjs";

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function SignInPage() {
  if (!clerkEnabled) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="max-w-md text-sm text-neutral-500">
          Clerk is not configured yet. Copy <code>.env.example</code> to{" "}
          <code>.env.local</code> and set{" "}
          <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and{" "}
          <code>CLERK_SECRET_KEY</code>, then restart the dev server.
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <SignIn />
    </main>
  );
}
