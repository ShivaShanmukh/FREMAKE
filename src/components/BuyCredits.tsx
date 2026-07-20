"use client";

import { useState } from "react";
import { CREDIT_PACKAGES } from "@/lib/billing/packages";
import { CheckoutModal } from "./CheckoutModal";

type BuyCreditsProps = {
  disabled: boolean;
  /** Re-fetch the balance (called once Stripe confirms payment, and again
   *  shortly after in case the webhook lands a moment later). */
  onRefresh: () => void;
};

type PendingPayment = { clientSecret: string; publishableKey: string; label: string };

/** Top-up menu → embedded Stripe Elements checkout (see CheckoutModal). */
export function BuyCredits({ disabled, onRefresh }: BuyCreditsProps) {
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingPayment | null>(null);
  const [paid, setPaid] = useState(false);

  async function startCheckout(packageId: string): Promise<void> {
    setStarting(packageId);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });
      const data: { clientSecret?: string; publishableKey?: string; label?: string; error?: string } =
        await res.json();
      if (!res.ok || !data.clientSecret || !data.publishableKey || !data.label) {
        setError(data.error ?? `Checkout failed (HTTP ${res.status}).`);
        return;
      }
      setOpen(false);
      setPending({ clientSecret: data.clientSecret, publishableKey: data.publishableKey, label: data.label });
    } catch {
      setError("Network error — checkout not started.");
    } finally {
      setStarting(null);
    }
  }

  function handlePaid(): void {
    setPending(null);
    setPaid(true);
    // The ledger credit comes from the webhook, which can land a moment
    // after Stripe confirms client-side — refresh now and again shortly.
    onRefresh();
    setTimeout(onRefresh, 2500);
  }

  return (
    <div className="relative">
      {paid && (
        <p
          className="absolute right-0 top-10 z-10 w-64 rounded-md border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          data-testid="topup-success"
        >
          Payment received — your credits have been added.
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
              onClick={() => void startCheckout(pack.id)}
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
      {pending && (
        <CheckoutModal
          clientSecret={pending.clientSecret}
          publishableKey={pending.publishableKey}
          label={pending.label}
          onClose={() => setPending(null)}
          onPaid={handlePaid}
        />
      )}
    </div>
  );
}
