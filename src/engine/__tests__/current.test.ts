import { applyCalisthenicsResult, calisthenicsWeek, initCalState } from "../calisthenics";
import { currentValue, estCompletionDate } from "../progression";
import type { CalisthenicsState, SessionLog, SetActual, Standard, TrainingState } from "../types";

// F16 — CURRENT only rises within a cycle and resets at cycle end; est. date anchored to the plan week.

const std = (type: Standard["type"], category: Standard["category"], start: number, target: number): Standard => ({
  id: "s", type, category, start, target, createdAt: "2026-10-01T12:00:00.000Z", status: "active",
});
const bench = std("bench", "lifts", 200, 300);
const oly = std("olympic", "olympic", 150, 200);
const pu = std("pushups", "calisthenics", 50, 60);

const bar = (trainingMax: number, week: 1 | 2 | 3 | 4, cycle = 1): TrainingState => ({ standardId: "s", trainingMax, cycle, week });
const log = (cycle: number, week: number, sessionIndex: number, sets?: SetActual[], completedAt = "2026-10-05T18:00:00.000Z"): SessionLog => ({
  id: `${cycle}-${week}-${sessionIndex}`, standardId: "s", cycle, week, sessionIndex, completedAt, sets,
});
const top = (weight: number, reps: number): SetActual[] => [{ weight: 100, reps: 5 }, { weight: 120, reps: 5 }, { weight, reps }];

describe("lifts CURRENT", () => {
  // TM 180 → CURRENT 200
  it("starts at TM / 0.9", () => {
    expect(currentValue(bench, bar(180, 2), [])).toBe(200);
  });
  it("rises mid-cycle from a strong week 2 AMRAP (160 × 10 → e1RM 213 → 215)", () => {
    expect(currentValue(bench, bar(180, 3), [log(1, 2, 0, top(160, 10))])).toBe(215);
  });
  it("a weak later set doesn't pull it down", () => {
    const logs = [log(1, 2, 0, top(160, 10)), log(1, 3, 0, top(170, 1))];
    expect(currentValue(bench, bar(180, 4), logs)).toBe(215);
  });
  it("never drops below TM / 0.9 on a weak set", () => {
    expect(currentValue(bench, bar(180, 3), [log(1, 2, 0, top(160, 3))])).toBe(200);
  });
  it("ignores week 1, the deload, BBB and skipped logs", () => {
    const logs = [
      log(1, 1, 0, top(155, 15)),
      log(1, 4, 0, top(110, 20)),
      log(1, 2, 1, [{ weight: 200, reps: 10 }]),
      { ...log(1, 3, 0, top(170, 12)), skipped: true },
    ];
    expect(currentValue(bench, bar(180, 4), logs)).toBe(200);
  });
  it("resets at cycle end to the new TM", () => {
    const logs = [log(1, 2, 0, top(160, 10)), log(1, 3, 0, top(170, 8))];
    expect(currentValue(bench, bar(185, 1, 2), logs)).toBe(205);
  });
});

describe("olympic CURRENT", () => {
  // TM 135 → CURRENT 150
  it("capped triples can't beat TM / 0.9 (week 3: 130 × 3 → e1RM 143)", () => {
    expect(currentValue(oly, bar(135, 4), [log(1, 3, 0, top(130, 3))])).toBe(150);
  });
  it("same generic rule: a heavier logged top set raises it, week 1 ignored", () => {
    expect(currentValue(oly, bar(135, 3), [log(1, 1, 0, top(160, 3)), log(1, 2, 0, top(150, 3))])).toBe(165);
  });
  it("resets at cycle end", () => {
    expect(currentValue(oly, bar(140, 1, 2), [log(1, 2, 0, top(150, 3))])).toBe(155);
  });
});

describe("push-ups CURRENT", () => {
  const st = (cal: Partial<CalisthenicsState>, cycle = 1, week: 1 | 2 | 3 | 4 = 1): TrainingState => ({
    standardId: "s", trainingMax: 0, cycle, week, cal: { ...initCalState(50, 15), ...cal },
  });
  const amrap = (t: TrainingState, reps: number) => {
    const session = calisthenicsWeek(t).find((s) => s.kind === "endurance")!;
    return { ...t, cal: applyCalisthenicsResult(t, session, [{ reps }]) };
  };

  it("rises with a new best AMRAP and ignores a weaker one later in the cycle", () => {
    let t = st({}, 1, 1);
    t = amrap(t, 55);
    t = amrap({ ...t, week: 2 }, 51);
    expect(t.cal!.max).toBe(51);
    expect(currentValue(pu, t)).toBe(55);
  });
  it("resets at cycle end to the new cycle's first AMRAP", () => {
    const amraps = [{ date: "a", reps: 55, cycle: 1 }, { date: "b", reps: 50, cycle: 2 }];
    expect(currentValue(pu, st({ max: 50, best: 55, amraps }, 2))).toBe(50);
  });
  it("before this cycle's first AMRAP (or with pre-F16 entries) it's the latest max", () => {
    expect(currentValue(pu, st({ max: 48, best: 55, amraps: [{ date: "a", reps: 55, cycle: 1 }] }, 2))).toBe(48);
    expect(currentValue(pu, st({ max: 48, best: 55, amraps: [{ date: "a", reps: 55 }] }))).toBe(48);
  });
});

describe("estimated completion date is anchored to the plan week", () => {
  const weekStart = new Date(2026, 9, 26, 18, 0); // week 1 finished Mon Oct 26 → week 2 started
  const day = (n: number) => new Date(weekStart.getTime() + n * 86400000);
  const week1 = [log(1, 1, 0, top(140, 8), weekStart.toISOString()), log(1, 1, 1, undefined, weekStart.toISOString())];

  it("lifts: same date every day of the week", () => {
    const t = bar(180, 2);
    const tue = estCompletionDate(bench, t, week1, day(1))!;
    const sun = estCompletionDate(bench, t, week1, day(6))!;
    expect(sun.getTime()).toBe(tue.getTime());
    // 18 waves → 3 + 17×4 = 71 weeks from the week start
    expect(Math.round((tue.getTime() - weekStart.getTime()) / 86400000)).toBe(497);
  });
  it("lifts: a higher CURRENT (implied TM) brings it earlier", () => {
    const t = bar(180, 3);
    const logs = [...week1, log(1, 2, 0, top(160, 3), day(3).toISOString()), log(1, 2, 1, undefined, day(3).toISOString())];
    const before = estCompletionDate(bench, t, logs, day(4))!;
    const after = estCompletionDate(bench, t, [...logs.slice(0, 2), log(1, 2, 0, top(160, 10), day(3).toISOString()), logs[3]], day(4))!;
    expect(after.getTime()).toBeLessThan(before.getTime());
  });
  it("falling behind (week overdue) pushes it later", () => {
    const t = bar(180, 2);
    const onTime = estCompletionDate(bench, t, week1, day(3))!;
    const late = estCompletionDate(bench, t, week1, day(10))!;
    expect(late.getTime()).toBeGreaterThan(onTime.getTime());
  });
  it("olympic: same date every day of the week", () => {
    const t = bar(135, 2);
    expect(estCompletionDate(oly, t, week1, day(0.5))!.getTime()).toBe(estCompletionDate(oly, t, week1, day(6))!.getTime());
  });
  it("push-ups: stable across the week, and logging an on-pace AMRAP doesn't move it", () => {
    const amraps = [{ date: "a", reps: 50, cycle: 1 }, { date: "b", reps: 52, cycle: 1 }];
    const t: TrainingState = {
      standardId: "s", trainingMax: 0, cycle: 1, week: 3,
      cal: { ...initCalState(50, 15), max: 52, best: 52, amraps },
    };
    const logs = [log(1, 2, 2, undefined, weekStart.toISOString())];
    const mon = estCompletionDate(pu, t, logs, day(0.5))!;
    expect(estCompletionDate(pu, t, logs, day(2))!.getTime()).toBe(mon.getTime());
    const session = calisthenicsWeek(t).find((s) => s.kind === "endurance")!;
    const afterAmrap = { ...t, cal: applyCalisthenicsResult(t, session, [{ reps: 54 }], false, day(3)) };
    expect(estCompletionDate(pu, afterAmrap, logs, day(4))!.getTime()).toBe(mon.getTime());
  });
});
