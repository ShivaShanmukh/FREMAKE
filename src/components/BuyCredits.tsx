"use client";

import { useEffect, useState } from "react";
import { CREDIT_PACKAGES } from "@/lib/billing/packages";

type BuyCreditsProps = {
  disabled: boolean;
  /** Re-fetch the balance (used after returning from checkout). */
  onRefresh: () => void;
};

/** Top-up menu → Stripe Checkout. Success returns to /studio?topup=success. */
export function BuyCredits({ disabled, onRefresh }: BuyCreditsProps) {
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Derived once from the return-from-checkout URL (client-only).
  const [banner] = useState<"success" | "cancelled" | null>(() => {
    if (typeof window === "undefined") return null;
    const topup = new URLSearchParams(window.location.search).get("topup");
    return topup === "success" || topup === "cancelled" ? topup : null;
  });

  useEffect(() => {
    if (!banner) return;
    window.history.replaceState(null, "", "/studio");
    if (banner === "success") {
      // The webhook can land a moment after the redirect — refresh now
      // and again shortly so the badge catches the new balance.
      onRefresh();
      const timer = setTimeout(onRefresh, 2500);
      return () => clearTimeout(timer);
    }
    // onRefresh is stable (useCallback in useCredits).
  }, [banner, onRefresh]);

  async function checkout(packageId: string): Promise<void> {
    setStarting(packageId);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });
      const data: { url?: string; error?: string } = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? `Checkout failed (HTTP ${res.status}).`);
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError("Network error — checkout not started.");
    } finally {
      setStarting(null);
    }
  }

  return (
    <div className="relative">
      {banner === "success" && (
        <p className="absolute right-0 top-10 z-10 w-64 rounded-md border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" data-testid="topup-success">
          Payment received — your credits have been added.
        </p>
      )}
      {banner === "cancelled" && (
        <p className="absolute right-0 top-10 z-10 w-64 rounded-md border border-neutral-300 bg-neutral-50 p-2 text-xs text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300" data-testid="topup-cancelled">
          Checkout cancelled — nothing was charged.
        </p>
      )}
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        data-testid="buy-credits"
        className="rounded-md border border-neutral-300 px-3 py-1 text-sm disabled:opacity-40 dark:border-neutral-700"
      >
        Buy credits
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-10 flex w-56 flex-col gap-1 rounded-md border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
          {CREDIT_PACKAGES.map((pack) => (
            <button
              key={pack.id}
              onClick={() => void checkout(pack.id)}
              disabled={starting !== null}
              data-testid={`package-${pack.id}`}
              className="rounded px-3 py-2 text-left text-sm hover:bg-neutral-100 disabled:opacity-40 dark:hover:bg-neutral-800"
            >
              {starting === pack.id ? "Starting checkout…" : pack.label}
            </button>
          ))}
          {error && <p className="px-2 py-1 text-xs text-red-700 dark:text-red-300">{error}</p>}
        </div>
      )}
    </div>
  );
}
