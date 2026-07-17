import type { Screen } from "@/lib/generation/schema";
import { appSource, screenComponentSource, screenModules } from "./reactNative";
import { APP_JSON, PACKAGE_JSON, README, TSCONFIG_JSON, UI_KIT_SOURCE } from "./templates";

/** Path → file content for the complete Expo starter. */
export type StarterFiles = Record<string, string>;

export function starterProject(screens: Screen[]): StarterFiles {
  const modules = screenModules(screens);
  const files: StarterFiles = {
    "package.json": PACKAGE_JSON,
    "app.json": APP_JSON,
    "tsconfig.json": TSCONFIG_JSON,
    "README.md": README,
    "App.tsx": appSource(screens),
    "screens/ui.tsx": UI_KIT_SOURCE,
  };
  screens.forEach((screen, i) => {
    files[`screens/${modules[i].file}.tsx`] = screenComponentSource(screen, modules[i].component);
  });
  return files;
}

export const STARTER_ZIP_NAME = "frmake-react-native-starter.zip";
