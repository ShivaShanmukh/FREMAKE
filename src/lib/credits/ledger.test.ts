import { describe, expect, it } from "vitest";
import { editCost, ELEMENT_EDIT_COST, GENERATION_COST, SCREEN_EDIT_COST } from "./costs";
import { canAfford, createLocalStorageStore, debit } from "./ledger";

describe("costs", () => {
  it("prices element edits below screen edits below generation", () => {
    expect(editCost("element")).toBe(ELEMENT_EDIT_COST);
    expect(editCost("screen")).toBe(SCREEN_EDIT_COST);
    expect(ELEMENT_EDIT_COST).toBeLessThan(SCREEN_EDIT_COST);
    expect(SCREEN_EDIT_COST).toBeLessThan(GENERATION_COST);
  });
});

describe("debit", () => {
  it("subtracts the cost from the balance", () => {
    expect(debit(2000, 1)).toBe(1999);
    expect(debit(10, 10)).toBe(0);
    expect(debit(5, 0)).toBe(5);
  });

  it("throws when the cost exceeds the balance — a missing UI guard, not a user state", () => {
    expect(() => debit(3, 5)).toThrow("Insufficient credits");
  });

  it("throws on negative or non-integer costs", () => {
    expect(() => debit(100, -1)).toThrow("Invalid credit cost");
    expect(() => debit(100, 1.5)).toThrow("Invalid credit cost");
  });
});

describe("canAfford", () => {
  it("is true only when the balance covers a non-negative cost", () => {
    expect(canAfford(10, 10)).toBe(true);
    expect(canAfford(10, 11)).toBe(false);
    expect(canAfford(0, 0)).toBe(true);
    expect(canAfford(10, -1)).toBe(false);
  });
});

function fakeStorage(): Pick<Storage, "getItem" | "setItem"> & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("createLocalStorageStore", () => {
  it("round-trips a saved balance", () => {
    const store = createLocalStorageStore(fakeStorage());
    expect(store.load()).toBeNull();
    store.save(1989);
    expect(store.load()).toBe(1989);
  });

  it("treats corrupted or negative persisted values as unset", () => {
    const storage = fakeStorage();
    const store = createLocalStorageStore(storage);
    storage.data.set("frmake.credits.v1", "not-a-number");
    expect(store.load()).toBeNull();
    storage.data.set("frmake.credits.v1", "-5");
    expect(store.load()).toBeNull();
    storage.data.set("frmake.credits.v1", "3.7");
    expect(store.load()).toBeNull();
  });

  it("is a no-op reporting nothing persisted when storage is unavailable (SSR)", () => {
    const store = createLocalStorageStore(null);
    expect(store.load()).toBeNull();
    expect(() => store.save(100)).not.toThrow();
  });
});
