import { expect, test } from "@playwright/test";

/**
 * Phase 5 e2e: buy-credits checkout contract and the show-once
 * onboarding walkthrough. Stripe itself is exercised in the live
 * checklist (real test card + resent webhook); here the endpoints are
 * mocked to pin the client behaviour.
 */

test("buy credits: posts the package, follows the checkout URL, success banner refreshes balance", async ({ page }) => {
  let creditsServed = 2000;
  let checkoutPayload = "";
  await page.route("**/api/credits", (route) =>
    route.fulfill({ json: { balance: creditsServed } }),
  );
  await page.route("**/api/onboarding", (route) => route.fulfill({ json: { onboarded: true } }));
  await page.route("**/api/billing/checkout", (route) => {
    checkoutPayload = route.request().postData() ?? "";
    // Simulate Stripe: payment succeeds and redirects back with 1000 credits added.
    creditsServed += 1000;
    return route.fulfill({ json: { url: "/studio?topup=success" } });
  });

  await page.goto("/studio");
  await expect(page.locator('[data-testid="credit-balance"]')).toHaveText("Credits: 2000");

  await page.click('[data-testid="buy-credits"]');
  await page.click('[data-testid="package-topup_1000"]');

  await expect(page.locator('[data-testid="topup-success"]')).toBeVisible();
  expect(JSON.parse(checkoutPayload)).toEqual({ packageId: "topup_1000" });
  await expect(page.locator('[data-testid="credit-balance"]')).toHaveText("Credits: 3000");
  // The banner navigation cleaned the query string back to /studio.
  expect(new URL(page.url()).search).toBe("");
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

  // Walk all three steps; the last button label changes.
  await page.click('[data-testid="onboarding-next"]');
  await page.click('[data-testid="onboarding-next"]');
  await expect(page.locator('[data-testid="onboarding-next"]')).toHaveText("Start designing");
  await page.click('[data-testid="onboarding-next"]');

  await expect(page.locator('[data-testid="onboarding"]')).toHaveCount(0);
  expect(completions).toBe(1);

  // Returning user: server now says onboarded — no walkthrough.
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
