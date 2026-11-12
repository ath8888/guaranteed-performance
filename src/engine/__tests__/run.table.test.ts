// One test per row and per example in decision-tables/run.md (v1.0)
import { applyRunResult, initRunState, normalizeRunState, rungAt, runWeek, runWeeksToTarget } from "../run";
import { currentValue } from "../progression";
import type { RunState, SetActual, Standard, StandardType, TrainingState } from "../types";

const std = (type: StandardType, start: number, target: number): Standard => ({
  id: "r", type, category: "run", start, target, createdAt: "2026-11-01T12:00:00.000Z", status: "active",
});
const r800 = std("run800", 160, 150);   // 2:40
const r1_5 = std("run1_5", 600, 540);   // 10:00
const r3 = std("run3", 1440, 1320);     // 24:00
const r5 = std("run5", 2700, 2500);     // 45:00

const st = (s: Standard, run: Partial<RunState> = {}, week: 1 | 2 | 3 | 4 = 1): TrainingState => ({
  standardId: "r", trainingMax: 0, cycle: 1, week, run: { ...initRunState(s), ...run },
});
const DAY = new Date("2026-11-02T12:00:00.000Z");
const cards = (s: Standard, t: TrainingState) => runWeek(s, t);
const sessionA = (s: Standard, t: TrainingState) => cards(s, t)[0];

// Session A log: speed reps at target, then each race-pace interval as [length s, pace s/mi, rest s]
type Iv = [number, number, number];
const logA = (s: Standard, t: TrainingState, ivs: Iv[]): SetActual[] => {
  let k = 0;
  return sessionA(s, t).sets!.map((p) => {
    if (p.part === "speed") return { part: "speed", distance: p.distance, time: p.time, rest: 120 };
    if (p.part === "interval") {
      const iv = ivs[k++];
      return iv ? { part: "interval", length: iv[0], pace: iv[1], rest: iv[2] } : {};
    }
    return {};
  });
};
const four = (length: number, pace: number, rest = 110): Iv[] => Array.from({ length: 4 }, () => [length, pace, rest]);
const applyA = (s: Standard, t: TrainingState, ivs: Iv[]) => applyRunResult(s, t, sessionA(s, t), logA(s, t, ivs), false, DAY);
const trial = (s: Standard, t: TrainingState, time?: number, skipped = false) =>
  applyRunResult(s, t, cards(s, t)[2], time == null ? [{}] : [{ part: "trial", time }], skipped, DAY);
const zone2 = (s: Standard, t: TrainingState, minutes: number, skipped = false) =>
  applyRunResult(s, t, cards(s, t)[1], [{ part: "zone2", minutes }], skipped, DAY);

describe("R1 — starting state", () => {
  it("R1-R1: CURRENT = START, base pace = START race pace, counter 0, rung 1, Zone 2 at start length", () => {
    expect(initRunState(r800)).toMatchObject({ current: 160, base: 322, counter: 0, rung: 1, z2Min: 20, z2Full: 0 });
    expect(initRunState(r1_5)).toMatchObject({ base: 400 });
    expect(initRunState(r3)).toMatchObject({ current: 1440, base: 480 });
    expect(initRunState(r5)).toMatchObject({ base: 540 });
    expect(initRunState(r800)).not.toHaveProperty("adjust");
  });
});

describe("R2 — Session A", () => {
  const shape = (s: Standard) => {
    const sets = sessionA(s, st(s)).sets!;
    const sp = sets.filter((x) => x.part === "speed");
    const th = sets.filter((x) => x.part === "threshold");
    return [sp.length, sp[0].distance, sets.filter((x) => x.part === "interval").length, th.map((x) => x.minutes)];
  };
  it("R2-R1: 800m — 2 × 100m, 4 intervals, 1 × 3 min threshold", () => expect(shape(r800)).toEqual([2, 100, 4, [3]]));
  it("R2-R2: 1.5 mi — 2 × 200m, 4 intervals, 1 × 7 min threshold", () => expect(shape(r1_5)).toEqual([2, 200, 4, [7]]));
  it("R2-R3: 3 mi — 2 × 400m, 4 intervals, no threshold", () => expect(shape(r3)).toEqual([2, 400, 4, []]));
  it("R2-R4: 5 mi — 2 × 400m, 4 intervals, no threshold", () => expect(shape(r5)).toEqual([2, 400, 4, []]));
  it("order: speed reps, race-pace intervals, threshold; threshold never changes anything", () => {
    expect(sessionA(r800, st(r800)).sets!.map((x) => x.part)).toEqual(
      ["speed", "speed", "interval", "interval", "interval", "interval", "threshold"]);
    const t = st(r800);
    const sets = logA(r800, t, four(45, 322));
    sets[6] = { part: "threshold", minutes: 3 };
    expect(applyRunResult(r800, t, sessionA(r800, t), sets, false, DAY)).toEqual(applyA(r800, t, four(45, 322)));
  });
});

describe("R3 — ladders (rungs 1–8 from base pace B)", () => {
  const ladder = (s: Standard) => [1, 2, 3, 4, 5, 6, 7, 8].map((n) => { const r = rungAt(s, 500, n); return [r.length, 500 - r.pace]; });
  it("R3-R1: 800m", () => expect(ladder(r800)).toEqual(
    [[45, 0], [60, 0], [75, 0], [60, 15], [75, 15], [60, 30], [75, 30], [60, 45]]));
  it("R3-R2: 1.5 mi", () => expect(ladder(r1_5)).toEqual(
    [[90, 0], [180, 0], [90, 15], [180, 15], [90, 30], [180, 30], [90, 45], [180, 45]]));
  it("R3-R3: 3 mi", () => expect(ladder(r3)).toEqual(
    [[180, 0], [300, 0], [420, 0], [300, 30], [420, 30], [300, 60], [420, 60], [300, 90]]));
  it("R3-R4: 5 mi = 3 mi", () => expect(ladder(r5)).toEqual(ladder(r3)));
});

describe("R4 — weekly cards", () => {
  it("R4-R1: weeks 1–3 → A · Zone 2 · A, every card skippable, no OPTIONAL card tag", () => {
    for (const w of [1, 2, 3] as const) {
      const c = cards(r3, st(r3, {}, w));
      expect(c.map((x) => x.kind)).toEqual(["intervals", "zone2", "intervals"]);
      expect(c.map((x) => x.title)).toEqual(["Session A — Intervals", "Session B — Zone 2", "Session A — Intervals"]);
      expect(c.every((x) => x.optional && !x.optionalTag)).toBe(true);
    }
  });
  it("R4-R2: week 4 → A · Zone 2 · Time Trial (OPTIONAL)", () => {
    const c = cards(r3, st(r3, {}, 4));
    expect(c.map((x) => x.kind)).toEqual(["intervals", "zone2", "trial"]);
    expect(c.map((x) => !!x.optionalTag)).toEqual([false, false, true]);
    expect(c[0]).toEqual(cards(r3, st(r3))[0]);
  });
});

describe("R5 — targets shown", () => {
  it("R5-R1: speed split = CURRENT converted to the rep distance, rounded", () => {
    expect(sessionA(r3, st(r3)).sets![0]).toMatchObject({ distance: 400, time: 103 });
    expect(sessionA(r800, st(r800)).sets![0]).toMatchObject({ distance: 100, time: 18 });
  });
  it("R5-R2: race-pace interval = current rung's length and pace", () => {
    expect(sessionA(r3, st(r3, { rung: 4 })).sets![2]).toMatchObject({ length: 300, pace: 450 });
  });
  it("R5-R3: threshold rep = length only, no pace", () => {
    const th = sessionA(r1_5, st(r1_5)).sets!.find((x) => x.part === "threshold")!;
    expect(th).toEqual({ reps: 1, part: "threshold", minutes: 7 });
  });
  it("R5-R4: Zone 2 = length only, no pace; effort note", () => {
    const z = cards(r3, st(r3))[1];
    expect(z.sets).toEqual([{ reps: 1, part: "zone2", minutes: 30 }]);
    expect(z.lines).toEqual(["30 min · talk test or heart rate ≤ 180 − age"]);
  });
  it("R5-R5: Time Trial = race distance, no target", () => {
    const tt = cards(r800, st(r800, {}, 4))[2];
    expect(tt.sets).toEqual([{ reps: 1, part: "trial", distance: 800 }]);
  });
  it("speed reps never change anything", () => {
    const t = st(r3);
    const sets = logA(r3, t, four(180, 490));
    sets[0] = { part: "speed", distance: 400, time: 60, rest: 30 };
    expect(applyRunResult(r3, t, sessionA(r3, t), sets, false, DAY)).toEqual(applyA(r3, t, four(180, 490)));
  });
});

describe("R6 — ladder after Session A (3 mi, base 8:00)", () => {
  it("R6-R1: skipped → rung, counter, CURRENT unchanged", () => {
    const t = st(r3, { rung: 3, counter: 1 });
    expect(applyRunResult(r3, t, sessionA(r3, t), undefined, true, DAY)).toMatchObject({ rung: 3, counter: 1, current: 1440 });
  });
  it("R6-R2: a higher rung met → highest rung met, counter 1 (even with counter 1 on the current rung)", () => {
    expect(applyA(r3, st(r3, { counter: 1 }), four(420, 480))).toMatchObject({ rung: 3, counter: 1 });
  });
  it("R6-R3: current rung met and counter reaches 2 → next rung, counter 0", () => {
    expect(applyA(r3, st(r3, { counter: 1 }), four(180, 480))).toMatchObject({ rung: 2, counter: 0 });
  });
  it("R6-R4: current rung met → counter + 1", () => {
    expect(applyA(r3, st(r3), four(180, 480))).toMatchObject({ rung: 1, counter: 1 });
  });
  it("R6-R5: slower, shorter, a rest over 2:00, or not all logged → counter 0, no penalty", () => {
    const t = st(r3, { rung: 2, counter: 1 });
    const slower = four(300, 480); slower[3] = [300, 481, 110];
    const shorter = four(300, 480); shorter[0] = [299, 480, 110];
    const rest = four(300, 480); rest[1] = [300, 480, 121];
    const missing = four(300, 480).slice(0, 3);
    for (const ivs of [slower, shorter, rest, missing]) {
      expect(applyA(r3, t, ivs)).toMatchObject({ rung: 2, counter: 0, current: 1440 });
    }
  });
  it("the rest after the 4th interval does not count", () => {
    const ivs = four(180, 480); ivs[3] = [180, 480, 400];
    expect(applyA(r3, st(r3), ivs)).toMatchObject({ counter: 1 });
  });
  it("week 4's Session A counts", () => {
    expect(applyA(r3, st(r3, { counter: 1 }, 4), four(180, 480))).toMatchObject({ rung: 2, counter: 0 });
  });
});

describe("R7 — CURRENT on a rung move", () => {
  it("R7-R1: converted time faster than CURRENT → CURRENT = converted time, chart point added", () => {
    const r = applyA(r3, st(r3, { rung: 6, counter: 1 }), four(300, 420));
    expect(r.current).toBe(1373);
    expect(r.points.at(-1)).toEqual({ date: "2026-11-02", current: 1373 });
  });
  it("R7-R2: otherwise → CURRENT unchanged, no chart point", () => {
    const r = applyA(r3, st(r3, { rung: 5, counter: 1 }), four(420, 450));
    expect(r).toMatchObject({ rung: 6, current: 1440 });
    expect(r.points).toHaveLength(1);
  });
  it("no rung move → CURRENT unchanged even if the converted time is faster", () => {
    expect(applyA(r3, st(r3, { rung: 6, counter: 0 }), four(300, 420)).current).toBe(1440);
  });
});

describe("R8 — Time Trial", () => {
  const w4 = st(r800, { rung: 3, counter: 1 }, 4);
  it("R8-R1: skipped, or no time logged → unchanged", () => {
    expect(trial(r800, w4, undefined, true)).toMatchObject({ current: 160, trials: [] });
    expect(trial(r800, w4)).toMatchObject({ current: 160, trials: [] });
  });
  it("R8-R2: faster than CURRENT → CURRENT = trial time; rung and counter unchanged", () => {
    const r = trial(r800, w4, 155);
    expect(r).toMatchObject({ current: 155, rung: 3, counter: 1 });
    expect(r.points.at(-1)).toEqual({ date: "2026-11-02", current: 155 });
  });
  it("R8-R3: equal or slower → CURRENT unchanged; time saved, no chart point", () => {
    for (const time of [160, 170]) {
      const r = trial(r800, w4, time);
      expect(r).toMatchObject({ current: 160, rung: 3, counter: 1, trials: [{ date: "2026-11-02", time, cycle: 1 }] });
      expect(r.points).toHaveLength(1);
    }
  });
});

describe("R9 — Zone 2 length", () => {
  const twoFull = (s: Standard, t: TrainingState, min: number) => {
    const once = zone2(s, t, min);
    return zone2(s, { ...t, run: once }, min).z2Min;
  };
  it("R9-R1: 800m starts at 20, caps at 45", () => {
    expect(initRunState(r800).z2Min).toBe(20);
    expect(twoFull(r800, st(r800, { z2Min: 45 }), 45)).toBe(45);
  });
  it("R9-R2: 1.5 mi starts at 25, caps at 50", () => {
    expect(initRunState(r1_5).z2Min).toBe(25);
    expect(twoFull(r1_5, st(r1_5, { z2Min: 50 }), 50)).toBe(50);
  });
  it("R9-R3: 3 mi starts at 30, caps at 60", () => {
    expect(initRunState(r3).z2Min).toBe(30);
    expect(twoFull(r3, st(r3, { z2Min: 60 }), 60)).toBe(60);
  });
  it("R9-R4: 5 mi starts at 40, caps at 75", () => {
    expect(initRunState(r5).z2Min).toBe(40);
    expect(twoFull(r5, st(r5, { z2Min: 75 }), 80)).toBe(75);
  });
  it("a short or skipped Zone 2 run doesn't count and doesn't reset the count", () => {
    const t = st(r3, { z2Full: 1 });
    expect(zone2(r3, t, 29)).toMatchObject({ z2Min: 30, z2Full: 1 });
    expect(zone2(r3, t, 30, true)).toMatchObject({ z2Min: 30, z2Full: 1 });
    expect(zone2(r3, t, 30)).toMatchObject({ z2Min: 35, z2Full: 0 });
  });
  it("Zone 2 never changes rung, counter or CURRENT", () => {
    expect(zone2(r3, st(r3, { counter: 1 }), 30)).toMatchObject({ rung: 1, counter: 1, current: 1440 });
  });
});

describe("R10 — weeks to target", () => {
  const now = new Date("2026-11-29T12:00:00.000Z"); // 4 weeks after adding
  it("R10-R1: CURRENT at or below target → 0 (REACHED)", () => {
    expect(runWeeksToTarget(r3, st(r3), 1320, now)).toBe(0);
    expect(runWeeksToTarget(r3, st(r3), 1300, now)).toBe(0);
  });
  it("R10-R2: 2+ weeks and improved → observed gain (40 s / 4 wk = 10/wk; 80 s left → 8)", () => {
    expect(runWeeksToTarget(r3, st(r3), 1400, now)).toBe(8);
  });
  it("R10-R3: otherwise → default gain (3 mi 22.5 s/wk, 800m 1.9 s/wk)", () => {
    expect(runWeeksToTarget(r3, st(r3), 1440, now)).toBe(6);                                     // not improved
    expect(runWeeksToTarget(r3, st(r3), 1400, new Date("2026-11-10T12:00:00.000Z"))).toBe(4);   // < 2 weeks: 80 / 22.5
    expect(runWeeksToTarget(r800, st(r800), 160, now)).toBe(6);                                  // 10 / 1.86
    expect(runWeeksToTarget(r5, st(r5), 2700, now)).toBe(6);                                     // 200 / 37.5
    expect(runWeeksToTarget(r1_5, st(r1_5), 600, now)).toBe(11);                                 // 60 / 5.6
  });
});

describe("R11 — standards saved before v1.0", () => {
  it("R11-R1: old ladder / adjustments, no rung → rung 1, counter 0, base = CURRENT pace, Zone 2 start; CURRENT kept", () => {
    const old = { ladder: 450, streak: 1, current: 1380, adjust: { speed: -5 }, trials: [{ date: "2026-11-01", time: 1380, cycle: 1 }], points: [{ date: "2026-11-01", current: 1440 }] };
    const r = normalizeRunState(r3, old as unknown as RunState);
    expect(r).toEqual({ rung: 1, counter: 0, base: 460, current: 1380, z2Min: 30, z2Full: 0, trials: old.trials, points: old.points });
  });
});

describe("Examples", () => {
  it("E1 — new 3 mi, START 24:00: 2 × 400m in 1:43, then 4 × 3 min @ 8:00/mi, no threshold rep", () => {
    const a = sessionA(r3, st(r3));
    expect(a.lines[0]).toMatch(/^2 × 400m @ .* in 1:43secs · rest ≤ 2:00$/);
    expect(a.lines[1]).toBe("4 × 3 min @ 8:00/mi · rest ≤ 2:00");
    expect(a.sets!.some((x) => x.part === "threshold")).toBe(false);
  });
  it("E2 — new 800m, START 2:40: 2 × 100m in 0:18, then 4 × 45s @ 5:22/mi, then 1 × 3 min threshold (OPTIONAL)", () => {
    const a = sessionA(r800, st(r800));
    expect(a.lines[0]).toMatch(/^2 × 100m @ .* in 0:18secs · rest ≤ 2:00$/);
    expect(a.lines[1]).toBe("4 × 45s @ 5:22/mi · rest ≤ 2:00");
    expect(a.lines[2]).toBe("1 × 3 min threshold · any cardio · OPTIONAL");
  });
  it("E3 — two in a row, CURRENT holds: rung 5 → 6, counter 0, CURRENT 24:00", () => {
    expect(rungAt(r3, 480, 5)).toEqual({ length: 420, pace: 450 });
    expect(applyA(r3, st(r3, { rung: 5, counter: 1 }), four(420, 450))).toMatchObject({ rung: 6, counter: 0, current: 1440 });
    expect(rungAt(r3, 480, 6)).toEqual({ length: 300, pace: 420 });
  });
  it("E4 — two in a row, CURRENT drops: rung 6 → 7, counter 0, CURRENT 22:53", () => {
    expect(applyA(r3, st(r3, { rung: 6, counter: 1 }), four(300, 420))).toMatchObject({ rung: 7, counter: 0, current: 1373 });
    expect(rungAt(r3, 480, 7)).toEqual({ length: 420, pace: 420 });
  });
  it("E5 — skipping a rung: rung 1 → 2, counter 1, CURRENT 24:00", () => {
    expect(applyA(r3, st(r3), four(300, 478))).toMatchObject({ rung: 2, counter: 1, current: 1440 });
  });
  it("E6 — rest too long: counter 0, rung and CURRENT the same", () => {
    const ivs = four(300, 480); ivs[2] = [300, 480, 150];
    expect(applyA(r3, st(r3, { rung: 2, counter: 1 }), ivs)).toMatchObject({ rung: 2, counter: 0, current: 1440 });
  });
  it("E7 — faster Time Trial: CURRENT 23:30, rung 5 and counter 1 unchanged", () => {
    expect(trial(r3, st(r3, { rung: 5, counter: 1 }, 4), 1410)).toMatchObject({ current: 1410, rung: 5, counter: 1 });
  });
  it("E8 — slower Time Trial: CURRENT stays 23:30, time saved", () => {
    const r = trial(r3, st(r3, { current: 1410 }, 4), 1425);
    expect(r.current).toBe(1410);
    expect(r.trials).toEqual([{ date: "2026-11-02", time: 1425, cycle: 1 }]);
  });
  it("E9 — Zone 2 grows: two runs of 30 min → 35 min", () => {
    const t = st(r3);
    const once = zone2(r3, t, 30);
    const twice = zone2(r3, { ...t, run: once }, 32);
    expect(twice.z2Min).toBe(35);
    expect(cards(r3, { ...t, run: twice })[1].sets![0].minutes).toBe(35);
  });
  it("E10 — old standard with CURRENT 23:00: rung 1, 4 × 3 min @ 7:40/mi, counter 0, CURRENT 23:00", () => {
    const t: TrainingState = { standardId: "r", trainingMax: 0, cycle: 1, week: 2,
      run: { ladder: 450, streak: 1, current: 1380, adjust: {}, trials: [], points: [] } as unknown as RunState };
    expect(sessionA(r3, t).lines[1]).toBe("4 × 3 min @ 7:40/mi · rest ≤ 2:00");
    expect(normalizeRunState(r3, t.run)).toMatchObject({ rung: 1, counter: 0, current: 1380 });
    expect(currentValue(r3, t)).toBe(1380);
  });
});
