"use client";

import posthog from "posthog-js";

/** No-ops without NEXT_PUBLIC_POSTHOG_KEY — see instrumentation-client.ts. */
export function trackEvent(event: string, properties?: Record<string, unknown>): void {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return;
  }
  posthog.capture(event, properties);
}

/** Merges the anonymous session with the real user id so server-side
 *  and client-side events land on the same PostHog person. */
export function identifyUser(userId: string): void {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return;
  }
  posthog.identify(userId);
}
