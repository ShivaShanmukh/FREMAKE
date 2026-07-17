"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { STARTING_BALANCE } from "./costs";
import { canAfford, createLocalStorageStore, debit, type CreditStore } from "./ledger";

export type Credits = {
  balance: number;
  /** True once the persisted balance has been read (avoids SSR mismatch). */
  hydrated: boolean;
  canAfford: (cost: number) => boolean;
  /** Charge exactly at approval time — never on propose, reject, or failure. */
  charge: (cost: number) => void;
};

export function useCredits(store?: CreditStore): Credits {
  const storeRef = useRef<CreditStore | null>(store ?? null);
  const [balance, setBalance] = useState(STARTING_BALANCE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!storeRef.current) {
      storeRef.current = createLocalStorageStore(
        typeof window === "undefined" ? null : window.localStorage,
      );
    }
    const persisted = storeRef.current.load();
    if (persisted !== null) {
      setBalance(persisted);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      storeRef.current?.save(balance);
    }
  }, [balance, hydrated]);

  const charge = useCallback((cost: number): void => {
    setBalance((current) => debit(current, cost));
  }, []);

  return {
    balance,
    hydrated,
    canAfford: (cost: number) => canAfford(balance, cost),
    charge,
  };
}
