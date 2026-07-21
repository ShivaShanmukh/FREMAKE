"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Catches errors in the root layout itself (rare — most crashes hit
 * app/error.tsx instead). Must define its own html/body per Next.js
 * convention; can't reuse the root layout's fonts/providers since this
 * file replaces it entirely when active.
 */
export default function GlobalError({
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
    <html lang="en">
      <body>
        <main style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: "100vh", padding: 32, textAlign: "center" }}>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>Something went wrong</h2>
          <p style={{ maxWidth: 420, fontSize: 14, color: "#737373" }}>
            This has been reported. Try reloading the page.
          </p>
          {error.digest && (
            <p style={{ fontSize: 12, color: "#a3a3a3" }}>Reference: {error.digest}</p>
          )}
        </main>
      </body>
    </html>
  );
}
