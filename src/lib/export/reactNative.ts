import type { Screen, WireframeElement } from "@/lib/generation/schema";

/**
 * Deterministic screen → React Native codegen. No model call: the semantic
 * wireframe schema maps mechanically to the starter's UI primitives
 * (screens/ui.tsx), so exporting consumes zero tokens and zero credits.
 *
 * All user-controlled text is embedded via JSON.stringify, so labels with
 * quotes, braces, or newlines can never break out of a string literal.
 */

const PRIMITIVES: Record<WireframeElement["type"], string> = {
  header: "UIHeader",
  text: "UIText",
  button: "UIButton",
  input: "UIInput",
  image: "UIImagePlaceholder",
  list: "UIList",
  nav: "UINavBar",
};

/** "Sign in / Sign up!" → "SignInSignUp"; never empty, never digit-led. */
export function pascalCase(name: string): string {
  const joined = (name.match(/[a-zA-Z0-9]+/g) ?? [])
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join("");
  if (joined.length === 0) {
    return "Screen";
  }
  return /^[0-9]/.test(joined) ? `Screen${joined}` : joined;
}

export type ScreenModule = {
  /** File basename under screens/, e.g. "Onboarding" → screens/Onboarding.tsx */
  file: string;
  /** Exported component name, e.g. "OnboardingScreen" */
  component: string;
};

/** One unique module (file + component name) per screen, in screen order. */
export function screenModules(screens: Screen[]): ScreenModule[] {
  const seen = new Map<string, number>();
  return screens.map((screen) => {
    const base = pascalCase(screen.name);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const file = count === 0 ? base : `${base}${count + 1}`;
    return { file, component: `${file}Screen` };
  });
}

function elementJsx(el: WireframeElement): string {
  return `<${PRIMITIVES[el.type]} label={${JSON.stringify(el.label)}} />`;
}

/**
 * Full source of one screens/<Name>.tsx file. Mirrors the wireframe
 * layout: flow elements scroll; the first nav (if any) pins to the bottom.
 */
export function screenComponentSource(screen: Screen, componentName: string): string {
  const flow = screen.elements.filter((el) => el.type !== "nav");
  const nav = screen.elements.find((el) => el.type === "nav");

  const used = [...new Set([...flow.map((el) => PRIMITIVES[el.type]), ...(nav ? [PRIMITIVES.nav] : [])])]
    .sort()
    .join(", ");

  const body = flow.map((el) => `        ${elementJsx(el)}`).join("\n");

  return `import { ScrollView, StyleSheet, View } from "react-native";
import { ${used} } from "./ui";

/** ${screen.purpose.replace(/\*\//g, "*​/")} */
export function ${componentName}() {
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
${body}
      </ScrollView>
${nav ? `      ${elementJsx(nav)}\n` : ""}    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 12 },
});
`;
}

/** Full source of App.tsx — a dependency-free useState screen switcher. */
export function appSource(screens: Screen[]): string {
  const modules = screenModules(screens);
  const imports = modules
    .map((m) => `import { ${m.component} } from "./screens/${m.file}";`)
    .join("\n");
  const entries = screens
    .map((screen, i) => `  { name: ${JSON.stringify(screen.name)}, Component: ${modules[i].component} },`)
    .join("\n");

  return `import { useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
${imports}

const screens = [
${entries}
];

export default function App() {
  const [index, setIndex] = useState(0);
  const Active = screens[index].Component;
  return (
    <SafeAreaView style={styles.app}>
      <View style={styles.body}>
        <Active />
      </View>
      <View style={styles.switcher}>
        {screens.map((screen, i) => (
          <Pressable key={screen.name} onPress={() => setIndex(i)} style={styles.tab}>
            <Text style={i === index ? styles.tabActive : styles.tabLabel} numberOfLines={1}>
              {screen.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: "#fff" },
  body: { flex: 1 },
  switcher: { flexDirection: "row", borderTopWidth: 1, borderColor: "#e5e5e5" },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10 },
  tabLabel: { fontSize: 11, color: "#737373" },
  tabActive: { fontSize: 11, color: "#111", fontWeight: "700" },
});
`;
}
