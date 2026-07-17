import { expect, test } from "@playwright/test";
import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { screenModules } from "../src/lib/export/reactNative";
import { generationResultSchema } from "../src/lib/generation/schema";
import fixture from "./fixtures/generation.json";

const SCREENS = generationResultSchema.parse(fixture.result).screens;

/**
 * Phase 4 e2e: export the generated wireframes as an Expo-compatible
 * React Native starter. The export is deterministic client-side codegen —
 * no model call — so it is free and must not touch the credit balance.
 */

const DESCRIPTION =
  "A habit tracker for busy parents with streaks and gentle reminders. " +
  "Parents add small daily habits and see weekly progress as a family.";

test("export downloads a complete starter zip without charging credits", async ({ page }, testInfo) => {
  await page.route("**/api/generate", (route) => route.fulfill({ json: fixture }));
  await page.goto("/studio");
  await page.fill("textarea", DESCRIPTION);
  await page.click("button:has-text('Generate wireframes')");
  await expect(page.locator(".konvajs-content canvas")).toHaveCount(1);
  await expect(page.locator('[data-testid="credit-balance"]')).toHaveText("Credits: 1990");

  const downloadPromise = page.waitForEvent("download");
  await page.click('[data-testid="export-starter"]');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("frmake-react-native-starter.zip");

  const zipPath = join(testInfo.outputDir, download.suggestedFilename());
  await download.saveAs(zipPath);
  const zip = await JSZip.loadAsync(await readFile(zipPath));

  // Scaffold + one component per fixture screen.
  const paths = Object.keys(zip.files).sort();
  const screenFiles = screenModules(SCREENS).map((m) => `screens/${m.file}.tsx`);
  for (const required of [
    "App.tsx",
    "package.json",
    "app.json",
    "tsconfig.json",
    "README.md",
    "screens/ui.tsx",
    ...screenFiles,
  ]) {
    expect(paths).toContain(required);
  }

  // App.tsx registers every screen by its wireframe name.
  const app = await zip.files["App.tsx"].async("string");
  for (const screen of SCREENS) {
    expect(app).toContain(JSON.stringify(screen.name));
  }

  // Every element label of screen 0 survives into its component.
  const first = await zip.files[screenFiles[0]].async("string");
  for (const el of SCREENS[0].elements) {
    expect(first).toContain(JSON.stringify(el.label));
  }

  // Free: the balance is untouched by export.
  await expect(page.locator('[data-testid="credit-balance"]')).toHaveText("Credits: 1990");
});
