import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

/**
 * Client-side error monitoring and analytics init. Both are no-ops
 * without their respective keys — the app must still work with zero
 * secrets, same convention as Clerk/Stripe/Sentry server-side.
 */

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    tracesSampleRate: 1.0,
  });
}

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (posthogKey) {
  posthog.init(posthogKey, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false,
  });
}

// Lets Sentry instrument client-side route transitions (Next.js's
// recommended hook for this SDK version).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
