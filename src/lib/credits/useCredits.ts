"use client";

import { useCallback, useEffect, useState } from "react";
import { identifyUser } from "@/lib/analytics/client";

export type Credits = {
  /** Server-computed balance; null until loaded or when signed out. */
  balance: number | null;
  /** True when /api/credits said 401 — the user must sign in. */
  signedOut: boolean;
  /** UI convenience only — the server re-checks every action itself. */
  canAfford: (cost: number) => boolean;
  /** Adopt a balance returned by a server response (generate/approve). */
  setBalance: (balance: number) => void;
  /** Re-fetch the balance from the server (e.g. after a top-up). */
  refresh: () => void;
};

/**
 * The balance lives in Postgres (SUM of the user's ledger rows) and is
 * only ever read from, or returned by, the server. Nothing is persisted
 * client-side; this hook is a cache of the server's last answer.
 */
export function useCredits(): Credits {
  const [balance, setBalanceState] = useState<number | null>(null);
  const [signedOut, setSignedOut] = useState(false);

  const refresh = useCallback((): void => {
    void fetch("/api/credits")
      .then(async (res) => {
        if (res.status === 401) {
          setSignedOut(true);
          return;
        }
        const data: { balance?: number; userId?: string } = await res.json();
        if (typeof data.balance === "number") {
          setSignedOut(false);
          setBalanceState(data.balance);
          if (data.userId) {
            identifyUser(data.userId);
          }
        }
      })
      .catch(() => {
        // Leave balance as-is — actions stay disabled until a retry.
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setBalance = useCallback((next: number): void => {
    setSignedOut(false);
    setBalanceState(next);
  }, []);

  return {
    balance,
    signedOut,
    canAfford: (cost: number) => balance !== null && balance >= cost,
    setBalance,
    refresh,
  };
}
