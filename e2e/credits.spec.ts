import { expect, test, type Page } from "@playwright/test";
import fixture from "./fixtures/generation.json";

/**
 * Phase 3 (rebuild) e2e: the balance lives on the server. These tests
 * mock the credit endpoints with a tiny in-test ledger and assert the
 * client's contract with them: adopt server balances, call /api/approve
 * exactly once per approval and never otherwise, and disable actions when
 * signed out or broke. Real DB behaviour is covered by the Postgres
 * integration tests (src/lib/credits/server.test.ts) and the live audit.
 */

const DESCRIPTION =
  "A habit tracker for busy parents with streaks and gentle reminders. " +
  "Parents add small daily habits and see weekly progress as a family.";

const EDITED_ELEMENT = { type: "button", label: "Remind me gently" };
const TARGET_ELEMENT = { type: "button", label: "Enable gentle reminders" };

type MockLedger = { balance: number; approveCalls: string[] };

async function mockCreditServer(page: Page, initial: number): Promise<MockLedger> {
  const state: MockLedger = { balance: initial, approveCalls: [] };
  await page.route("**/api/credits", (route) =>
    route.fulfill({ json: { balance: state.balance } }),
  );
  await page.route("**/api/approve", (route) => {
    // The real server derives kind/cost from a persisted proposal row,
    // not from the request body — mocked here by encoding kind into the
    // fake proposalId the /api/edit mocks below hand out.
    const body = JSON.parse(route.request().postData() ?? "{}") as { proposalId: string };
    const kind = body.proposalId.startsWith("prop-screen") ? "screen" : "element";
    state.approveCalls.push(kind);
    state.balance -= kind === "element" ? 1 : 5;
    return route.fulfill({ json: { balance: state.balance } });
  });
  return state;
}

function balanceBadge(page: Page) {
  return page.locator('[data-testid="credit-balance"]');
}

async function generateWireframes(page: Page, state: MockLedger): Promise<void> {
  await page.route("**/api/generate", (route) => {
    state.balance -= 10;
    return route.fulfill({ json: { ...fixture, balance: state.balance } });
  });
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

test("the badge adopts server balances: initial load and post-generation", async ({ page }) => {
  const state = await mockCreditServer(page, 2000);
  await page.goto("/studio");
  await expect(balanceBadge(page)).toHaveText("Credits: 2000");
  await generateWireframes(page, state);
  await expect(balanceBadge(page)).toHaveText("Credits: 1990");
});

test("approve posts to /api/approve exactly once; reject never does", async ({ page }) => {
  const state = await mockCreditServer(page, 2000);
  await page.route("**/api/edit", (route) =>
    route.fulfill({ json: { result: { element: EDITED_ELEMENT }, proposalId: "prop-element-1" } }),
  );
  await generateWireframes(page, state);

  await proposeElementEdit(page);
  await page.click("button:has-text('Reject')");
  expect(state.approveCalls).toEqual([]);
  await expect(balanceBadge(page)).toHaveText("Credits: 1990");

  await page.click("button:has-text('Propose edit')");
  await expect(page.locator('[data-testid="diff-view"]')).toBeVisible();
  await page.click("button:has-text('Approve')");
  await expect(page.locator('[data-testid="diff-view"]')).toHaveCount(0);
  expect(state.approveCalls).toEqual(["element"]);
  await expect(balanceBadge(page)).toHaveText("Credits: 1989");
});

test("an empty diff cannot be approved and never reaches the server", async ({ page }) => {
  const state = await mockCreditServer(page, 2000);
  await page.route("**/api/edit", (route) =>
    route.fulfill({ json: { result: { element: TARGET_ELEMENT }, proposalId: "prop-element-2" } }),
  );
  await generateWireframes(page, state);
  await proposeElementEdit(page);

  await expect(page.locator('[data-testid="empty-diff-notice"]')).toBeVisible();
  await expect(page.locator("button", { hasText: "Approve" })).toHaveCount(0);
  await page.click("button:has-text('Dismiss')");
  expect(state.approveCalls).toEqual([]);
  await expect(balanceBadge(page)).toHaveText("Credits: 1990");
});

test("a failed server debit shows the error and does NOT apply the change", async ({ page }) => {
  const state = await mockCreditServer(page, 2000);
  await page.unroute("**/api/approve");
  await page.route("**/api/approve", (route) =>
    route.fulfill({ status: 402, json: { error: "Not enough credits: this needs 1, you have 0.", balance: 0 } }),
  );
  await page.route("**/api/edit", (route) =>
    route.fulfill({ json: { result: { element: EDITED_ELEMENT }, proposalId: "prop-element-1" } }),
  );
  await generateWireframes(page, state);
  await proposeElementEdit(page);

  await page.click("button:has-text('Approve')");
  await expect(page.getByText("Not enough credits: this needs 1, you have 0.")).toBeVisible();
  // Diff stays open, change not applied, badge adopts the server's answer.
  await expect(page.locator('[data-testid="diff-view"]')).toBeVisible();
  await expect(balanceBadge(page)).toHaveText("Credits: 0");
});

test("signed out: notice shown, balance unknown, generation disabled", async ({ page }) => {
  await page.route("**/api/credits", (route) =>
    route.fulfill({ status: 401, json: { error: "Sign in to see your credits." } }),
  );
  await page.goto("/studio");
  await expect(page.locator('[data-testid="signed-out-notice"]')).toBeVisible();
  await expect(balanceBadge(page)).toHaveText("Credits: —");
  await page.fill("textarea", DESCRIPTION);
  await expect(page.locator("button", { hasText: "Generate wireframes" })).toBeDisabled();
});

test("server/DB outage: a clear banner shows, generation is paused, nothing crashes", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.route("**/api/credits", (route) => route.fulfill({ status: 500, body: "" }));

  await page.goto("/studio");
  await expect(page.locator('[data-testid="credits-load-error"]')).toBeVisible();
  await expect(page.getByText(/Couldn.t reach the server/)).toBeVisible();
  await expect(balanceBadge(page)).toHaveText("Credits: —");
  await page.fill("textarea", DESCRIPTION);
  await expect(page.locator("button", { hasText: "Generate wireframes" })).toBeDisabled();
  expect(pageErrors).toEqual([]);

  // Recovers cleanly once the server is back and Retry is pressed.
  await page.unroute("**/api/credits");
  await page.route("**/api/credits", (route) => route.fulfill({ json: { balance: 2000 } }));
  await page.click('[data-testid="credits-load-error"] button:has-text("Retry")');
  await expect(balanceBadge(page)).toHaveText("Credits: 2000");
  await expect(page.locator('[data-testid="credits-load-error"]')).toHaveCount(0);
});

test("generation is blocked client-side when the balance cannot cover it", async ({ page }) => {
  await mockCreditServer(page, 3);
  await page.goto("/studio");
  await expect(balanceBadge(page)).toHaveText("Credits: 3");
  await page.fill("textarea", DESCRIPTION);
  await expect(page.locator('[data-testid="insufficient-generation"]')).toBeVisible();
  await expect(page.locator("button", { hasText: "Generate wireframes" })).toBeDisabled();
});
