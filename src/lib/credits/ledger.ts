/**
 * Pure credit-ledger operations plus a pluggable persistence interface.
 * The ledger itself has no storage opinion: the browser uses the
 * localStorage-backed store below, tests inject a fake, and a Supabase
 * adapter can slot in later without touching any call site.
 */

export type CreditStore = {
  /** Returns the persisted balance, or null when nothing valid is stored. */
  load(): number | null;
  save(balance: number): void;
};

export function canAfford(balance: number, cost: number): boolean {
  return cost >= 0 && balance >= cost;
}

/**
 * Returns the balance after a charge. Throws on charges the UI must have
 * prevented — a throw here means a guard is missing at the call site, not
 * a user-facing condition.
 */
export function debit(balance: number, cost: number): number {
  if (!Number.isInteger(cost) || cost < 0) {
    throw new Error(`Invalid credit cost: ${cost}`);
  }
  if (cost > balance) {
    throw new Error(`Insufficient credits: cost ${cost} exceeds balance ${balance}`);
  }
  return balance - cost;
}

const STORAGE_KEY = "frmake.credits.v1";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/**
 * localStorage-backed store. Pass null (e.g. during SSR) for a no-op
 * store that always reports "nothing persisted".
 */
export function createLocalStorageStore(storage: StorageLike | null): CreditStore {
  return {
    load(): number | null {
      if (!storage) {
        return null;
      }
      const raw = storage.getItem(STORAGE_KEY);
      if (raw === null) {
        return null;
      }
      const parsed = Number(raw);
      return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
    },
    save(balance: number): void {
      storage?.setItem(STORAGE_KEY, String(balance));
    },
  };
}
