# Phase 6 — PostHog Live Verification

Commits `220f8cd` (rate limiting + Sentry/PostHog scaffolding) and `b61d82e`
(Sentry outage-banner live-verify) landed the instrumentation. The Sentry
side was live-verified via a real DB-outage crash; the PostHog side was
left with `export_downloaded` untested because the ingestion key is
write-only and there is no read-scoped token to query events back
(see commit `220f8cd` notes).

## `export_downloaded` — live-verified 2026-07-23

Verified by driving the real running app end-to-end (real Clerk sign-in
via the sign-in-token ticket flow for the existing `alice` test user,
real `/api/generate` call, real click on the export button) and
capturing the outgoing network traffic instead of querying PostHog back
— the only verification path available without a read-scoped key.

**Gotcha found in the verification method itself, not the app:** the
first attempt (headless Chromium, default Playwright fingerprint) showed
**zero** capture requests reaching PostHog at all — not even `$identify`
on sign-in — while `config.js` / `flags/` requests worked fine. Root
cause: PostHog's client SDK silently drops `capture()` calls when it
detects an automated browser (`navigator.webdriver: true`, a
`HeadlessChrome` user agent). It fails silently — `posthog.capture()`
returns normally, no error, nothing queued. Re-ran headed, with
`navigator.webdriver` patched out and a normal Chrome UA — capture
requests started flowing immediately.

Second false negative: `posthog-js` gzip-compresses the batch body
before sending (`i/v0/e/` endpoint), so a raw substring match against
`postData()` doesn't find the event name even when it's really there.
Fixed by gunzipping the captured request body before matching.

**Actual decoded payload, real request to `eu.i.posthog.com/i/v0/e/`:**

```json
{
  "event": "export_downloaded",
  "distinct_id": "user_3GjJEoIxwc89CdU6V4hkwSZ7UNw",
  "screenCount": 5,
  "token": "phc_ArEA4UuMqr76ADSuEyqzUwi76QWMTHZtA4jLFCwkjZzB"
}
```

(trimmed to the properties that matter — full payload also carries
PostHog's standard autocapture context: URL, browser, session id, etc.)

`distinct_id` matches alice's real Clerk user id and `screenCount`
matches the actual number of generated screens — confirms `trackEvent`
in `src/app/studio/page.tsx` fires with the real user and real data, and
the request that leaves the browser is well-formed and reaches
PostHog's ingestion host. Whether it's actually indexed/queryable in the
PostHog project dashboard still can't be confirmed from this session
(no read-scoped key) — same limitation noted for Sentry. Recommend Siva
spot-check the PostHog dashboard for this event once, same as the
manual Sentry dashboard check.

## Event status (all 5, updated)

| Event | Status |
|---|---|
| `signup` | live-verified (server-side, prior session) |
| `generation_completed` | live-verified (server-side, prior session) |
| `edit_approved` | live-verified (server-side, prior session) |
| `credit_topup` | live-verified (server-side, prior session) |
| `export_downloaded` | **live-verified 2026-07-23** (client-side, network-capture method above) |

All 5 of 5 PostHog events now have live evidence of firing correctly.
