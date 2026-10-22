import {
  CALISTHENICS_CONFIG,
  applyCalisthenicsResult,
  calisthenicsWeek,
  calisthenicsWeeksToTarget,
  enduranceSetCount,
  initCalState,
  nextWorkoutDate,
  restDaysBetween,
  isStalled,
  sessionsPerWeek,
  tierFor,
} from "../calisthenics";
import { ENGINES } from "../registry";
import { currentValue, estCompletionDate, isWeekComplete } from "../progression";
import type { CalisthenicsState, SessionLog, Standard, TrainingState } from "../types";

const pu: Standard = {
  id: "p1",
  type: "pushups",
  category: "calisthenics",
  start: 20,
  target: 50,
  createdAt: "2026-01-01",
  status: "active",
};

const st = (cal: Partial<CalisthenicsState> & { max: number }, week: 1 | 2 | 3 | 4 = 1, cycle = 1): TrainingState => ({
  standardId: "p1",
  trainingMax: 0,
  cycle,
  week,
  cal: { ...initCalState(cal.max, 10), ...cal },
});

const week = (t: TrainingState) => calisthenicsWeek(t);
const strengthOf = (t: TrainingState, n = 0) => week(t).filter((s) => s.kind === "strength")[n];
const enduranceOf = (t: TrainingState, n = 0) => week(t).filter((s) => s.kind === "endurance")[n];
const reps = (n: number, count: number) => Array.from({ length: count }, () => ({ reps: n }));

describe("registration and setup", () => {
  it("pushups use the calisthenics engine", () => {
    const t = st({ max: 20 });
    expect(ENGINES.pushups.buildWeek(pu, t)).toEqual(calisthenicsWeek(t));
  });
  it("initial state: endurance at 50% of max, chosen vest load, no streaks or stalls", () => {
    expect(initCalState(20, 10)).toEqual({
      max: 20, load: 10, enduranceReps: 10, enduranceStreak: 0, endurancePending: false, stallCount: 0, retests: [],
    });
  });
  it("50% rounds and never drops below 1 rep", () => {
    expect(initCalState(25, 0).enduranceReps).toBe(13);
    expect(initCalState(1, 0).enduranceReps).toBe(1);
  });
  it("thresholds come from the config object", () => {
    expect(CALISTHENICS_CONFIG.strengthFocusBelow).toBe(30);
    expect(CALISTHENICS_CONFIG.enduranceFocusAbove).toBe(60);
    expect(tierFor(40, { ...CALISTHENICS_CONFIG, strengthFocusBelow: 45 })).toBe("strength");
  });
});

describe("weekly plan", () => {
  it("2 workouts/week, strength block always before endurance", () => {
    expect(week(st({ max: 40 })).map((s) => `${s.sessionNo}:${s.kind}`))
      .toEqual(["0:strength", "0:endurance", "1:strength", "1:endurance"]);
  });
  it("strength block: 1 set at the vest load, 5–8 reps to failure, logs reps", () => {
    const s = strengthOf(st({ max: 40, load: 15 }));
    expect(s.sets).toEqual([{ weight: 15, reps: 5, amrap: true }]);
    expect(s.lines[0]).toBe("15 lb vest × 5–8 (to failure)");
  });
  it("endurance block: 3 sets at the current endurance reps, each set logged and capped", () => {
    const e = enduranceOf(st({ max: 40 }));
    expect(e.sets).toHaveLength(3);
    expect(e.sets!.every((x) => x.reps === 20 && x.maxReps === 20 && x.amrap)).toBe(true);
  });
  it("week 4 is a single retest card", () => {
    const w = week(st({ max: 40 }, 4));
    expect(w).toHaveLength(1);
    expect(w[0].kind).toBe("retest");
    expect(w[0].sets![0].amrap).toBe(true);
  });
});

describe("Recommended / Optional tiers", () => {
  it("under 30: strength Recommended, endurance Optional", () => {
    const t = st({ max: 29 });
    expect(strengthOf(t)).toMatchObject({ recommended: true, optional: false });
    expect(enduranceOf(t)).toMatchObject({ recommended: false, optional: true });
  });
  it("30–60: both Recommended, neither Optional", () => {
    for (const max of [30, 45, 60]) {
      const t = st({ max });
      expect(strengthOf(t)).toMatchObject({ recommended: true, optional: false });
      expect(enduranceOf(t)).toMatchObject({ recommended: true, optional: false });
    }
  });
  it("over 60: strength Optional, endurance Recommended with 1 extra set", () => {
    const t = st({ max: 61 });
    expect(strengthOf(t)).toMatchObject({ recommended: false, optional: true });
    expect(enduranceOf(t)).toMatchObject({ recommended: true, optional: false });
    expect(enduranceOf(t).sets).toHaveLength(4);
  });
});

describe("strength double progression", () => {
  const t = st({ max: 40, load: 10 });
  const s = () => strengthOf(t);
  it("8 reps → +5 lb, prescription back to 5", () => {
    const c = applyCalisthenicsResult(t, s(), [{ weight: 10, reps: 8 }]);
    expect(c.load).toBe(15);
    expect(strengthOf({ ...t, cal: c }).sets![0]).toMatchObject({ weight: 15, reps: 5 });
  });
  it("more than 8 also advances", () => {
    expect(applyCalisthenicsResult(t, s(), [{ weight: 10, reps: 11 }]).load).toBe(15);
  });
  it("5–7 reps → same load", () => {
    const c = applyCalisthenicsResult(t, s(), [{ weight: 10, reps: 7 }]);
    expect(c.load).toBe(10);
    expect(c.lastStrengthReps).toBe(7);
  });
  it("under 5 reps → hold the load", () => {
    expect(applyCalisthenicsResult(t, s(), [{ weight: 10, reps: 3 }]).load).toBe(10);
  });
  it("edited load is kept going forward", () => {
    expect(applyCalisthenicsResult(t, s(), [{ weight: 20, reps: 6 }]).load).toBe(20);
  });
  it("edited load + 8 reps → edited load + 5", () => {
    expect(applyCalisthenicsResult(t, s(), [{ weight: 20, reps: 8 }]).load).toBe(25);
  });
  it("over 60 (maintenance): load never increases", () => {
    const hi = st({ max: 65, load: 10 });
    expect(applyCalisthenicsResult(hi, strengthOf(hi), [{ weight: 10, reps: 8 }]).load).toBe(10);
  });
  it("skipped strength changes nothing", () => {
    expect(applyCalisthenicsResult(t, s(), undefined, true)).toEqual(t.cal);
  });
});

describe("endurance double progression", () => {
  // max 40 → 20 reps × 3 sets
  const t = st({ max: 40 });
  const e = (tt: TrainingState, n = 0) => enduranceOf(tt, n);
  it("1 clean session → streak 1, reps unchanged", () => {
    const c = applyCalisthenicsResult(t, e(t), reps(20, 3));
    expect(c).toMatchObject({ enduranceStreak: 1, enduranceReps: 20 });
  });
  it("2 clean sessions in a row → +2 reps per set, streak resets", () => {
    const c1 = applyCalisthenicsResult(t, e(t, 0), reps(20, 3));
    const t2 = { ...t, cal: c1 };
    const c2 = applyCalisthenicsResult(t2, e(t2, 1), reps(20, 3));
    expect(c2).toMatchObject({ enduranceStreak: 0, enduranceReps: 22 });
    expect(e({ ...t, cal: c2 }).sets!.every((x) => x.reps === 22)).toBe(true);
  });
  it("a failed set breaks the streak", () => {
    const c1 = applyCalisthenicsResult(t, e(t), reps(20, 3));
    const t2 = { ...t, cal: c1 };
    const c2 = applyCalisthenicsResult(t2, e(t2, 1), [{ reps: 20 }, { reps: 20 }, { reps: 17 }]);
    expect(c2).toMatchObject({ enduranceStreak: 0, enduranceReps: 20 });
  });
  it("missing sets is not clean", () => {
    expect(applyCalisthenicsResult(t, e(t), reps(20, 2)).enduranceStreak).toBe(0);
  });
  it("skipped endurance keeps the streak", () => {
    const tt = st({ max: 40, enduranceStreak: 1 });
    expect(applyCalisthenicsResult(tt, e(tt), undefined, true).enduranceStreak).toBe(1);
  });
});

describe("load and endurance reps never advance in the same workout", () => {
  it("strength advanced in Session A → endurance earned in A is deferred, streak kept", () => {
    const t = st({ max: 40, load: 10, enduranceStreak: 1 });
    const afterStrength = applyCalisthenicsResult(t, strengthOf(t, 0), [{ weight: 10, reps: 8 }]);
    const tA = { ...t, cal: afterStrength };
    const c = applyCalisthenicsResult(tA, enduranceOf(tA, 0), reps(20, 3));
    expect(c).toMatchObject({ load: 15, enduranceReps: 20, endurancePending: true, enduranceStreak: 2 });
  });
  it("deferred +2 applies in the next workout", () => {
    const t = st({ max: 40, load: 15, endurancePending: true, enduranceStreak: 2, strengthAdvancedAt: "1-1-0" });
    const c = applyCalisthenicsResult(t, enduranceOf(t, 1), reps(20, 3));
    expect(c).toMatchObject({ enduranceReps: 22, endurancePending: false, enduranceStreak: 0 });
  });
  it("still waits if the load advanced again in that next workout", () => {
    const t = st({ max: 40, load: 20, endurancePending: true, enduranceStreak: 2, strengthAdvancedAt: "1-1-1" });
    const c = applyCalisthenicsResult(t, enduranceOf(t, 1), reps(20, 3));
    expect(c).toMatchObject({ enduranceReps: 20, endurancePending: true });
  });
  it("endurance alone (no load increase that workout) advances normally", () => {
    const t = st({ max: 40, enduranceStreak: 1, strengthAdvancedAt: "1-1-0" });
    expect(applyCalisthenicsResult(t, enduranceOf(t, 1), reps(20, 3)).enduranceReps).toBe(22);
  });
});

describe("retest (week 4)", () => {
  const retest = (t: TrainingState) => week(t)[0];
  const today = new Date("2026-02-01");
  it("improvement: new max, endurance reset to 50%, streaks cleared, logged", () => {
    const t = st({ max: 20, enduranceReps: 16, enduranceStreak: 1, endurancePending: true }, 4);
    const c = applyCalisthenicsResult(t, retest(t), [{ reps: 25 }], false, today);
    expect(c).toMatchObject({
      max: 25, enduranceReps: 13, enduranceStreak: 0, endurancePending: false, stallCount: 0,
      retests: [{ date: "2026-02-01", max: 25 }],
    });
  });
  it("no improvement → stall count +1 (same or lower max)", () => {
    const t = st({ max: 20, stallCount: 1 }, 4);
    expect(applyCalisthenicsResult(t, retest(t), [{ reps: 20 }]).stallCount).toBe(2);
    expect(applyCalisthenicsResult(t, retest(t), [{ reps: 18 }]).stallCount).toBe(2);
  });
  it("improvement resets the levers back to 3 sets and 2 workouts/week", () => {
    const t = st({ max: 40, stallCount: 4 }, 4);
    const c = applyCalisthenicsResult(t, retest(t), [{ reps: 42 }]);
    expect(c.stallCount).toBe(0);
    expect(enduranceSetCount(c)).toBe(3);
    expect(sessionsPerWeek(c)).toBe(2);
  });
});

describe("stall levers: volume first", () => {
  it("1 stall: nothing changes", () => {
    const c = st({ max: 40, stallCount: 1 }).cal!;
    expect([enduranceSetCount(c), sessionsPerWeek(c)]).toEqual([3, 2]);
  });
  it("2 stalls in a row: +1 endurance set", () => {
    const c = st({ max: 40, stallCount: 2 }).cal!;
    expect([enduranceSetCount(c), sessionsPerWeek(c)]).toEqual([4, 2]);
    expect(enduranceOf(st({ max: 40, stallCount: 2 })).sets).toHaveLength(4);
  });
  it("4 stalls: +1 set and a 3rd workout (6 cards)", () => {
    const t = st({ max: 40, stallCount: 4 });
    expect([enduranceSetCount(t.cal!), sessionsPerWeek(t.cal!)]).toEqual([4, 3]);
    expect(week(t).map((s) => s.title)).toEqual([
      "Session A — Strength", "Session A — Endurance",
      "Session B — Strength", "Session B — Endurance",
      "Session C — Strength", "Session C — Endurance",
    ]);
  });
  it("over 60 extra set stacks with the lever", () => {
    expect(enduranceSetCount(st({ max: 70, stallCount: 2 }).cal!)).toBe(5);
  });
  it("'Stalled' note only after both levers are in use and stalls continue", () => {
    expect(isStalled(st({ max: 40, stallCount: 5 }).cal!)).toBe(false);
    expect(isStalled(st({ max: 40, stallCount: 6 }).cal!)).toBe(true);
  });
});

describe("workout spacing", () => {
  const mon6pm = new Date(2026, 9, 19, 18, 0).toISOString(); // Mon Oct 19, 6pm local
  it("2 workouts/week: 2 full rest days (Mon → Thu)", () => {
    expect(restDaysBetween(st({ max: 40 }).cal!)).toBe(2);
    expect(nextWorkoutDate([mon6pm], 2)).toEqual(new Date(2026, 9, 22));
  });
  it("3 workouts/week: 1 full rest day (Mon → Wed)", () => {
    expect(restDaysBetween(st({ max: 40, stallCount: 4 }).cal!)).toBe(1);
    expect(nextWorkoutDate([mon6pm], 1)).toEqual(new Date(2026, 9, 21));
  });
  it("counts from the later of the previous workout's two cards", () => {
    const tue7am = new Date(2026, 9, 20, 7, 0).toISOString();
    expect(nextWorkoutDate([mon6pm, tue7am], 2)).toEqual(new Date(2026, 9, 23));
  });
});

describe("estimated completion", () => {
  it("reached → 0 weeks, no date", () => {
    const t = st({ max: 50 });
    expect(calisthenicsWeeksToTarget(pu, t)).toBe(0);
    expect(estCompletionDate(pu, t)).toBeNull();
  });
  it("fewer than 2 retests: +10% of max per cycle (20 → 50 = 10 cycles → 40 weeks)", () => {
    expect(calisthenicsWeeksToTarget(pu, st({ max: 20 }))).toBe(40);
  });
  it("2+ retests: average gain between retests (24 → 28 = +4/cycle; 28 → 50 = 6 cycles)", () => {
    const t = st({ max: 28, retests: [{ date: "a", max: 24 }, { date: "b", max: 28 }] });
    expect(calisthenicsWeeksToTarget(pu, t)).toBe(24);
  });
  it("retests not improving → falls back to +10% per cycle", () => {
    const t = st({ max: 28, retests: [{ date: "a", max: 28 }, { date: "b", max: 28 }] }, 2);
    // ln(50/28)/ln(1.1) = 6.08 → 7 cycles; week 2 → 3 + 6×4 = 27
    expect(calisthenicsWeeksToTarget(pu, t)).toBe(27);
  });
  it("estCompletionDate uses the calisthenics estimate", () => {
    const from = new Date("2026-01-01");
    const d = estCompletionDate(pu, st({ max: 20 }), from)!;
    expect(Math.round((d.getTime() - from.getTime()) / 86400000)).toBe(280);
  });
});

describe("shared helpers", () => {
  it("currentValue: max reps for push-ups, est. 1RM for barbell lifts", () => {
    expect(currentValue(pu, st({ max: 33 }))).toBe(33);
    const bench: Standard = { ...pu, id: "b", type: "bench", category: "lifts", start: 200, target: 300 };
    expect(currentValue(bench, { standardId: "b", trainingMax: 180, cycle: 1, week: 1 })).toBe(200);
    expect(currentValue(pu, null)).toBe(20);
  });
  it("isWeekComplete: every card logged or skipped", () => {
    const t = st({ max: 40 });
    const log = (i: number, skipped = false): SessionLog => ({
      id: `${i}`, standardId: "p1", cycle: 1, week: 1, sessionIndex: i, completedAt: "x", ...(skipped ? { skipped } : {}),
    });
    expect(isWeekComplete(pu, t, [log(0), log(1), log(2)])).toBe(false);
    expect(isWeekComplete(pu, t, [log(0), log(1), log(2), log(3, true)])).toBe(true);
  });
});
