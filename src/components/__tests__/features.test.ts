// F33: EXPO_PUBLIC_ENABLE_RUN hides the Run category in the Play Store build
import { addableCategories, runEnabled } from "../../features";
import type { StandardCategory } from "../../engine/types";

const ALL: StandardCategory[] = ["lifts", "olympic", "calisthenics", "run"];
const eas = require("../../../eas.json");

const load = (flag: string | undefined) => {
  const prev = process.env.EXPO_PUBLIC_ENABLE_RUN;
  if (flag === undefined) delete process.env.EXPO_PUBLIC_ENABLE_RUN;
  else process.env.EXPO_PUBLIC_ENABLE_RUN = flag;
  let mod!: typeof import("../../features");
  jest.isolateModules(() => { mod = require("../../features"); });
  if (prev === undefined) delete process.env.EXPO_PUBLIC_ENABLE_RUN;
  else process.env.EXPO_PUBLIC_ENABLE_RUN = prev;
  return mod;
};

describe("F33 — Run flag", () => {
  it("on: Add Standard offers every category, Run included", () => {
    expect(runEnabled("true")).toBe(true);
    expect(addableCategories(ALL, true)).toEqual(["lifts", "olympic", "calisthenics", "run"]);
    const m = load("true");
    expect(m.RUN_ENABLED).toBe(true);
    expect(m.addableCategories(ALL)).toContain("run");
  });
  it("off: Add Standard leaves out Run, nothing else", () => {
    expect(runEnabled("false")).toBe(false);
    expect(addableCategories(ALL, false)).toEqual(["lifts", "olympic", "calisthenics"]);
    const m = load("false");
    expect(m.RUN_ENABLED).toBe(false);
    expect(m.addableCategories(ALL)).toEqual(["lifts", "olympic", "calisthenics"]);
  });
  it("unset (Expo Go) = on", () => {
    expect(runEnabled(undefined)).toBe(true);
    expect(load(undefined).RUN_ENABLED).toBe(true);
  });
  it("eas.json: preview (own APK) on, production (Play Store) off", () => {
    expect(eas.build.preview.env.EXPO_PUBLIC_ENABLE_RUN).toBe("true");
    expect(eas.build.production.env.EXPO_PUBLIC_ENABLE_RUN).toBe("false");
  });
});
