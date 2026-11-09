// One test per row and per example in decision-tables/calisthenics.md (v0.3)
import {
  CALISTHENICS_CONFIG, applyCalisthenicsResult, backoffRecommended, backoffSetCount, calisthenicsWeek,
  calisthenicsWeeksToTarget, cardLock, initCalState, isStalled,
} from "../calisthenics";
import { ENGINES } from "../registry";
import { currentValue } from "../progression";
import type { CalisthenicsState, SetActual, Standard, TrainingState } from "../types";

const pu: Standard = { id: "p", type: "pushups", category: "calisthenics", start: 50, target: 60, createdAt: "2026-11-02T12:00:00.000Z", status: "active" };
const st = (cal: Partial<CalisthenicsState> = {}, week: 1 | 2 | 3 | 4 = 1, cycle = 1): TrainingState => ({
  standardId: "p", trainingMax: 0, cycle, week, cal: { ...initCalState(50, 15), ...cal },
});
const card = (t: TrainingState, kind: "strength" | "endurance" | "backoff") => calisthenicsWeek(t).find((s) => s.kind === kind)!;
const apply = (t: TrainingState, kind: "strength" | "endurance" | "backoff", sets?: SetActual[], skipped = false) =>
  applyCalisthenicsResult(t, card(t, kind), sets, skipped);
const logged = (...done: number[]) => (i: number) => done.includes(i);

describe("C1 — starting state", () => {
  it("C1-R1: CURRENT = Max = START, vest 15 lb, stall 0", () => {
    const t: TrainingState = { standardId: "p", trainingMax: 0, cycle: 1, week: 1, cal: initCalState(pu.start, CALISTHENICS_CONFIG.startLoad) };
    expect(t.cal).toMatchObject({ best: 50, max: 50, load: 15, stallCount: 0 });
    expect(currentValue(pu, t)).toBe(50);
  });
});

describe("C2 — weekly cards (same every week)", () => {
  it("C2-R1: card 1 = Day A, vest load × to failure", () => {
    expect(calisthenicsWeek(st({ load: 20 }))[0]).toMatchObject({ kind: "strength", sets: [{ weight: 20, amrap: true }] });
  });
  it("C2-R2: card 2 = Day B AMRAP, bodyweight, shows CURRENT", () => {
    const c = calisthenicsWeek(st({ best: 55 }))[1];
    expect(c).toMatchObject({ kind: "endurance", sets: [{ reps: 55, amrap: true }] });
    expect(c.sets![0].weight).toBeUndefined();
  });
  it("C2-R3: card 3 = back-off sets × 40% of today's AMRAP, at least 1, capped", () => {
    expect(calisthenicsWeek(st({ max: 48 }))[2].sets).toEqual([{ reps: 19, amrap: true, maxReps: 19 }, { reps: 19, amrap: true, maxReps: 19 }]);
    expect(calisthenicsWeek(st({ max: 1 }))[2].sets![0].reps).toBe(1);
  });
  it("weeks 1–4 build the same cards", () => {
    for (const w of [2, 3, 4] as const) expect(calisthenicsWeek(st({}, w))).toEqual(calisthenicsWeek(st({}, 1)));
  });
  it("cards go in order, no rest days", () => {
    expect(cardLock(logged(), 1)).toEqual({});
    expect(cardLock(logged(0), 1)).toBeNull();
  });
});

describe("C3 — vest load after Day A", () => {
  it("C3-R1: skipped → unchanged", () => { expect(apply(st({ load: 30 }), "strength", undefined, true).load).toBe(30); });
  it("C3-R2: above 8 reps → load used + 5", () => { expect(apply(st(), "strength", [{ weight: 25, reps: 9 }]).load).toBe(30); });
  it("C3-R3: 8 or fewer → load used", () => {
    expect(apply(st(), "strength", [{ weight: 25, reps: 8 }]).load).toBe(25);
    expect(apply(st(), "strength", [{ weight: 25, reps: 3 }]).load).toBe(25);
  });
  it("Day A never changes CURRENT, Max or the stall count", () => {
    const c = apply(st({ stallCount: 2 }), "strength", [{ weight: 15, reps: 80 }]);
    expect(c).toMatchObject({ best: 50, max: 50, stallCount: 2 });
  });
});

describe("C4 — after the Day B AMRAP", () => {
  it("C4-R1: skipped → nothing changes", () => {
    const t = st({ stallCount: 1 });
    expect(apply(t, "endurance", undefined, true)).toEqual(t.cal);
  });
  it("C4-R2: above CURRENT → CURRENT = Max = reps, stall 0", () => {
    expect(apply(st({ stallCount: 3 }), "endurance", [{ reps: 51 }])).toMatchObject({ best: 51, max: 51, stallCount: 0 });
  });
  it("C4-R3: equal or below → CURRENT unchanged, stall + 1, Max = reps", () => {
    expect(apply(st(), "endurance", [{ reps: 50 }])).toMatchObject({ best: 50, max: 50, stallCount: 1 });
    expect(apply(st(), "endurance", [{ reps: 30 }])).toMatchObject({ best: 50, max: 30, stallCount: 1 });
  });
});

describe("C5 — back-off sets by stall count", () => {
  const lever = (stallCount: number) => {
    const c = st({ stallCount }).cal!;
    return [backoffSetCount(c), backoffRecommended(c) ? "Recommended" : "Optional", isStalled(c)];
  };
  it("C5-R1: 0–1 → 2, Optional", () => { for (const n of [0, 1]) expect(lever(n)).toEqual([2, "Optional", false]); });
  it("C5-R2: 2–3 → 2, Recommended", () => { for (const n of [2, 3]) expect(lever(n)).toEqual([2, "Recommended", false]); });
  it("C5-R3: 4–5 → 3, Recommended", () => { for (const n of [4, 5]) expect(lever(n)).toEqual([3, "Recommended", false]); });
  it("C5-R4: 6+ → 3, Recommended, STALLED", () => { for (const n of [6, 9]) expect(lever(n)).toEqual([3, "Recommended", true]); });
  it("back-off sets never change CURRENT, Max or the vest load", () => {
    const t = st({ max: 45 });
    expect(apply(t, "backoff", [{ reps: 18 }, { reps: 18 }])).toEqual(t.cal);
  });
});

describe("C7 — CURRENT", () => {
  it("C7-R1: the stored CURRENT, no reset at cycle end", () => {
    const amraps = [{ date: "a", reps: 55, cycle: 1 }, { date: "b", reps: 51, cycle: 1 }];
    expect(currentValue(pu, st({ best: 55, max: 51, amraps }, 1, 2))).toBe(55);
  });
});

describe("C8 — weeks to target", () => {
  it("C8-R1: CURRENT at or above target → 0", () => { expect(calisthenicsWeeksToTarget(pu, st({ best: 60 }))).toBe(0); });
  it("C8-R2: 2+ AMRAPs, gain above 0 → (target − CURRENT) ÷ average gain", () => {
    const amraps = [50, 52, 54].map((reps, i) => ({ date: `d${i}`, reps }));
    expect(calisthenicsWeeksToTarget(pu, st({ best: 54, max: 54, amraps }))).toBe(3);
  });
  it("C8-R3: otherwise → +5% per 4 weeks, compounding (50 → 60 = 15 weeks)", () => {
    expect(calisthenicsWeeksToTarget(pu, st())).toBe(15);
    const flat = [50, 50].map((reps, i) => ({ date: `d${i}`, reps }));
    expect(calisthenicsWeeksToTarget(pu, st({ amraps: flat }))).toBe(15);
  });
  it("this week's AMRAP already logged → +1 week", () => {
    const t = st();
    const done = { ...t, cal: { ...t.cal!, amrapWeek: "1-1" } };
    expect(ENGINES.pushups.estWeeksToTarget!(pu, done, 50)).toBe(ENGINES.pushups.estWeeksToTarget!(pu, t, 50) + 1);
  });
});

describe("Examples", () => {
  it("E1: 15 lb vest, 9 reps → 20 lb", () => { expect(apply(st({ load: 15 }), "strength", [{ weight: 15, reps: 9 }]).load).toBe(20); });
  it("E2: changed to 20 lb, 6 reps → 20 lb", () => { expect(apply(st({ load: 15 }), "strength", [{ weight: 20, reps: 6 }]).load).toBe(20); });
  it("E3: CURRENT 50, stall 3, AMRAP 52 → CURRENT and Max 52, stall 0", () => {
    expect(apply(st({ stallCount: 3 }), "endurance", [{ reps: 52 }])).toMatchObject({ best: 52, max: 52, stallCount: 0 });
  });
  it("E4: CURRENT 50, stall 1, AMRAP 48 → stall 2, back-offs 2 × 19 Recommended", () => {
    const t = st({ stallCount: 1 });
    const cal = apply(t, "endurance", [{ reps: 48 }]);
    expect(cal).toMatchObject({ best: 50, max: 48, stallCount: 2 });
    expect(card({ ...t, cal }, "backoff")).toMatchObject({ recommended: true, sets: [{ reps: 19 }, { reps: 19 }] });
  });
  it("E5: Day A logged → Day B AMRAP open the same day", () => { expect(cardLock(logged(0), 1)).toBeNull(); });
  it("E6: CURRENT 55, last AMRAP 51 → still 55 in the next cycle", () => {
    expect(currentValue(pu, st({ best: 55, max: 51 }, 1, 2))).toBe(55);
  });
  it("E7: CURRENT 50, 60 reps on Day A → CURRENT 50, vest + 5", () => {
    const cal = apply(st({ load: 15 }), "strength", [{ weight: 15, reps: 60 }]);
    expect([currentValue(pu, { ...st(), cal }), cal.load]).toEqual([50, 20]);
  });
});
