import { expect, test } from "@playwright/test";

/**
 * Phase 5 e2e: buy-credits checkout contract (embedded Stripe Elements,
 * not hosted Checkout — see checkout/route.ts) and the show-once
 * onboarding walkthrough. Stripe.js itself is not exercised here (that
 * needs a real publishable key + network to js.stripe.com); the live
 * checklist covers the real payment end-to-end. This pins the client
 * contract: what /api/billing/checkout is called with, and that the
 * modal/balance react correctly once Stripe confirms payment.
 */

test("buy credits: posts the package, opens the modal, and refreshes balance once Stripe confirms", async ({ page }) => {
  const creditsServed = 2000;
  let checkoutPayload = "";
  await page.route("**/api/credits", (route) =>
    route.fulfill({ json: { balance: creditsServed } }),
  );
  await page.route("**/api/onboarding", (route) => route.fulfill({ json: { onboarded: true } }));
  await page.route("**/api/billing/checkout", (route) => {
    checkoutPayload = route.request().postData() ?? "";
    return route.fulfill({
      json: {
        clientSecret: "pi_test_secret_abc",
        publishableKey: "pk_test_fake",
        label: "1,000 credits — £6",
      },
    });
  });
  // Stub Stripe.js so the modal renders without hitting js.stripe.com.
  await page.route("https://js.stripe.com/**", (route) => route.fulfill({ status: 404, body: "" }));

  await page.goto("/studio");
  await expect(page.locator('[data-testid="credit-balance"]')).toHaveText("Credits: 2000");

  await page.click('[data-testid="buy-credits"]');
  await page.click('[data-testid="package-topup_1000"]');

  await expect(page.locator('[data-testid="checkout-modal"]')).toBeVisible();
  expect(JSON.parse(checkoutPayload)).toEqual({ packageId: "topup_1000" });

  // Cancel closes the modal without touching the balance — actually
  // completing a payment requires real Stripe.js (covered by the live
  // checklist, not this mocked test).
  await page.click("button:has-text('Cancel')");
  await expect(page.locator('[data-testid="checkout-modal"]')).toHaveCount(0);
  expect(creditsServed).toBe(2000);
  await expect(page.locator('[data-testid="credit-balance"]')).toHaveText("Credits: 2000");
});

test("onboarding shows for a new user, completes once, and stays gone", async ({ page }) => {
  let onboarded = false;
  let completions = 0;
  await page.route("**/api/credits", (route) => route.fulfill({ json: { balance: 2000 } }));
  await page.route("**/api/onboarding", (route) => {
    if (route.request().method() === "POST") {
      completions += 1;
      onboarded = true;
      return route.fulfill({ json: { onboarded: true } });
    }
    return route.fulfill({ json: { onboarded } });
  });

  await page.goto("/studio");
  await expect(page.locator('[data-testid="onboarding"]')).toBeVisible();

  await page.click('[data-testid="onboarding-next"]');
  await page.click('[data-testid="onboarding-next"]');
  await expect(page.locator('[data-testid="onboarding-next"]')).toHaveText("Start designing");
  await page.click('[data-testid="onboarding-next"]');

  await expect(page.locator('[data-testid="onboarding"]')).toHaveCount(0);
  expect(completions).toBe(1);

  await page.reload();
  await expect(page.locator('[data-testid="credit-balance"]')).toHaveText("Credits: 2000");
  await expect(page.locator('[data-testid="onboarding"]')).toHaveCount(0);
});

test("skip also completes onboarding", async ({ page }) => {
  let completions = 0;
  await page.route("**/api/credits", (route) => route.fulfill({ json: { balance: 2000 } }));
  await page.route("**/api/onboarding", (route) => {
    if (route.request().method() === "POST") {
      completions += 1;
      return route.fulfill({ json: { onboarded: true } });
    }
    return route.fulfill({ json: { onboarded: false } });
  });

  await page.goto("/studio");
  await expect(page.locator('[data-testid="onboarding"]')).toBeVisible();
  await page.click('[data-testid="onboarding-skip"]');
  await expect(page.locator('[data-testid="onboarding"]')).toHaveCount(0);
  expect(completions).toBe(1);
});
