"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function ErrorBoundary({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="max-w-md text-sm text-neutral-500">
        This has been reported. Try reloading the page — if it keeps
        happening, let us know.
      </p>
      {error.digest && (
        <p className="text-xs text-neutral-400" data-testid="error-digest">
          Reference: {error.digest}
        </p>
      )}
    </main>
  );
}
