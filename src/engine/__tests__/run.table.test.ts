// One test per row and per example in decision-tables/run.md (v0.3)
import { applyRunResult, initRunState, runPaces, runWeek, runWeeksToTarget, speedFormula, thresholdFormula } from "../run";
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
const cardA = (s: Standard, t: TrainingState) => runWeek(s, t)[t.week === 4 ? 2 : 0];
// Session A log: speed reps at `split` s, threshold reps at `pace` s/mi (default: as planned)
const logA = (s: Standard, t: TrainingState, split: number, pace?: number): SetActual[] =>
  cardA(s, t).sets!.map((p) => (p.part === "speed" ? { time: split } : { pace: pace ?? p.pace }));
const applyA = (s: Standard, t: TrainingState, sets?: SetActual[], skipped = false) =>
  applyRunResult(s, t, cardA(s, t), sets, skipped, DAY);
const tt = (t: TrainingState, time?: number, skipped = false) => {
  const trial = runWeek(r800, t)[0];
  return applyRunResult(r800, t, trial, time == null ? [{}] : [{ time }], skipped, DAY);
};
// Shape of a week's Session A + Zone 2: [speed reps, rep m, threshold reps, threshold min, zone 2 min]
const shape = (s: Standard, week: 1 | 2 | 3 | 4) => {
  const cards = runWeek(s, st(s, {}, week));
  const a = cards[week === 4 ? 2 : 0].sets!;
  const sp = a.filter((x) => x.part === "speed");
  const th = a.filter((x) => x.part === "threshold");
  return [sp.length, sp[0].distance, th.length, th[0].minutes, cards[1].sets![0].minutes];
};

describe("R1 — starting state", () => {
  it("R1-R1: CURRENT = START, ladder = START race pace, counter 0, no adjustments", () => {
    expect(initRunState(r800)).toMatchObject({ current: 160, ladder: 322, streak: 0, adjust: {} });
    expect(initRunState(r3)).toMatchObject({ current: 1440, ladder: 480 });
  });
});

describe("R2 — distance plans (weeks 1 / 2 / 3, Zone 2 incl. week 4)", () => {
  const plan = (s: Standard) => ([1, 2, 3] as const).map((w) => shape(s, w)).concat([[shape(s, 4)[4]]]);
  it("R2-R1: 800m — speed ladder, 200m × 6/7/8, threshold 3/3/5 min × 2/3/2, Zone 2 25/30/35/20", () => {
    expect(plan(r800)).toEqual([[6, 200, 2, 3, 25], [7, 200, 3, 3, 30], [8, 200, 2, 5, 35], [20]]);
    expect(runWeek(r800, st(r800))[0].sets!.find((x) => x.part === "speed")!.ladder).toBe(true);
  });
  it("R2-R2: 1.5 mi — speed ladder, 400m × 5/6/7, threshold 5/5/7 × 2/3/2, Zone 2 30/35/40/25", () => {
    expect(plan(r1_5)).toEqual([[5, 400, 2, 5, 30], [6, 400, 3, 5, 35], [7, 400, 2, 7, 40], [25]]);
    expect(runWeek(r1_5, st(r1_5))[0].sets!.find((x) => x.part === "speed")!.ladder).toBe(true);
  });
  it("R2-R3: 3 mi — threshold ladder, 400m × 2/3/4, threshold 5/5/7 × 4/5/4, Zone 2 40/45/50/35", () => {
    expect(plan(r3)).toEqual([[2, 400, 4, 5, 40], [3, 400, 5, 5, 45], [4, 400, 4, 7, 50], [35]]);
    expect(runWeek(r3, st(r3))[0].sets!.find((x) => x.part === "threshold")!.ladder).toBe(true);
  });
  it("R2-R4: 5 mi — threshold ladder, 400m × 2/3/4, threshold 7 min × 3/4/5, Zone 2 45/55/60/40", () => {
    expect(plan(r5)).toEqual([[2, 400, 3, 7, 45], [3, 400, 4, 7, 55], [4, 400, 5, 7, 60], [40]]);
    expect(runWeek(r5, st(r5))[0].sets!.find((x) => x.part === "threshold")!.ladder).toBe(true);
  });
  it("rests: speed 1:00 (200m) / 1:30 (400m); threshold 1:00 for 3–5 min, 1:30 for 7 min; warm-up line", () => {
    expect(runWeek(r800, st(r800))[0].lines).toEqual([
      "6 × 200m @ 5:22/mi in 0:40secs · 1:00 jog", "2 × 3 min @ 6:44/mi · 1:00 jog", "10 min easy warm-up + cool-down",
    ]);
    expect(runWeek(r5, st(r5))[0].lines[0]).toMatch(/^3 × 7 min @ .* · 1:30 jog$/);
    expect(runWeek(r5, st(r5))[0].lines[1]).toMatch(/^2 × 400m @ .* · 1:30 jog$/);
  });
});

describe("R3 — weekly cards", () => {
  it("R3-R1: weeks 1–3 → A · Zone 2 · A (same A twice); short = speed first, long = threshold first", () => {
    for (const w of [1, 2, 3] as const) {
      const c = runWeek(r800, st(r800, {}, w));
      expect(c.map((x) => x.kind)).toEqual(["intervals", "zone2", "intervals"]);
      expect(c[2]).toEqual(c[0]);
    }
    expect(runWeek(r800, st(r800))[0].title).toBe("Session A — Speed + Threshold");
    expect(runWeek(r3, st(r3))[0].title).toBe("Session A — Threshold + Speed");
  });
  it("R3-R2: week 4 → Time Trial · Zone 2 · deload A (half of W3 reps rounded up, W1 threshold length)", () => {
    const c = runWeek(r800, st(r800, {}, 4));
    expect(c.map((x) => x.kind)).toEqual(["trial", "zone2", "intervals"]);
    expect(c[0].sets).toEqual([{ reps: 1, part: "trial", distance: 800 }]);
    expect(shape(r800, 4).slice(0, 4)).toEqual([4, 200, 1, 3]);
    expect(shape(r5, 4).slice(0, 4)).toEqual([2, 400, 3, 7]); // ceil(4/2), ceil(5/2) × 7 min
  });
  it("every card can be skipped, no Recommended / Optional tag", () => {
    for (const w of [1, 4] as const) for (const c of runWeek(r800, st(r800, {}, w))) {
      expect(c.optional).toBe(true);
      expect(c.recommended).toBeUndefined();
    }
  });
});

describe("R4 — paces", () => {
  it("R4-R1: the ladder part uses the ladder pace", () => {
    expect(runPaces(r800, st(r800, { ladder: 300 }).run!).speed).toBe(300);
    expect(runPaces(r3, st(r3, { ladder: 470 }).run!).threshold).toBe(470);
  });
  it("R4-R2: short threshold = Riegel 10K (1.08) + 10 + adjustment", () => {
    expect(thresholdFormula(r800, 160)).toBe(404);
    expect(runPaces(r800, st(r800, { adjust: { threshold: -6 } }).run!).threshold).toBe(398);
  });
  it("R4-R3: long speed = Riegel mile (1.06) + adjustment", () => {
    expect(speedFormula(r3, 1440)).toBe(449);
    expect(runPaces(r3, st(r3, { adjust: { speed: -4 } }).run!).speed).toBe(445);
  });
  it("R4-R4: Zone 2 ceiling = threshold formula + 75, never adjusted", () => {
    expect(runPaces(r800, st(r800, { adjust: { threshold: -6 } }).run!).zone2).toBe(479);
    expect(runPaces(r3, st(r3).run!).zone2).toBe(511 + 75);
  });
});

describe("R5 — ladder after Session A (weeks 1–3)", () => {
  it("R5-R1: skipped → nothing changes", () => {
    const t = st(r800, { streak: 1 });
    expect(applyA(r800, t, undefined, true)).toEqual(t.run);
  });
  it("R5-R2: a ladder rep slower than target or not done → counter 0, no penalty", () => {
    const t = st(r800, { streak: 1 });
    const sets = logA(r800, t, 40);
    sets[0] = { time: 41 };
    expect(applyA(r800, t, sets)).toMatchObject({ ladder: 322, current: 160, streak: 0 });
    sets[0] = {};
    expect(applyA(r800, t, sets)).toMatchObject({ ladder: 322, current: 160, streak: 0 });
  });
  it("R5-R3: average a full step or more faster → jump, CURRENT − half per step, counter 0", () => {
    const r = applyA(r800, st(r800, { streak: 1 }), logA(r800, st(r800), 36)); // 4:50/mi avg, 32 s faster
    expect(r.ladder).toBe(292);
    expect(r.current).toBeCloseTo(160 - 2 * 7.5 * (800 / 1609.344), 6);
    expect(r.streak).toBe(0);
  });
  it("R5-R4: all hit, counter reaches 2 → ladder − 15, CURRENT − half a step, counter 0", () => {
    const r = applyA(r800, st(r800, { streak: 1 }), logA(r800, st(r800), 40));
    expect(r.ladder).toBe(307);
    expect(r.current).toBeCloseTo(160 - 7.5 * (800 / 1609.344), 6);
    expect(r.streak).toBe(0);
  });
  it("R5-R5: all hit otherwise → counter + 1", () => {
    expect(applyA(r800, st(r800), logA(r800, st(r800), 40))).toMatchObject({ ladder: 322, current: 160, streak: 1 });
  });
  it("the week 4 deload Session A never counts toward the ladder", () => {
    const t = st(r800, { streak: 1 }, 4);
    expect(applyA(r800, t, logA(r800, t, 36))).toMatchObject({ ladder: 322, current: 160, streak: 1 });
  });
});

describe("R6 — Time Trial (week 4)", () => {
  it("R6-R1: skipped or no time → nothing changes", () => {
    const t = st(r800, { streak: 1 }, 4);
    expect(tt(t, undefined)).toEqual(t.run);
    expect(tt(t, 150, true)).toEqual(t.run);
  });
  it("R6-R2: faster → CURRENT = trial time, counter + 1; at 2 the ladder steps (CURRENT not moved again)", () => {
    expect(tt(st(r800, { current: 156 }, 4), 151)).toMatchObject({ current: 151, streak: 1, ladder: 322 });
    expect(tt(st(r800, { current: 156, streak: 1 }, 4), 151)).toMatchObject({ current: 151, streak: 0, ladder: 307 });
  });
  it("R6-R3: equal or slower → CURRENT holds, counter 0; time saved, no chart point", () => {
    for (const time of [156, 160]) {
      const t = st(r800, { current: 156, streak: 1 }, 4);
      const r = tt(t, time);
      expect(r).toMatchObject({ current: 156, streak: 0, ladder: 322 });
      expect(r.trials).toEqual([{ date: "2026-11-02", time, cycle: 1 }]);
      expect(r.points).toEqual(t.run!.points);
    }
  });
});

describe("R7 — personal adjustment (non-ladder part)", () => {
  it("R7-R1: a non-ladder rep not logged → unchanged", () => {
    const t = st(r800);
    const sets = logA(r800, t, 40, 390);
    sets[sets.length - 1] = {};
    expect(applyA(r800, t, sets).adjust).toEqual({});
  });
  it("R7-R2: average faster than planned → adjustment = average − formula", () => {
    expect(applyA(r800, st(r800), logA(r800, st(r800), 40, 398)).adjust).toEqual({ threshold: -6 });
  });
  it("R7-R3: equal or slower → unchanged", () => {
    expect(applyA(r800, st(r800), logA(r800, st(r800), 40, 404)).adjust).toEqual({});
    expect(applyA(r800, st(r800), logA(r800, st(r800), 40, 420)).adjust).toEqual({});
  });
  it("the week 4 deload Session A also counts; Zone 2 never changes anything", () => {
    const t4 = st(r800, {}, 4);
    expect(applyA(r800, t4, logA(r800, t4, 40, 398)).adjust).toEqual({ threshold: -6 });
    const t = st(r800);
    const z2 = runWeek(r800, t)[1];
    expect(applyRunResult(r800, t, z2, [{ minutes: 30, pace: 400 }], false, DAY)).toEqual(t.run);
  });
});

describe("R8 — weeks to target", () => {
  const NOW = new Date("2026-11-29T12:00:00Z");
  it("R8-R1: CURRENT at or below target → 0", () => {
    expect(runWeeksToTarget(r800, st(r800), 150)).toBe(0);
    expect(runWeeksToTarget(r800, st(r800), 149)).toBe(0);
  });
  it("R8-R2: 2+ weeks and improved → (CURRENT − target) ÷ observed gain per week", () => {
    const t = st(r800, { current: 155, points: [
      { date: "2026-11-01T12:00:00.000Z", current: 160 }, { date: "2026-11-29T12:00:00.000Z", current: 155 },
    ] });
    expect(runWeeksToTarget(r800, t, 155, NOW)).toBe(4); // 5 s over 4 weeks, 5 s left
  });
  it("R8-R3: otherwise → 3.75 s/mi × miles per week (800m 2:40 → 2:30 = 6 weeks)", () => {
    expect(runWeeksToTarget(r800, st(r800), 160, new Date("2026-11-01T12:00:00Z"))).toBe(6);
    const flat = st(r800, { points: [
      { date: "2026-11-01T12:00:00.000Z", current: 160 }, { date: "2026-11-29T12:00:00.000Z", current: 160 },
    ] });
    expect(runWeeksToTarget(r800, flat, 160, NOW)).toBe(6);
  });
});

describe("Examples", () => {
  it("E1: 800m 2:40 → ladder 5:22/mi, '200m @ 5:22/mi in 0:40secs'", () => {
    expect(runWeek(r800, st(r800))[0].lines[0]).toBe("6 × 200m @ 5:22/mi in 0:40secs · 1:00 jog");
  });
  it("E2: counter 1, all hit → 5:07/mi, CURRENT 2:36, counter 0", () => {
    const run = applyA(r800, st(r800, { streak: 1 }), logA(r800, st(r800), 40));
    expect([run.ladder, currentValue(r800, st(r800, run)), run.streak]).toEqual([307, 156, 0]);
  });
  it("E3: average 4:50/mi → 4:52/mi, CURRENT 2:33", () => {
    const run = applyA(r800, st(r800), logA(r800, st(r800), 36));
    expect([run.ladder, currentValue(r800, st(r800, run))]).toEqual([292, 153]);
  });
  it("E4: a miss → counter 0, ladder and CURRENT unchanged", () => {
    const t = st(r800, { streak: 1 });
    const sets = logA(r800, t, 40);
    sets[2] = { time: 42 };
    expect(applyA(r800, t, sets)).toMatchObject({ streak: 0, ladder: 322, current: 160 });
  });
  it("E5: CURRENT 2:36, trial 2:40 → CURRENT stays 2:36, counter 0", () => {
    expect(tt(st(r800, { current: 156, streak: 1 }, 4), 160)).toMatchObject({ current: 156, streak: 0 });
  });
  it("E6: 800m week 4 deload → 4 speed reps, 1 × 3 min threshold", () => {
    expect(shape(r800, 4).slice(0, 4)).toEqual([4, 200, 1, 3]);
  });
  it("E7: CURRENT 2:36, trial 2:31 → CURRENT 2:31, counter 1", () => {
    expect(tt(st(r800, { current: 156 }, 4), 151)).toMatchObject({ current: 151, streak: 1 });
  });
});
