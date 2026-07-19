/**
 * Credit top-up packages. All three sit at exactly the base rate from the
 * concept doc (2,000 credits = £12 → 0.6p/credit): "no overage pricing
 * traps — same rate as base plan".
 */

export type CreditPackage = {
  id: string;
  credits: number;
  /** Price in pence (GBP). */
  pricePence: number;
  label: string;
};

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: "topup_500", credits: 500, pricePence: 300, label: "500 credits — £3" },
  { id: "topup_1000", credits: 1000, pricePence: 600, label: "1,000 credits — £6" },
  { id: "topup_2000", credits: 2000, pricePence: 1200, label: "2,000 credits — £12" },
];

export function findPackage(id: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((p) => p.id === id);
}
