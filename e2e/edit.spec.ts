import { expect, test, type Page } from "@playwright/test";
import fixture from "./fixtures/generation.json";

/**
 * Phase 2 e2e: select an element on the canvas, propose a targeted edit,
 * verify the scoped payload and the side-by-side diff, then approve.
 * /api/generate and /api/edit are mocked — deterministic, no secrets.
 *
 * Canvas clicks use computed coordinates: layout is deterministic
 * (src/lib/wireframe/layout.ts), so element positions are known. The
 * "Enable gentle reminders" button is screen 0, element index 5, at
 * stage y 444-484 (title offset 28 + padding/gaps), x 12-248.
 */

const DESCRIPTION =
  "A habit tracker for busy parents with streaks and gentle reminders. " +
  "Parents add small daily habits and see weekly progress as a family.";

const EDITED_ELEMENT = { type: "button", label: "Remind me gently" };

async function generateWireframes(page: Page): Promise<void> {
  await page.route("**/api/credits", (route) => route.fulfill({ json: { balance: 2000 } }));
  await page.route("**/api/approve", (route) => route.fulfill({ json: { balance: 1999 } }));
  await page.route("**/api/generate", (route) => route.fulfill({ json: fixture }));
  await page.goto("/studio");
  await page.fill("textarea", DESCRIPTION);
  await page.click("button:has-text('Generate wireframes')");
  await expect(page.locator(".konvajs-content canvas")).toHaveCount(1);
}

test("element edit: scoped payload, side-by-side diff, approve applies", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  let editPayload = "";
  await page.route("**/api/edit", (route) => {
    editPayload = route.request().postData() ?? "";
    return route.fulfill({ json: { result: { element: EDITED_ELEMENT } } });
  });

  await generateWireframes(page);

  // Click the "Enable gentle reminders" button on the first screen.
  await page
    .locator('[data-testid="wireframe-canvas"] canvas')
    .click({ position: { x: 130, y: 464 } });
  await expect(page.getByText("Editing button “Enable gentle reminders”")).toBeVisible();

  await page.fill('input[placeholder*="Rename this button"]', "Make the reminder copy calmer");
  await page.click("button:has-text('Propose edit')");

  // Side-by-side diff: current + proposed, each its own canvas.
  await expect(page.locator('[data-testid="diff-view"]')).toBeVisible();
  await expect(page.locator('[data-testid="diff-before"] canvas')).toHaveCount(1);
  await expect(page.locator('[data-testid="diff-after"] canvas')).toHaveCount(1);

  // Context scoping, verified at the network boundary: the payload holds
  // the selected element but no sibling element and no other screen.
  expect(editPayload).toContain("Enable gentle reminders");
  expect(editPayload).toContain("Onboarding");
  expect(editPayload).not.toContain("Start tracking"); // sibling element, same screen
  for (const screen of fixture.result.screens.slice(1)) {
    expect(editPayload).not.toContain(screen.name);
  }
  expect(editPayload).not.toContain(fixture.result.personas[0].name);

  // Approve: candidate is committed, edit panel and diff close.
  await page.click("button:has-text('Approve')");
  await expect(page.locator('[data-testid="diff-view"]')).toHaveCount(0);
  await expect(page.getByText("Targeted edit")).toHaveCount(0);

  expect(pageErrors).toEqual([]);
});

test("reject keeps the current state and discards the diff", async ({ page }) => {
  await page.route("**/api/edit", (route) =>
    route.fulfill({ json: { result: { element: EDITED_ELEMENT } } }),
  );

  await generateWireframes(page);

  await page
    .locator('[data-testid="wireframe-canvas"] canvas')
    .click({ position: { x: 130, y: 464 } });
  await page.fill('input[placeholder*="Rename this button"]', "Make the reminder copy calmer");
  await page.click("button:has-text('Propose edit')");
  await expect(page.locator('[data-testid="diff-view"]')).toBeVisible();

  await page.click("button:has-text('Reject')");
  await expect(page.locator('[data-testid="diff-view"]')).toHaveCount(0);
  // Selection survives a reject — the user can retry the instruction.
  await expect(page.getByText("Editing button “Enable gentle reminders”")).toBeVisible();
});

test("clicking a screen frame targets the whole screen", async ({ page }) => {
  await generateWireframes(page);

  // Below the last element (stage y ~534-568) is bare frame → screen selection.
  await page
    .locator('[data-testid="wireframe-canvas"] canvas')
    .click({ position: { x: 130, y: 550 } });
  await expect(page.getByText("Editing screen “Onboarding”")).toBeVisible();
});
