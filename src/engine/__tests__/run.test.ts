import {
  RUN_CONFIG,
  applyRunResult,
  fmtDistance,
  fmtTime,
  fmtTimeDigits,
  parseTime,
  runSessionTitle,
  initRunState,
  runPaces,
  runWeek,
  runWeeksToTarget,
  speedFormula,
  thresholdFormula,
} from "../run";
import { ENGINES } from "../registry";
import { currentValue, estCompletionDate, isWeekComplete } from "../progression";
import type { RunState, SessionLog, SetActual, Standard, StandardType, TrainingState } from "../types";
import { CATEGORY_LABEL, STANDARD_META } from "../types";

const std = (type: StandardType, start: number, target: number): Standard => ({
  id: "r1", type, category: "run", start, target, createdAt: "2026-11-01T12:00:00.000Z", status: "active",
});
const r800 = std("run800", 160, 150); // 2:40 → 2:30
const r3 = std("run3", 1440, 1320);   // 24:00 → 22:00

const st = (s: Standard, run: Partial<RunState> = {}, week: 1 | 2 | 3 | 4 = 1, cycle = 1): TrainingState => ({
  standardId: s.id, trainingMax: 0, cycle, week, run: { ...initRunState(s), ...run },
});

const DAY = new Date("2026-11-02T12:00:00.000Z");
const intervals = (s: Standard, t: TrainingState) => runWeek(s, t)[0];
const trial = (s: Standard, t: TrainingState) => runWeek(s, t).find((x) => x.kind === "trial")!;
// Log a Session A: every speed rep at `split` s, every threshold rep at `pace` s/mi
const logA = (s: Standard, t: TrainingState, split: number | ((i: number) => number), pace?: number): SetActual[] =>
  intervals(s, t).sets!.map((p, i) =>
    p.part === "speed"
      ? { time: typeof split === "function" ? split(i) : split }
      : { pace: pace ?? p.pace });
const apply = (s: Standard, t: TrainingState, sets: SetActual[], skipped = false) =>
  applyRunResult(s, t, intervals(s, t), sets, skipped, DAY);
const next = (t: TrainingState, run: RunState): TrainingState => ({ ...t, run });

describe("setup", () => {
  it("4 run types in the Run category use the run engine; lower time is better", () => {
    expect(CATEGORY_LABEL.run).toBe("Run");
    for (const ty of ["run800", "run1_5", "run3", "run5"] as StandardType[]) {
      expect(STANDARD_META[ty]).toMatchObject({ category: "run", kind: "time", lower: true });
      expect(ENGINES[ty]).toBe(ENGINES.run800);
    }
    expect(STANDARD_META.run1_5.label).toBe("1.5 Mile");
  });
  it("initial state: ladder = START race pace, CURRENT = START, one point at creation", () => {
    expect(initRunState(r800)).toEqual({
      ladder: 322, streak: 0, current: 160, adjust: {}, trials: [],
      points: [{ date: r800.createdAt, current: 160 }],
    });
  });
  it("tuning values live in the config object", () => {
    expect(RUN_CONFIG).toMatchObject({ step: 15, sessionsPerStep: 2, currentShare: 0.5, zone2Add: 75 });
  });
  it("fmtTime: M:SS, H:MM:SS from an hour", () => {
    expect(fmtTime(160)).toBe("2:40");
    expect(fmtTime(39.6)).toBe("0:40");
    expect(fmtTime(3725)).toBe("1:02:05");
  });
});

describe("paces", () => {
  it("800M 2:40: ladder 5:22/mi, threshold 6:44/mi (Riegel 1.08 + 10), Zone 2 ceiling 7:59/mi", () => {
    expect(runPaces(r800, initRunState(r800))).toEqual({ speed: 322, threshold: 404, zone2: 479 });
  });
  it("3 MI 24:00: ladder (threshold) 8:00/mi, speed = Riegel mile (1.06) 7:29/mi", () => {
    const p = runPaces(r3, initRunState(r3));
    expect(p.threshold).toBe(480);
    expect(p.speed).toBe(449);
    expect(speedFormula(r3, 1440)).toBe(449);
  });
  it("personal adjustment applies to the non-step pace only; Zone 2 never adjusts", () => {
    const p = runPaces(r800, { ...initRunState(r800), adjust: { threshold: -6 } });
    expect(p.threshold).toBe(398);
    expect(p.zone2).toBe(479);
  });
});

describe("weekly plan", () => {
  it("W1–W3: A · B · A — Speed + Threshold for ≤1.5 mi", () => {
    const w = runWeek(r800, st(r800));
    expect(w.map((x) => `${x.kind}:${x.title}`)).toEqual([
      "intervals:Session A — Speed + Threshold",
      "zone2:Session B — Zone 2",
      "intervals:Session A — Speed + Threshold",
    ]);
    expect(w.every((x) => x.optional && x.recommended === undefined)).toBe(true); // SKIP on every card, no tag
  });
  it("800M W1 card: 6 × 200m in 0:40, then 2 × 3 min @ 6:44/mi; Zone 2 25 min", () => {
    const [a, b] = runWeek(r800, st(r800));
    expect(a.lines).toEqual([
      "6 × 200m @ 5:22/mi in 0:40secs · 1:00 jog",
      "2 × 3 min @ 6:44/mi · 1:00 jog",
      "10 min easy warm-up + cool-down",
    ]);
    expect(a.sets!.filter((x) => x.ladder).length).toBe(6);
    expect(a.sets!.filter((x) => x.part === "threshold" && !x.ladder).length).toBe(2);
    expect(b.lines).toEqual(["25 min · 7:59/mi or slower · conversational"]);
  });
  it("800M reps by week: 200m × 6/7/8, threshold 2×3 / 3×3 / 2×5 min, Zone 2 25/30/35", () => {
    const sum = (wk: 1 | 2 | 3) => {
      const [a, b] = runWeek(r800, st(r800, {}, wk));
      const thr = a.sets!.filter((x) => x.part === "threshold");
      return [a.sets!.filter((x) => x.part === "speed").length, thr.length, thr[0].minutes, b.sets![0].minutes];
    };
    expect([sum(1), sum(2), sum(3)]).toEqual([[6, 2, 3, 25], [7, 3, 3, 30], [8, 2, 5, 35]]);
  });
  it(">1.5 mi: Threshold + Speed, threshold reps are the ladder; 7-min reps get 1:30 rest", () => {
    const a = intervals(r3, st(r3, {}, 3));
    expect(a.title).toBe("Session A — Threshold + Speed");
    expect(a.lines.slice(0, 2)).toEqual(["4 × 7 min @ 8:00/mi · 1:30 jog", "4 × 400m @ 7:29/mi in 1:52secs · 1:30 jog"]);
    expect(a.sets!.filter((x) => x.ladder).every((x) => x.part === "threshold")).toBe(true);
  });
  it("5 MI Zone 2 runs 45/55/60, 40 in W4", () => {
    const s5 = std("run5", 2400, 2200);
    expect([1, 2, 3, 4].map((wk) => runWeek(s5, st(s5, {}, wk as 1 | 2 | 3 | 4))[1].sets![0].minutes)).toEqual([45, 55, 60, 40]);
  });
  it("W4: Time Trial · Zone 2 · deload A (ceil(W3 reps / 2), threshold at W1 length)", () => {
    const w = runWeek(r800, st(r800, {}, 4));
    expect(w.map((x) => x.title)).toEqual(["Session A — Time Trial", "Session B — Zone 2", "Session A — Speed + Threshold"]);
    expect(w[0].lines[0]).toBe("800m all-out · CURRENT 2:40");
    expect(w[1].sets![0].minutes).toBe(20);
    expect(w[2].lines.slice(0, 2)).toEqual(["4 × 200m @ 5:22/mi in 0:40secs · 1:00 jog", "1 × 3 min @ 6:44/mi · 1:00 jog"]);
  });
  it("week is complete once all 3 cards are logged", () => {
    const t = st(r800);
    const logs: SessionLog[] = [0, 1, 2].map((i) => ({
      id: `${i}`, standardId: "r1", cycle: 1, week: 1, sessionIndex: i, completedAt: DAY.toISOString(),
    }));
    expect(isWeekComplete(r800, t, logs.slice(0, 2))).toBe(false);
    expect(isWeekComplete(r800, t, logs)).toBe(true);
  });
});

describe("pace ladder", () => {
  it("2 Session A's in a row at target → step −15 s/mi; CURRENT moves by half the step", () => {
    let t = st(r800);
    const r1 = apply(r800, t, logA(r800, t, 40));
    expect(r1).toMatchObject({ ladder: 322, streak: 1, current: 160 });
    t = next(t, r1);
    const r2 = apply(r800, t, logA(r800, t, 40));
    expect(r2.ladder).toBe(307);
    expect(r2.streak).toBe(0);
    expect(fmtTime(r2.current)).toBe("2:36");
    expect(intervals(r800, next(t, r2)).lines[0]).toBe("6 × 200m @ 5:07/mi in 0:38secs · 1:00 jog");
    expect(fmtTime(runPaces(r800, r2).threshold)).toBe("6:35"); // threshold follows CURRENT
    expect(r2.points).toHaveLength(2);
  });
  it("one rep over target → counter restarts, pace holds", () => {
    const t = st(r800, { streak: 1 });
    const r = apply(r800, t, logA(r800, t, (i) => (i === 4 ? 41 : 40)));
    expect(r).toMatchObject({ ladder: 322, streak: 0, current: 160 });
  });
  it("a rep left unchecked (logged as {}) counts as a miss", () => {
    const t = st(r800, { streak: 1 });
    const sets = logA(r800, t, 40);
    sets[0] = {};
    expect(apply(r800, t, sets).streak).toBe(0);
  });
  it("average past the next step → jump to the fastest step run, counter restarts", () => {
    const t = st(r800, { ladder: 307, streak: 1, current: 156.27 }); // planned 0:38
    const r = apply(r800, t, logA(r800, t, 36)); // 0:36 ≈ 4:50/mi
    expect(r.ladder).toBe(292);
    expect(r.streak).toBe(0);
    expect(r.current).toBeCloseTo(156.27 - 7.5 * (800 / 1609.344));
  });
  it("big jump moves several steps (CURRENT by half of each)", () => {
    const t = st(r800);
    const r = apply(r800, t, logA(r800, t, 35)); // ≈ 4:42/mi vs 5:22 → 2 steps
    expect(r.ladder).toBe(292);
    expect(r.current).toBeCloseTo(160 - 15 * (800 / 1609.344));
  });
  it(">1.5 mi: threshold reps drive the ladder, speed reps don't", () => {
    let t = st(r3);
    const slowSpeed = logA(r3, t, 200, 480); // speed reps way off, threshold on target
    t = next(t, apply(r3, t, slowSpeed));
    expect(t.run!.streak).toBe(1);
    const r = apply(r3, t, logA(r3, t, 200, 480));
    expect(r.ladder).toBe(465);
    expect(r.current).toBeCloseTo(1440 - 7.5 * 3);
  });
  it("skipped / Zone 2 cards don't change the ladder", () => {
    const t = st(r800, { streak: 1 });
    expect(apply(r800, t, logA(r800, t, 40), true).streak).toBe(1);
    const z = runWeek(r800, t)[1];
    expect(applyRunResult(r800, t, z, [{ minutes: 25, pace: 470 }], false, DAY).streak).toBe(1);
  });
});

describe("non-step paces", () => {
  it("threshold logged faster than planned (all reps) → personal adjustment for future cards", () => {
    const t = st(r800);
    const r = apply(r800, t, logA(r800, t, 40, 398)); // planned 6:44 (404)
    expect(r.adjust.threshold).toBe(398 - thresholdFormula(r800, 160));
    expect(runPaces(r800, r).threshold).toBe(398);
  });
  it("slower than planned → plan holds", () => {
    const t = st(r800);
    expect(apply(r800, t, logA(r800, t, 40, 410)).adjust).toEqual({});
  });
  it("a missing rep → no adjustment", () => {
    const t = st(r800);
    const sets = logA(r800, t, 40, 398);
    sets[sets.length - 1] = {};
    expect(apply(r800, t, sets).adjust).toEqual({});
  });
  it("adjustment rides on the formula, so it follows CURRENT", () => {
    const r = { ...initRunState(r800), adjust: { threshold: -6 }, current: 150 };
    expect(runPaces(r800, r).threshold).toBe(thresholdFormula(r800, 150) - 6);
  });
  it(">1.5 mi speed reps logged faster → speed adjustment (split → pace)", () => {
    const t = st(r3);
    const r = apply(r3, t, logA(r3, t, 108, 480)); // planned 1:52 for 400m
    expect(r.adjust.speed).toBe(Math.round(108 / (400 / 1609.344)) - 449);
  });
  it("deload Session A adjusts non-step paces but doesn't count toward the ladder", () => {
    const t = st(r800, { streak: 1 }, 4);
    const a = runWeek(r800, t)[2];
    const sets = a.sets!.map((p) => (p.part === "speed" ? { time: 36 } : { pace: 398 }));
    const r = applyRunResult(r800, t, a, sets, false, DAY);
    expect(r).toMatchObject({ ladder: 322, streak: 1 });
    expect(r.adjust.threshold).toBeDefined();
  });
});

describe("time trial", () => {
  const tt = (t: TrainingState, time: number) => applyRunResult(r800, t, trial(r800, t), [{ time }], false, DAY);
  it("sets CURRENT either way and is recorded", () => {
    const t = st(r800, { current: 153 }, 4);
    const r = tt(t, 155);
    expect(r.current).toBe(155);
    expect(r.trials).toEqual([{ date: "2026-11-02", time: 155, cycle: 1 }]);
  });
  it("faster than CURRENT counts +1 toward a step", () => {
    expect(tt(st(r800, {}, 4), 158).streak).toBe(1);
  });
  it("completes a step when the counter was at 1 (ladder only; CURRENT = trial time)", () => {
    const r = tt(st(r800, { streak: 1 }, 4), 158);
    expect(r).toMatchObject({ ladder: 307, streak: 0, current: 158 });
  });
  it("slower than CURRENT restarts the counter", () => {
    expect(tt(st(r800, { streak: 1, current: 153 }, 4), 155).streak).toBe(0);
  });
  it("no time logged → no change", () => {
    const t = st(r800, { streak: 1 }, 4);
    expect(applyRunResult(r800, t, trial(r800, t), [{}], false, DAY)).toEqual(t.run);
  });
});

describe("CURRENT and est. completion", () => {
  it("currentValue = CURRENT race time, whole seconds", () => {
    expect(currentValue(r800, st(r800, { current: 156.27 }))).toBe(156);
  });
  it("default rate before 2 weeks of data: 3.75 s/mi per week → 800M 2:40 → 2:30 in 6 weeks", () => {
    expect(runWeeksToTarget(r800, st(r800), 160, new Date("2026-11-01T12:00:00Z"))).toBe(6);
    const d = estCompletionDate(r800, st(r800), [], new Date("2026-11-01T12:00:00Z"))!;
    expect(d.toISOString().slice(0, 10)).toBe("2026-12-13");
  });
  it("observed rate after 2+ weeks: 5 s over 4 weeks, 5 s left → 4 weeks", () => {
    const t = st(r800, { current: 155, points: [
      { date: "2026-11-01T12:00:00.000Z", current: 160 },
      { date: "2026-11-29T12:00:00.000Z", current: 155 },
    ] });
    expect(runWeeksToTarget(r800, t, 155, new Date("2026-11-29T12:00:00Z"))).toBe(4);
  });
  it("not improving → falls back to the default rate", () => {
    const t = st(r800, { points: [
      { date: "2026-11-01T12:00:00.000Z", current: 160 },
      { date: "2026-11-29T12:00:00.000Z", current: 162 },
    ] });
    expect(runWeeksToTarget(r800, t, 162, new Date("2026-11-29T12:00:00Z"))).toBe(7);
  });
  it("at or under target → 0 (REACHED)", () => {
    expect(runWeeksToTarget(r800, st(r800), 150)).toBe(0);
    expect(estCompletionDate(r800, st(r800, { current: 149 }))).toBeNull();
  });
});

describe("F23 helpers", () => {
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
  it("runSessionTitle matches the card order", () => {
    expect([0, 1, 2].map((i) => runSessionTitle(r800, 2, i)))
      .toEqual(["Session A — Speed + Threshold", "Session B — Zone 2", "Session A — Speed + Threshold"]);
    expect(runSessionTitle(r3, 4, 0)).toBe("Session A — Time Trial");
    expect(runSessionTitle(r3, 4, 2)).toBe("Session A — Threshold + Speed");
  });
});
