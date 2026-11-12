// Run engine setup + helpers. Rules (run.md v1.0) are covered row by row in run.table.test.ts.
import {
  RUN_RULES,
  fmtDistance,
  fmtLength,
  fmtTime,
  fmtTimeDigits,
  parseTime,
  runSessionTitle,
  initRunState,
  runWeek,
} from "../run";
import { ENGINES } from "../registry";
import { isWeekComplete } from "../progression";
import type { SessionLog, Standard, StandardType, TrainingState } from "../types";
import { CATEGORY_LABEL, STANDARD_META } from "../types";

const std = (type: StandardType, start: number, target: number): Standard => ({
  id: "r1", type, category: "run", start, target, createdAt: "2026-11-01T12:00:00.000Z", status: "active",
});
const r800 = std("run800", 160, 150);
const r3 = std("run3", 1440, 1320);
const st = (s: Standard, week: 1 | 2 | 3 | 4 = 1): TrainingState => ({
  standardId: s.id, trainingMax: 0, cycle: 1, week, run: initRunState(s),
});

describe("setup", () => {
  it("4 run types in the Run category use the run engine; lower time is better", () => {
    expect(CATEGORY_LABEL.run).toBe("Run");
    for (const ty of ["run800", "run1_5", "run3", "run5"] as StandardType[]) {
      expect(STANDARD_META[ty]).toMatchObject({ category: "run", kind: "time", lower: true });
      expect(ENGINES[ty]).toBe(ENGINES.run800);
    }
    expect(STANDARD_META.run1_5.label).toBe("1.5 Mile");
  });
  it("initial state: rung 1, base = START race pace, CURRENT = START, one point at creation", () => {
    expect(initRunState(r800)).toEqual({
      rung: 1, counter: 0, base: 322, current: 160, z2Min: 20, z2Full: 0, trials: [],
      points: [{ date: r800.createdAt, current: 160 }],
    });
  });
  it("rule values live in the rules object", () => {
    expect(RUN_RULES).toMatchObject({ calcExp: 1.06, intervals: 4, speedReps: 2, maxRest: 120, sessionsPerRung: 2 });
  });
  it("fmtTime: M:SS, H:MM:SS from an hour", () => {
    expect(fmtTime(160)).toBe("2:40");
    expect(fmtTime(39.6)).toBe("0:40");
    expect(fmtTime(3725)).toBe("1:02:05");
  });
  it("week is complete once all 3 cards are logged", () => {
    const logs: SessionLog[] = [0, 1, 2].map((i) => ({
      id: `${i}`, standardId: "r1", cycle: 1, week: 1, sessionIndex: i, completedAt: "2026-11-02T12:00:00.000Z",
    }));
    expect(isWeekComplete(r800, st(r800), logs.slice(0, 2))).toBe(false);
    expect(isWeekComplete(r800, st(r800), logs)).toBe(true);
  });
  it("Session A ends with the warm-up line; Zone 2 shows its effort note", () => {
    const w = runWeek(r800, st(r800));
    expect(w[0].lines.at(-1)).toBe("10 min easy warm-up + cool-down");
    expect(w[1].lines).toEqual(["20 min · talk test or heart rate ≤ 180 − age"]);
  });
});

describe("helpers", () => {
  it("fmtTimeDigits formats typed digits as M:SS / H:MM:SS", () => {
    expect(["2", "24", "245", "1200", "10230", "0245"].map((d) => fmtTimeDigits(d)))
      .toEqual(["2", "24", "2:45", "12:00", "1:02:30", "2:45"]);
  });
  it("parseTime: M:SS → seconds; invalid → null", () => {
    expect(parseTime("2:45")).toBe(165);
    expect(parseTime("1:02:30")).toBe(3750);
    expect(parseTime("2:75")).toBeNull();
    expect(parseTime("")).toBeNull();
  });
  it("fmtDistance: meters under a mile, miles from a mile", () => {
    expect([200, 800, 1.5 * 1609.344, 5 * 1609.344].map(fmtDistance)).toEqual(["200m", "800m", "1.5 mi", "5 mi"]);
  });
  it("fmtLength: seconds under 2 min, whole minutes, else M:SS", () => {
    expect([45, 60, 90, 180, 420, 150].map(fmtLength)).toEqual(["45s", "60s", "90s", "3 min", "7 min", "2:30"]);
  });
  it("runSessionTitle matches the card order; logged sets decide old week-4 logs", () => {
    expect([0, 1, 2].map((i) => runSessionTitle(r800, 2, i)))
      .toEqual(["Session A — Intervals", "Session B — Zone 2", "Session A — Intervals"]);
    expect(runSessionTitle(r3, 4, 2)).toBe("Time Trial");
    expect(runSessionTitle(r3, 4, 0, [{ part: "trial", time: 1400 }])).toBe("Time Trial");          // v0.3 week 4 card 1
    expect(runSessionTitle(r3, 4, 2, [{ part: "speed", distance: 400, time: 100 }])).toBe("Session A — Intervals"); // v0.3 deload
  });
});
