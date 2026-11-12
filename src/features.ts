import type { StandardCategory } from "./engine/types";

// F33: build flags. EXPO_PUBLIC_ENABLE_RUN is set per EAS profile in eas.json
// ("true" for preview / own APK, "false" for production / Play Store). Unset (Expo Go) = on.
// Read as a literal process.env.EXPO_PUBLIC_* so Expo inlines it at build time.
export const runEnabled = (flag: string | undefined = process.env.EXPO_PUBLIC_ENABLE_RUN) => flag !== "false";

export const RUN_ENABLED = runEnabled();

// Categories the Add Standard sheet offers
export const addableCategories = (all: StandardCategory[], run = RUN_ENABLED) =>
  all.filter((c) => run || c !== "run");
