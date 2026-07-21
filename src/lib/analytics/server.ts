import { logger } from "@/lib/logger";

/**
 * Server-side event tracking via PostHog's plain capture HTTP endpoint
 * (no posthog-node dependency needed for a handful of events). The
 * PostHog project key is a write-only ingestion key by design — the
 * same NEXT_PUBLIC_ key used client-side is the correct one to reuse
 * here, unlike a true secret.
 */
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

export async function trackServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey) {
    return;
  }
  try {
    await fetch(`${POSTHOG_HOST}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        distinct_id: distinctId,
        properties,
      }),
    });
  } catch (error) {
    // Analytics must never break the request it's attached to.
    logger.warn(`[analytics] failed to send "${event}": ${String(error)}`);
  }
}
