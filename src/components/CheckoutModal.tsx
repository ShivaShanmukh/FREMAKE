"use client";

import { loadStripe, type Stripe as StripeClient } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { useEffect, useState } from "react";

type CheckoutModalProps = {
  clientSecret: string;
  publishableKey: string;
  label: string;
  onClose: () => void;
  /** Called once Stripe confirms the payment succeeded client-side. The
   *  ledger credit itself always comes from the webhook, not this. */
  onPaid: () => void;
};

let stripePromiseCache: { key: string; promise: Promise<StripeClient | null> } | null = null;
function getStripe(publishableKey: string): Promise<StripeClient | null> {
  if (!stripePromiseCache || stripePromiseCache.key !== publishableKey) {
    stripePromiseCache = { key: publishableKey, promise: loadStripe(publishableKey) };
  }
  return stripePromiseCache.promise;
}

function PayForm({ label, onClose, onPaid }: Omit<CheckoutModalProps, "clientSecret" | "publishableKey">) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingName, setBillingName] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [billingCity, setBillingCity] = useState("");
  const [billingPostcode, setBillingPostcode] = useState("");

  const billingComplete =
    billingName.trim().length > 0 &&
    billingAddress.trim().length > 0 &&
    billingCity.trim().length > 0 &&
    billingPostcode.trim().length > 0;

  async function pay(): Promise<void> {
    if (!stripe || !elements || !billingComplete) return;
    setSubmitting(true);
    setError(null);
    // Cross-border card charges on this account require a customer name
    // and address (regulatory requirement); collected here rather than
    // relying on the Payment Element's own dynamic billing-details UI.
    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: {
        payment_method_data: {
          billing_details: {
            name: billingName,
            address: {
              line1: billingAddress,
              city: billingCity,
              postal_code: billingPostcode,
              country: "GB",
            },
          },
        },
      },
    });
    if (confirmError) {
      setError(confirmError.message ?? "Payment failed.");
      setSubmitting(false);
      return;
    }
    if (paymentIntent?.status === "succeeded") {
      onPaid();
    } else {
      setError(`Payment status: ${paymentIntent?.status ?? "unknown"}. Try again.`);
    }
    setSubmitting(false);
  }

  return (
    <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-lg bg-white p-5 shadow-xl dark:bg-neutral-900">
      <h2 className="text-base font-semibold">Buy {label}</h2>
      <div className="mt-3 flex flex-col gap-2">
        <input
          value={billingName}
          onChange={(e) => setBillingName(e.target.value)}
          placeholder="Name on card"
          data-testid="billing-name"
          className="rounded-md border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        <input
          value={billingAddress}
          onChange={(e) => setBillingAddress(e.target.value)}
          placeholder="Billing address"
          data-testid="billing-address"
          className="rounded-md border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        <div className="flex gap-2">
          <input
            value={billingCity}
            onChange={(e) => setBillingCity(e.target.value)}
            placeholder="City"
            data-testid="billing-city"
            className="w-1/2 rounded-md border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
          <input
            value={billingPostcode}
            onChange={(e) => setBillingPostcode(e.target.value)}
            placeholder="Postcode"
            data-testid="billing-postcode"
            className="w-1/2 rounded-md border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>
      </div>
      <div className="mt-4">
        <PaymentElement />
      </div>
      {error && <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onClose}
          disabled={submitting}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:opacity-40 dark:border-neutral-700"
        >
          Cancel
        </button>
        <button
          onClick={() => void pay()}
          disabled={submitting || !stripe || !billingComplete}
          data-testid="pay-now"
          className="rounded-md bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-40"
        >
          {submitting ? "Processing…" : "Pay now"}
        </button>
      </div>
    </div>
  );
}

/** Embedded Stripe Elements checkout — see checkout/route.ts for why. */
export function CheckoutModal({ clientSecret, publishableKey, label, onClose, onPaid }: CheckoutModalProps) {
  const [stripe, setStripe] = useState<StripeClient | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getStripe(publishableKey).then((s) => {
      if (!cancelled) setStripe(s);
    });
    return () => {
      cancelled = true;
    };
  }, [publishableKey]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      data-testid="checkout-modal"
    >
      {stripe ? (
        <Elements stripe={stripe} options={{ clientSecret }}>
          <PayForm label={label} onClose={onClose} onPaid={onPaid} />
        </Elements>
      ) : (
        <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl dark:bg-neutral-900">
          <p className="text-sm text-neutral-500">Loading payment form…</p>
          <button
            onClick={onClose}
            className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
