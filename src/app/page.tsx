import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">FrMake</h1>
      <p className="max-w-md text-center text-neutral-500">
        The token-efficient AI design copilot. Surgical edits, diff before
        debit, credits only spent on visible change.
      </p>
      <div className="flex gap-4 text-sm">
        <Link
          href="/sign-in"
          className="rounded-md bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-700 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
        >
          Sign in
        </Link>
        <Link
          href="/api/health"
          className="rounded-md border border-neutral-300 px-4 py-2 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Health check
        </Link>
      </div>
      <p className="text-xs text-neutral-400">Phase 0 — scaffolding</p>
    </main>
  );
}
