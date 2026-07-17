import { expect, test, type Page } from "@playwright/test";
import fixture from "./fixtures/generation.json";

/**
 * Phase 3 e2e: diff-before-debit. Credits are charged exactly at the
 * moment a result is accepted — generation success, or diff approval —
 * and never on reject, empty diff, failure, or proposal. Both APIs are
 * mocked; the balance lives in localStorage (frmake.credits.v1).
 */

const DESCRIPTION =
  "A habit tracker for busy parents with streaks and gentle reminders. " +
  "Parents add small daily habits and see weekly progress as a family.";

// Screen 0, element index 5 — same canvas coordinates as edit.spec.ts.
const TARGET_ELEMENT = { type: "button", label: "Enable gentle reminders" };
const EDITED_ELEMENT = { type: "button", label: "Remind me gently" };

function balanceBadge(page: Page) {
  return page.locator('[data-testid="credit-balance"]');
}

async function generateWireframes(page: Page): Promise<void> {
  await page.route("**/api/generate", (route) => route.fulfill({ json: fixture }));
  await page.goto("/studio");
  await page.fill("textarea", DESCRIPTION);
  await page.click("button:has-text('Generate wireframes')");
  await expect(page.locator(".konvajs-content canvas")).toHaveCount(1);
}

async function proposeElementEdit(page: Page): Promise<void> {
  await page
    .locator('[data-testid="wireframe-canvas"] canvas')
    .click({ position: { x: 130, y: 464 } });
  await expect(page.getByText("Editing button “Enable gentle reminders”")).toBeVisible();
  await page.fill('input[placeholder*="Rename this button"]', "Make the reminder copy calmer");
  await page.click("button:has-text('Propose edit')");
  await expect(page.locator('[data-testid="diff-view"]')).toBeVisible();
}

test("generation debits 10 credits on success and nothing on failure", async ({ page }) => {
  await page.goto("/studio");
  await expect(balanceBadge(page)).toHaveText("Credits: 2000");

  // Failure first: no result, no charge.
  await page.route("**/api/generate", (route) =>
    route.fulfill({ status: 502, json: { error: "The model returned an unusable result." } }),
  );
  await page.fill("textarea", DESCRIPTION);
  await page.click("button:has-text('Generate wireframes')");
  await expect(page.getByText("The model returned an unusable result.")).toBeVisible();
  await expect(balanceBadge(page)).toHaveText("Credits: 2000");

  // Success: exactly the quoted 10 credits.
  await page.unroute("**/api/generate");
  await page.route("**/api/generate", (route) => route.fulfill({ json: fixture }));
  await page.click("button:has-text('Generate wireframes')");
  await expect(page.locator(".konvajs-content canvas")).toHaveCount(1);
  await expect(balanceBadge(page)).toHaveText("Credits: 1990");
});

test("element edit charges 1 credit at approval only; reject is free; balance persists", async ({ page }) => {
  await page.route("**/api/edit", (route) =>
    route.fulfill({ json: { result: { element: EDITED_ELEMENT } } }),
  );
  await generateWireframes(page);
  await expect(balanceBadge(page)).toHaveText("Credits: 1990");

  // The cost is quoted upfront, and proposing alone charges nothing.
  await proposeElementEdit(page);
  await expect(page.locator('[data-testid="edit-cost"]')).toContainText("1 credit");
  await expect(balanceBadge(page)).toHaveText("Credits: 1990");

  // Reject: free, selection survives for a retry.
  await page.click("button:has-text('Reject')");
  await expect(balanceBadge(page)).toHaveText("Credits: 1990");
  await expect(page.getByText("Editing button “Enable gentle reminders”")).toBeVisible();

  // Approve: exactly 1 credit.
  await page.click("button:has-text('Propose edit')");
  await expect(page.locator('[data-testid="diff-view"]')).toBeVisible();
  await page.click("button:has-text('Approve')");
  await expect(balanceBadge(page)).toHaveText("Credits: 1989");

  // Balance survives a reload (localStorage-backed store).
  await page.goto("/studio");
  await expect(balanceBadge(page)).toHaveText("Credits: 1989");
});

test("an empty diff cannot be approved and charges nothing", async ({ page }) => {
  // The model returns the element unchanged — no visible difference.
  await page.route("**/api/edit", (route) =>
    route.fulfill({ json: { result: { element: TARGET_ELEMENT } } }),
  );
  await generateWireframes(page);
  await proposeElementEdit(page);

  await expect(page.locator('[data-testid="empty-diff-notice"]')).toBeVisible();
  await expect(page.locator("button", { hasText: "Approve" })).toHaveCount(0);

  await page.click("button:has-text('Dismiss')");
  await expect(page.locator('[data-testid="diff-view"]')).toHaveCount(0);
  await expect(balanceBadge(page)).toHaveText("Credits: 1990");
});

test("generation is blocked when the balance cannot cover it", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("frmake.credits.v1", "3"));
  await page.goto("/studio");

  await expect(balanceBadge(page)).toHaveText("Credits: 3");
  await page.fill("textarea", DESCRIPTION);
  await expect(page.locator('[data-testid="insufficient-generation"]')).toBeVisible();
  await expect(page.locator("button", { hasText: "Generate wireframes" })).toBeDisabled();
});
