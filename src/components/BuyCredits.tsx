"use client";

import { useEffect, useRef, useState } from "react";
import { CREDIT_PACKAGES, type CreditPackage } from "@/lib/billing/packages";
import { CheckoutModal } from "./CheckoutModal";

type BuyCreditsProps = {
  disabled: boolean;
  /** Current confirmed balance — used to detect once a top-up has actually
   *  landed, rather than trusting Stripe's client-side confirmation alone. */
  balance: number | null;
  /** Re-fetch the shared balance (called once the top-up is confirmed). */
  onRefresh: () => void;
};

type PendingPayment = { clientSecret: string; publishableKey: string; label: string; credits: number };

/** How long to wait for the webhook to post the ledger row before telling
 *  the user the credit is merely delayed rather than falsely "added". */
const CONFIRM_POLL_MS = 1500;
const CONFIRM_MAX_ATTEMPTS = 10;

/** Top-up menu → embedded Stripe Elements checkout (see CheckoutModal). */
export function BuyCredits({ disabled, balance, onRefresh }: BuyCreditsProps) {
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingPayment | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [paid, setPaid] = useState(false);
  const [delayed, setDelayed] = useState(false);
  const balanceRef = useRef(balance);
  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);

  async function startCheckout(pack: CreditPackage): Promise<void> {
    setStarting(pack.id);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: pack.id }),
      });
      const data: { clientSecret?: string; publishableKey?: string; label?: string; error?: string } =
        await res.json();
      if (!res.ok || !data.clientSecret || !data.publishableKey || !data.label) {
        setError(data.error ?? `Checkout failed (HTTP ${res.status}).`);
        return;
      }
      setOpen(false);
      setPending({
        clientSecret: data.clientSecret,
        publishableKey: data.publishableKey,
        label: data.label,
        credits: pack.credits,
      });
    } catch {
      setError("Network error — checkout not started.");
    } finally {
      setStarting(null);
    }
  }

  /** Stripe confirming the PaymentIntent client-side only means the charge
   *  succeeded — the ledger credit comes from the webhook, which can be
   *  delayed or (e.g. no `stripe listen` forwarding in dev) never arrive at
   *  all. Poll the real balance and only claim success once it's reflected;
   *  otherwise say so instead of showing a false confirmation. */
  function handlePaid(expectedCredits: number): void {
    const startingBalance = balanceRef.current;
    setPending(null);
    setPaid(false);
    setDelayed(false);
    setConfirming(true);

    let attempts = 0;
    const poll = async (): Promise<void> => {
      attempts += 1;
      try {
        const res = await fetch("/api/credits");
        if (res.ok) {
          const data: { balance?: number } = await res.json();
          if (
            typeof data.balance === "number" &&
            (startingBalance === null || data.balance >= startingBalance + expectedCredits)
          ) {
            setConfirming(false);
            setPaid(true);
            onRefresh();
            return;
          }
        }
      } catch {
        // transient — keep polling until the attempt budget runs out
      }
      if (attempts >= CONFIRM_MAX_ATTEMPTS) {
        setConfirming(false);
        setDelayed(true);
        return;
      }
      setTimeout(() => void poll(), CONFIRM_POLL_MS);
    };
    void poll();
  }

  return (
    <div className="relative">
      {confirming && (
        <p
          className="absolute right-0 top-10 z-10 w-64 rounded-md border border-neutral-300 bg-white p-2 text-xs text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
          data-testid="topup-confirming"
        >
          Payment received — confirming your credits…
        </p>
      )}
      {paid && (
        <p
          className="absolute right-0 top-10 z-10 w-64 rounded-md border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          data-testid="topup-success"
        >
          Payment received — your credits have been added.
        </p>
      )}
      {delayed && (
        <p
          className="absolute right-0 top-10 z-10 w-64 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          data-testid="topup-delayed"
        >
          Payment received, but your credits haven&apos;t posted yet. They&apos;ll appear shortly — refresh in a
          minute if they don&apos;t.
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
              onClick={() => void startCheckout(pack)}
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
          onPaid={() => handlePaid(pending.credits)}
        />
      )}
    </div>
  );
}
