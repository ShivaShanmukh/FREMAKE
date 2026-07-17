/**
 * Static files shipped with every exported starter. The UI kit keeps the
 * generated screens tiny and readable; the starter has zero dependencies
 * beyond Expo itself, so `npm install && npx expo start` just works.
 */

export const UI_KIT_SOURCE = `import { ReactElement } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

type LabelProps = { label: string };

export function UIHeader({ label }: LabelProps): ReactElement {
  return <Text style={styles.header}>{label}</Text>;
}

export function UIText({ label }: LabelProps): ReactElement {
  return <Text style={styles.text}>{label}</Text>;
}

export function UIButton({ label }: LabelProps): ReactElement {
  return (
    <Pressable style={styles.button} onPress={() => {}}>
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

export function UIInput({ label }: LabelProps): ReactElement {
  return <TextInput style={styles.input} placeholder={label} placeholderTextColor="#999" />;
}

export function UIImagePlaceholder({ label }: LabelProps): ReactElement {
  return (
    <View style={styles.image}>
      <Text style={styles.imageLabel}>{label}</Text>
    </View>
  );
}

export function UIList({ label }: LabelProps): ReactElement {
  return (
    <View style={styles.list}>
      <Text style={styles.listCaption}>{label}</Text>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.listRow} />
      ))}
    </View>
  );
}

/** Bottom navigation — items split from the wireframe label on "·". */
export function UINavBar({ label }: LabelProps): ReactElement {
  const items = label.split("\\u00b7").map((item) => item.trim()).filter(Boolean);
  return (
    <View style={styles.nav}>
      {(items.length > 0 ? items : [label]).map((item) => (
        <Text key={item} style={styles.navItem} numberOfLines={1}>
          {item}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { fontSize: 22, fontWeight: "700" },
  text: { fontSize: 14, color: "#444", lineHeight: 20 },
  button: { backgroundColor: "#111", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  buttonLabel: { color: "#fff", fontSize: 14, fontWeight: "600" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, fontSize: 14 },
  image: {
    height: 140,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  imageLabel: { fontSize: 12, color: "#888", textAlign: "center" },
  list: { gap: 8 },
  listCaption: { fontSize: 13, fontWeight: "600" },
  listRow: { height: 44, borderRadius: 8, backgroundColor: "#f5f5f5" },
  nav: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderColor: "#e5e5e5",
    paddingVertical: 12,
  },
  navItem: { fontSize: 12, color: "#555", flexShrink: 1, paddingHorizontal: 4 },
});
`;

export const PACKAGE_JSON = `{
  "name": "frmake-starter",
  "version": "1.0.0",
  "private": true,
  "main": "node_modules/expo/AppEntry.js",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web"
  },
  "dependencies": {
    "expo": "~53.0.0",
    "react": "19.0.0",
    "react-native": "0.79.2"
  },
  "devDependencies": {
    "@types/react": "~19.0.10",
    "typescript": "~5.8.3"
  }
}
`;

export const APP_JSON = `{
  "expo": {
    "name": "FrMake Starter",
    "slug": "frmake-starter",
    "version": "1.0.0",
    "orientation": "portrait",
    "userInterfaceStyle": "light",
    "platforms": ["ios", "android", "web"]
  }
}
`;

export const TSCONFIG_JSON = `{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true
  }
}
`;

export const README = `# FrMake Starter

Low-fidelity React Native screens exported from FrMake Studio.
Expo-compatible — no extra dependencies.

## Run it

\`\`\`
npm install
npx expo start
\`\`\`

Scan the QR code with Expo Go, or press \`w\` for web.
If dependency versions drift, run \`npx expo install --fix\`.

## Structure

- \`App.tsx\` — screen switcher (bottom tabs)
- \`screens/\` — one component per wireframe screen
- \`screens/ui.tsx\` — the shared low-fi UI kit; restyle here first
`;
