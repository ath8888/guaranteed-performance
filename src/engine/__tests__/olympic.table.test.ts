// One test per row and per example in decision-tables/olympic-lifts.md (v0.6)
import { olympicWeek, olympicCurrentAtCycleEnd } from "../olympic";
import { liftTM } from "../strength";
import { initTrainingMax, cycleEndTM, currentValue } from "../progression";
import type { SessionLog, Standard, TrainingState } from "../types";

const oly: Standard = { id: "o1", type: "olympic", name: "Power Clean", category: "olympic", start: 150, target: 200, createdAt: "2026-01-01", status: "active" };
const state = (current: number): TrainingState => ({ standardId: "o1", trainingMax: liftTM(current), current, cycle: 1, week: 4 });
const topSet = (week: number, reps: number, extra: Partial<SessionLog> = {}): SessionLog => ({
  id: `w${week}`, standardId: "o1", cycle: 1, week, sessionIndex: 0, completedAt: "2026-01-01",
  sets: [{ weight: 100, reps: 3 }, { weight: 115, reps: 3 }, { weight: 130, reps }], ...extra,
});
const end = (logs: SessionLog[], current = 150) => olympicCurrentAtCycleEnd(current, logs, 1);
const sets = (w: 1 | 2 | 3 | 4, tm: number) => olympicWeek(w, tm)[0].sets!;
const loads = (w: 1 | 2 | 3 | 4, tm: number) => sets(w, tm).map((s) => `${s.weight}x${s.reps}`);

describe("Core rule — CURRENT is the source of truth", () => {
  it("TM = 90% of CURRENT, rounded", () => { expect(liftTM(150)).toBe(135); expect(liftTM(155)).toBe(140); });
  it("CURRENT shown is the stored CURRENT", () => { expect(currentValue(oly, state(165))).toBe(165); });
  it("old states without CURRENT fall back to TM ÷ 0.9", () => {
    expect(currentValue(oly, { standardId: "o1", trainingMax: 135, cycle: 1, week: 1 })).toBe(150);
  });
});

describe("O1 — starting CURRENT", () => {
  it("O1-R1: CURRENT = START, TM = 90% of START", () => { expect(initTrainingMax(oly)).toBe(135); });
});

describe("O2 — weekly prescription", () => {
  it("O2-R1: week 1 65/75/85 × 3", () => { expect(loads(1, 200)).toEqual(["130x3", "150x3", "170x3"]); });
  it("O2-R2: week 2 70/80/90 × 3", () => { expect(loads(2, 200)).toEqual(["140x3", "160x3", "180x3"]); });
  it("O2-R3: week 3 75/85/95 × 3", () => { expect(loads(3, 200)).toEqual(["150x3", "170x3", "190x3"]); });
  it("O2-R4: week 4 40/50/60 × 3, nothing logged", () => {
    expect(loads(4, 200)).toEqual(["80x3", "100x3", "120x3"]);
    expect(sets(4, 200).some((s) => s.amrap)).toBe(false);
  });
  it("one session per week, main lift only", () => {
    for (const w of [1, 2, 3, 4] as const) expect(olympicWeek(w, 200)).toHaveLength(1);
  });
});

describe("O3 — CURRENT at cycle end", () => {
  it("O3-R1: week 3 top set not logged (or skipped) → unchanged", () => {
    expect(end([topSet(1, 3), topSet(2, 3)])).toBe(150);
    expect(end([topSet(3, 3, { skipped: true })])).toBe(150);
  });
  it("O3-R2: any logged top set under 3, including 0 → unchanged", () => {
    expect(end([topSet(3, 0)])).toBe(150);
    expect(end([topSet(3, 1)])).toBe(150);
    expect(end([topSet(3, 2)])).toBe(150);
    expect(end([topSet(1, 2), topSet(2, 3), topSet(3, 3)])).toBe(150);
    expect(end([topSet(1, 3), topSet(2, 0), topSet(3, 3)])).toBe(150);
  });
  it("O3-R3: every logged top set = 3 → +5", () => { expect(end([topSet(1, 3), topSet(2, 3), topSet(3, 3)])).toBe(155); });
  it("O3 note: a missing week 1 or 2 log is not a miss", () => { expect(end([topSet(3, 3)])).toBe(155); });
  it("only this cycle's logs count", () => { expect(end([topSet(3, 3, { cycle: 0 })])).toBe(150); });
  it("engine cycleEndTM = 90% of the new CURRENT", () => { expect(cycleEndTM(oly, state(150), [topSet(3, 3)])).toBe(140); });
});

describe("Examples", () => {
  it("E1: week 3 at TM 135 → 100, 115, 130 × 3", () => { expect(loads(3, 135)).toEqual(["100x3", "115x3", "130x3"]); });
  it("E2: 3 reps → CURRENT 155, TM 140", () => {
    const c = end([topSet(3, 3)]);
    expect([c, liftTM(c)]).toEqual([155, 140]);
  });
  it("E3: a week 2 miss blocks progress", () => { expect(end([topSet(1, 3), topSet(2, 2), topSet(3, 3)])).toBe(150); });
  it("E4: 2 reps → CURRENT stays 150", () => { expect(end([topSet(3, 2)])).toBe(150); });
  it("E5: 0 reps → no reset, CURRENT stays 150", () => { expect(end([topSet(3, 0)])).toBe(150); });
  it("E6: no set allows more than 3 reps", () => {
    for (const w of [1, 2, 3, 4] as const) for (const s of sets(w, 200)) expect(s.maxReps ?? s.reps).toBeLessThanOrEqual(3);
  });
  it("E7: CURRENT 175 → 180 keeps TM at 160", () => {
    const c = end([topSet(3, 3)], 175);
    expect([liftTM(175), c, liftTM(c)]).toEqual([160, 180, 160]);
  });
});
