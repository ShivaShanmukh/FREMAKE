import { describe, expect, it } from "vitest";
import ts from "typescript";
import type { Screen } from "@/lib/generation/schema";
import { appSource, pascalCase, screenComponentSource, screenModules } from "./reactNative";
import { starterProject } from "./project";

const screen = (name: string, elements: Screen["elements"]): Screen => ({
  name,
  purpose: `Purpose of ${name}`,
  elements,
});

const SCREENS: Screen[] = [
  screen("Onboarding", [
    { type: "header", label: "Welcome" },
    { type: "text", label: "Small habits, big wins" },
    { type: "button", label: "Start tracking" },
  ]),
  screen("Habits", [
    { type: "input", label: "Search habits" },
    { type: "list", label: "Today's habits" },
    { type: "nav", label: "Home · Stats · Settings" },
  ]),
];

/** Fails the test if TypeScript's parser reports any syntax error. */
function expectParses(path: string, source: string): void {
  const out = ts.transpileModule(source, {
    reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.ReactNative, target: ts.ScriptTarget.ES2020 },
    fileName: path,
  });
  const errors = (out.diagnostics ?? []).map((d) =>
    ts.flattenDiagnosticMessageText(d.messageText, "\n"),
  );
  expect(errors, `${path} must be syntactically valid`).toEqual([]);
}

/** Every element name that appears as real JSX in the source. */
function jsxTagNames(source: string): Set<string> {
  const file = ts.createSourceFile("x.tsx", source, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TSX);
  const names = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      names.add(node.tagName.getText());
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return names;
}

describe("pascalCase", () => {
  it("sanitizes arbitrary screen names into identifiers", () => {
    expect(pascalCase("Sign in / Sign up!")).toBe("SignInSignUp");
    expect(pascalCase("home")).toBe("Home");
    expect(pascalCase("404 page")).toBe("Screen404Page");
    expect(pascalCase("!!!")).toBe("Screen");
  });
});

describe("screenModules", () => {
  it("dedupes colliding screen names", () => {
    const modules = screenModules([
      screen("Home", SCREENS[0].elements),
      screen("home!", SCREENS[0].elements),
    ]);
    expect(modules.map((m) => m.file)).toEqual(["Home", "Home2"]);
    expect(modules.map((m) => m.component)).toEqual(["HomeScreen", "Home2Screen"]);
  });
});

describe("generated code", () => {
  it("every starter file parses; JSON files parse as JSON", () => {
    const files = starterProject(SCREENS);
    for (const [path, content] of Object.entries(files)) {
      if (path.endsWith(".json")) {
        expect(() => JSON.parse(content), path).not.toThrow();
      } else if (path.endsWith(".tsx")) {
        expectParses(path, content);
      }
    }
  });

  it("assembles the full expected file map", () => {
    expect(Object.keys(starterProject(SCREENS)).sort()).toEqual([
      "App.tsx",
      "README.md",
      "app.json",
      "package.json",
      "screens/Habits.tsx",
      "screens/Onboarding.tsx",
      "screens/ui.tsx",
      "tsconfig.json",
    ]);
  });

  it("App.tsx imports and registers every screen", () => {
    const app = appSource(SCREENS);
    expect(app).toContain('import { OnboardingScreen } from "./screens/Onboarding";');
    expect(app).toContain('import { HabitsScreen } from "./screens/Habits";');
    expect(app).toContain('{ name: "Onboarding", Component: OnboardingScreen }');
    expect(app).toContain('{ name: "Habits", Component: HabitsScreen }');
  });

  it("renders every label and pins nav outside the scroll flow", () => {
    const source = screenComponentSource(SCREENS[1], "HabitsScreen");
    expect(source).toContain('<UIInput label={"Search habits"} />');
    expect(source).toContain("<UIList label={\"Today's habits\"} />");
    const scrollEnd = source.indexOf("</ScrollView>");
    expect(source.indexOf("<UINavBar")).toBeGreaterThan(scrollEnd);
  });

  it("hostile labels cannot escape their string literal", () => {
    const hostile = screen("Evil", [
      { type: "button", label: 'a"} /><Nope />{"' },
      { type: "text", label: "line\nbreak \\ ${inject} `tick`" },
      { type: "header", label: "curly } and { brace" },
    ]);
    const source = screenComponentSource(hostile, "EvilScreen");
    expectParses("Evil.tsx", source);
    // The injected tag must stay inert text inside a string literal — the
    // actual JSX tree may only contain the known primitives and layout.
    expect(jsxTagNames(source)).toEqual(
      new Set(["View", "ScrollView", "UIButton", "UIText", "UIHeader"]),
    );
    expectParses("App.tsx", appSource([hostile]));
  });
});
