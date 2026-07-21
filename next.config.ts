import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

// Sentry only wraps the build when a DSN is configured — mirrors the
// Clerk/Stripe stub pattern so the app builds (and CI passes) with zero
// secrets. Without a DSN, next.config stays a plain pass-through.
const sentryEnabled = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);

export default sentryEnabled
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: true,
      webpack: { treeshake: { removeDebugLogging: true } },
    })
  : nextConfig;
