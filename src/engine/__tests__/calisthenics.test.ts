import {
  CALISTHENICS_CONFIG,
  applyCalisthenicsResult,
  backoffRecommended,
  backoffReps,
  backoffSetCount,
  calisthenicsWeek,
  calisthenicsWeeksToTarget,
  cardLock,
  initCalState,
  isStalled,
  migrateCalState,
} from "../calisthenics";
import { ENGINES } from "../registry";
import { currentValue, estCompletionDate, isWeekComplete } from "../progression";
import type { CalisthenicsState, SessionLog, Standard, TrainingState } from "../types";

const pu: Standard = {
  id: "p1",
  type: "pushups",
  category: "calisthenics",
  start: 50,
  target: 60,
  createdAt: "2026-01-01",
  status: "active",
};

const st = (cal: Partial<CalisthenicsState> = {}, week: 1 | 2 | 3 | 4 = 1, cycle = 1): TrainingState => ({
  standardId: "p1",
  trainingMax: 0,
  cycle,
  week,
  cal: { ...initCalState(50, 35), ...cal },
});

const MON_6PM = new Date(2026, 9, 26, 18, 0); // Mon Oct 26, local
const THU_6PM = new Date(2026, 9, 29, 18, 0);
const card = (t: TrainingState, kind: string) => calisthenicsWeek(t).find((s) => s.kind === kind)!;
const apply = (t: TrainingState, kind: string, sets?: { weight?: number; reps?: number }[], skipped = false, today = MON_6PM) =>
  applyCalisthenicsResult(t, card(t, kind), sets, skipped, today);

describe("setup", () => {
  it("pushups use the calisthenics engine", () => {
    const t = st();
    expect(ENGINES.pushups.buildWeek(pu, t)).toEqual(calisthenicsWeek(t));
  });
  it("initial state: max and best = Start, chosen vest load, no stalls or history", () => {
    expect(initCalState(50, 35)).toEqual({ max: 50, best: 50, load: 35, stallCount: 0, amraps: [] });
  });
  it("tuning values live in the config object", () => {
    expect(CALISTHENICS_CONFIG).toMatchObject({ addLoadAbove: 8, loadStep: 5, backoffPct: 0.4, backoffSets: 2 });
  });
});

describe("weekly plan", () => {
  it("3 cards: Strength (day A), Endurance AMRAP + Back-off sets (day B)", () => {
    expect(calisthenicsWeek(st()).map((s) => `${s.sessionNo}:${s.kind}`))
      .toEqual(["0:strength", "1:endurance", "1:backoff"]);
  });
  it("same 3 cards every week — no week 4 retest", () => {
    expect(calisthenicsWeek(st({}, 4)).map((s) => s.kind)).toEqual(["strength", "endurance", "backoff"]);
  });
  it("strength: 1 vest set to failure, always Recommended", () => {
    const s = card(st(), "strength");
    expect(s.sets).toEqual([{ weight: 35, reps: 8, amrap: true }]);
    expect(s.lines[0]).toBe("35 lb vest × max reps (to failure)");
    expect(s).toMatchObject({ recommended: true, optional: false });
  });
  it("endurance: 1 bodyweight AMRAP, always Recommended", () => {
    const e = card(st({ best: 52 }), "endurance");
    expect(e.sets).toHaveLength(1);
    expect(e.sets![0].amrap).toBe(true);
    expect(e.sets![0].maxReps).toBeUndefined();
    expect(e.lines[0]).toBe("1 set to failure · best 52");
    expect(e).toMatchObject({ recommended: true, optional: false });
  });
  it("back-off: 2 sets at 40% of today's AMRAP, Optional by default", () => {
    const b = card(st({ max: 48, amrapWeek: "1-1" }), "backoff");
    expect(b.sets).toHaveLength(2);
    expect(b.sets!.every((x) => x.reps === 19 && x.maxReps === 19)).toBe(true); // round(48 × 0.4)
    expect(b.lines[0]).toBe("2 × 19 push-ups (40% of today)");
    expect(b).toMatchObject({ recommended: false, optional: true });
  });
  it("back-off line is generic until today's AMRAP is logged", () => {
    expect(card(st({ amrapWeek: "1-0" }), "backoff").lines[0]).toBe("2 × 40% of today's max");
  });
  it("40% rounds and never drops below 1 rep", () => {
    expect(backoffReps(50)).toBe(20);
    expect(backoffReps(1)).toBe(1);
  });
});

describe("strength day", () => {
  it("more than 8 reps → +5 lb", () => {
    expect(apply(st(), "strength", [{ weight: 35, reps: 9 }]).load).toBe(40);
  });
  it("exactly 8 reps → same load", () => {
    expect(apply(st(), "strength", [{ weight: 35, reps: 8 }]).load).toBe(35);
  });
  it("under 5 reps → hold", () => {
    expect(apply(st(), "strength", [{ weight: 35, reps: 3 }]).load).toBe(35);
  });
  it("edited load is kept, and progresses from there", () => {
    expect(apply(st(), "strength", [{ weight: 40, reps: 6 }]).load).toBe(40);
    expect(apply(st(), "strength", [{ weight: 40, reps: 10 }]).load).toBe(45);
  });
  it("records reps; no rest-day lock (calisthenics.md v0.3)", () => {
    const c = apply(st(), "strength", [{ weight: 35, reps: 7 }]);
    expect(c.lastStrengthReps).toBe(7);
    expect("nextOpensAt" in c).toBe(false);
  });
});

describe("endurance day AMRAP", () => {
  it("new best → becomes Current and best, stalls reset, logged with date", () => {
    const c = apply(st({ stallCount: 3 }), "endurance", [{ reps: 52 }], false, THU_6PM);
    expect(c).toMatchObject({ max: 52, best: 52, stallCount: 0, amrapWeek: "1-1" });
    expect(c.amraps).toEqual([{ date: THU_6PM.toISOString().slice(0, 10), reps: 52, cycle: 1 }]);
  });
  it("no new best → stall +1; Current still shows today's number", () => {
    const c = apply(st(), "endurance", [{ reps: 48 }]);
    expect(c).toMatchObject({ max: 48, best: 50, stallCount: 1 });
  });
  it("equal to best is not an improvement", () => {
    expect(apply(st(), "endurance", [{ reps: 50 }]).stallCount).toBe(1);
  });
  it("an off week after a great week counts against the best, not last week", () => {
    const c = apply(st({ max: 45, best: 55 }), "endurance", [{ reps: 50 }]);
    expect(c.stallCount).toBe(1);
  });
});

describe("back-off sets", () => {
  it("logging or skipping changes nothing (no rest-day lock)", () => {
    const t = st({ stallCount: 1 });
    expect(apply(t, "backoff", [{ reps: 20 }, { reps: 20 }], false, THU_6PM)).toEqual(t.cal);
    expect(apply(t, "backoff", undefined, true, THU_6PM)).toEqual(t.cal);
  });
});

describe("stall levers: volume first", () => {
  it("0–1 stalls: 2 Optional back-off sets", () => {
    for (const stallCount of [0, 1]) {
      const c = st({ stallCount }).cal!;
      expect([backoffRecommended(c), backoffSetCount(c)]).toEqual([false, 2]);
    }
  });
  it("2 weeks without a new best: back-off sets become Recommended (no SKIP)", () => {
    const b = card(st({ stallCount: 2 }), "backoff");
    expect(b).toMatchObject({ recommended: true, optional: false });
    expect(b.sets).toHaveLength(2);
  });
  it("4 weeks: a 3rd back-off set", () => {
    expect(card(st({ stallCount: 4 }), "backoff").sets).toHaveLength(3);
  });
  it("a new best resets back to 2 Optional sets", () => {
    const t = st({ stallCount: 4 });
    const c = apply(t, "endurance", [{ reps: 51 }]);
    expect([backoffRecommended(c), backoffSetCount(c)]).toEqual([false, 2]);
  });
  it("'Stalled' note once stalls continue past both levers", () => {
    expect(isStalled(st({ stallCount: 5 }).cal!)).toBe(false);
    expect(isStalled(st({ stallCount: 6 }).cal!)).toBe(true);
  });
});

describe("card order (cardLock), no rest days", () => {
  const logged = (...done: number[]) => (i: number) => done.includes(i);
  it("a card waits for every earlier card", () => {
    expect(cardLock(logged(), 1)).toEqual({});
    expect(cardLock(logged(0), 2)).toEqual({});
  });
  it("a card opens as soon as the earlier cards are logged", () => {
    expect(cardLock(logged(), 0)).toBeNull();
    expect(cardLock(logged(0), 1)).toBeNull();
    expect(cardLock(logged(0, 1), 2)).toBeNull();
  });
});

describe("estimated completion", () => {
  it("reached → 0 weeks, no date", () => {
    expect(calisthenicsWeeksToTarget(pu, st({ max: 60, best: 60 }))).toBe(0);
    expect(estCompletionDate(pu, st({ max: 60, best: 60 }))).toBeNull();
  });
  it("fewer than 2 AMRAPs: +5% per 4 weeks (50 → 60 ≈ 15 weeks)", () => {
    expect(calisthenicsWeeksToTarget(pu, st())).toBe(15);
  });
  it("2+ AMRAPs: average weekly gain (50, 52, 54 → +2/week; 54 → 60 = 3 weeks)", () => {
    const amraps = [50, 52, 54].map((reps, i) => ({ date: `d${i}`, reps }));
    expect(calisthenicsWeeksToTarget(pu, st({ max: 54, best: 54, amraps }))).toBe(3);
  });
  it("not improving → falls back to +5% per 4 weeks", () => {
    const amraps = [50, 50].map((reps, i) => ({ date: `d${i}`, reps }));
    expect(calisthenicsWeeksToTarget(pu, st({ amraps }))).toBe(15);
  });
  it("estCompletionDate uses the push-up estimate", () => {
    const from = new Date("2026-01-01");
    const d = estCompletionDate(pu, st(), [], from)!;
    expect(Math.round((d.getTime() - from.getTime()) / 86400000)).toBe(105);
  });
});

describe("upgrading saved state from the old formula", () => {
  const old = (week: 1 | 2 | 3 | 4, cycle = 1): TrainingState => ({
    standardId: "p1", trainingMax: 0, cycle, week,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cal: {
      max: 40, load: 10, lastStrengthReps: 7, enduranceReps: 20, enduranceStreak: 1,
      endurancePending: false, stallCount: 3, retests: [{ date: "2026-10-01", max: 40 }],
    } as any,
  });
  it("keeps max, vest load, last reps and test history; resets stalls", () => {
    expect(migrateCalState(old(2))!.cal).toEqual({
      max: 40, best: 40, load: 10, lastStrengthReps: 7, stallCount: 0,
      amraps: [{ date: "2026-10-01", reps: 40 }],
    });
  });
  it("starts a fresh week so old logs don't mark new cards done", () => {
    expect(migrateCalState(old(2))).toMatchObject({ cycle: 1, week: 3 });
    expect(migrateCalState(old(4))).toMatchObject({ cycle: 2, week: 1 });
  });
  it("leaves already-upgraded and barbell state alone", () => {
    expect(migrateCalState(st())).toBeNull();
    expect(migrateCalState({ standardId: "b", trainingMax: 180, cycle: 1, week: 1 })).toBeNull();
  });
});

describe("shared helpers", () => {
  it("cards are named Session A / Session B, strength first", () => {
    expect(calisthenicsWeek(st()).map((s) => s.title)).toEqual([
      "Session A — Strength", "Session B — Endurance", "Session B — Endurance",
    ]);
  });
  it("a new program starts with a 15 lb vest", () => {
    expect(CALISTHENICS_CONFIG.startLoad).toBe(15);
  });
  it("currentValue: stored CURRENT (highest AMRAP) for push-ups, est. 1RM for barbell lifts", () => {
    expect(currentValue(pu, st({ max: 47, best: 52 }))).toBe(52);
    const bench: Standard = { ...pu, id: "b", type: "bench", category: "lifts", start: 200, target: 300 };
    expect(currentValue(bench, { standardId: "b", trainingMax: 180, cycle: 1, week: 1 })).toBe(200);
  });
  it("isWeekComplete: all 3 cards logged or skipped", () => {
    const log = (i: number, skipped = false): SessionLog => ({
      id: `${i}`, standardId: "p1", cycle: 1, week: 1, sessionIndex: i, completedAt: "x", ...(skipped ? { skipped } : {}),
    });
    expect(isWeekComplete(pu, st(), [log(0), log(1)])).toBe(false);
    expect(isWeekComplete(pu, st(), [log(0), log(1), log(2, true)])).toBe(true);
  });
});
