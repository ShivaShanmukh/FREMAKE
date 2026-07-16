import { expect, test } from "@playwright/test";
import fixture from "./fixtures/generation.json";

/**
 * Rendering test for the prompt → wireframe pipeline. The Claude API is
 * mocked with a real captured response (e2e/fixtures/generation.json) so
 * the test is deterministic, free, and runs in CI without secrets. The
 * live API path is covered by the Phase 1 manual checklist.
 */

const DESCRIPTION =
  "A habit tracker for busy parents with streaks and gentle reminders. " +
  "Parents add small daily habits and see weekly progress as a family.";

test("studio renders personas, IA, and 5 wireframe screens on canvas", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  await page.route("**/api/generate", (route) =>
    route.fulfill({ json: fixture }),
  );

  await page.goto("/studio");
  await page.fill("textarea", DESCRIPTION);
  await page.click("button:has-text('Generate wireframes')");

  await expect(page.locator("h2", { hasText: "Wireframes" })).toBeVisible();
  await expect(page.locator(".konvajs-content canvas")).toHaveCount(1);

  // Canvas must be wide enough to hold all 5 phone frames (5 × 260px + gaps)
  const box = await page.locator(".konvajs-content").boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(5 * 260);

  const personaCount = fixture.result.personas.length;
  await expect(
    page.locator("h2", { hasText: "Personas" }).locator("xpath=following-sibling::div[1]/div"),
  ).toHaveCount(personaCount);

  expect(pageErrors).toEqual([]);
});

test("studio shows the error state when generation fails", async ({ page }) => {
  await page.route("**/api/generate", (route) =>
    route.fulfill({
      status: 502,
      json: { error: "The model returned an unusable result." },
    }),
  );

  await page.goto("/studio");
  await page.fill("textarea", DESCRIPTION);
  await page.click("button:has-text('Generate wireframes')");

  await expect(
    page.getByText("The model returned an unusable result."),
  ).toBeVisible();
  await expect(page.locator(".konvajs-content")).toHaveCount(0);
});
