import type { Instrumentation } from "next";
import * as Sentry from "@sentry/nextjs";

/**
 * Server-side error monitoring. Only initializes when SENTRY_DSN is set
 * (the app must still boot and CI must still build with zero secrets —
 * same convention as Clerk/Stripe elsewhere in this project).
 */
const sentryEnabled = Boolean(process.env.SENTRY_DSN);

export async function register(): Promise<void> {
  if (!sentryEnabled) {
    return;
  }
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
}

/** Reports uncaught errors from Server Components AND Route Handlers
 *  (API routes) — this is the backend half of Phase 6's "any time the
 *  app crashes or an API route throws, it should get logged" ask. */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (!sentryEnabled) {
    return;
  }
  await Sentry.captureRequestError(error, request, context);
};
