// F31 — typed number entry on the Session screen
import { clampMin, clampReps, cleanEntry, editText, parseEntry } from "../numberEntry";

describe("whole numbers (reps, lb, minutes)", () => {
  it("keeps digits only, drops leading zeros, max 4 digits", () => {
    expect(cleanEntry("int", "12a")).toBe("12");
    expect(cleanEntry("int", "-5")).toBe("5");
    expect(cleanEntry("int", "007")).toBe("7");
    expect(cleanEntry("int", "0")).toBe("0");
    expect(cleanEntry("int", "123456")).toBe("1234");
  });
  it("parses typed text; empty is null", () => {
    expect(parseEntry("int", "42")).toBe(42);
    expect(parseEntry("int", "0")).toBe(0);
    expect(parseEntry("int", "")).toBeNull();
  });
  it("starts editing from the current value", () => {
    expect(editText("int", 135)).toBe("135");
    expect(editText("int", null)).toBe("");
  });
});

describe("times (split, pace) typed as digits", () => {
  it("formats digits as M:SS while typing", () => {
    expect(cleanEntry("time", "7")).toBe("7");
    expect(cleanEntry("time", "730")).toBe("7:30");
    expect(cleanEntry("time", "1:43")).toBe("1:43");
  });
  it("parses M:SS to seconds; invalid seconds is null", () => {
    expect(parseEntry("time", "7:30")).toBe(450);
    expect(parseEntry("time", "1:43")).toBe(103);
    expect(parseEntry("time", "7:75")).toBeNull();
    expect(parseEntry("time", "")).toBeNull();
  });
  it("starts editing from the current value, round-trips", () => {
    expect(editText("time", 450)).toBe("7:30");
    expect(parseEntry("time", cleanEntry("time", editText("time", 103)))).toBe(103);
  });
});

describe("same limits as −/+", () => {
  it("reps: never below 0, never above the set's cap (Olympic top set 3, push-up back-off target)", () => {
    expect(clampReps(3)(8)).toBe(3);
    expect(clampReps(10)(7)).toBe(7);
    expect(clampReps(undefined)(55)).toBe(55);
    expect(clampReps(undefined)(-1)).toBe(0);
  });
  it("weights and vest load ≥ 0; run values ≥ 1", () => {
    expect(clampMin(0)(0)).toBe(0);
    expect(clampMin(1)(0)).toBe(1);
    expect(clampMin(1)(450)).toBe(450);
  });
});
