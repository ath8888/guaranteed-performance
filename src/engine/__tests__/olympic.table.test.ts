// One test per row and per example in decision-tables/olympic-lifts.md
import { olympicWeek } from "../olympic";
import { initTrainingMax, cycleEndTM } from "../progression";
import type { SessionLog, Standard, TrainingState } from "../types";

const oly: Standard = { id: "o1", type: "olympic", name: "Power Clean", category: "olympic", start: 150, target: 200, createdAt: "2026-01-01", status: "active" };
const state = (tm: number): TrainingState => ({ standardId: "o1", trainingMax: tm, cycle: 1, week: 4 });
const topSet = (week: number, reps: number): SessionLog => ({
  id: `w${week}`, standardId: "o1", cycle: 1, week, sessionIndex: 0, completedAt: "2026-01-01",
  sets: [{ weight: 100, reps: 3 }, { weight: 115, reps: 3 }, { weight: 130, reps }],
});
const sets = (w: 1 | 2 | 3 | 4, tm: number) => olympicWeek(w, tm)[0].sets!;
const loads = (w: 1 | 2 | 3 | 4, tm: number) => sets(w, tm).map((s) => `${s.weight}x${s.reps}`);

describe("O1 — set the training max", () => {
  it("O1-R1: 90% of 1RM, rounded", () => { expect(initTrainingMax(oly)).toBe(135); });
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

describe("O3 — end-of-cycle progression", () => {
  it("O3-R1: week 3 not logged → hold", () => { expect(cycleEndTM(oly, state(135), [topSet(1, 3), topSet(2, 3)])).toBe(135); });
  it("O3-R2: 0 reps → TM × 0.90", () => { expect(cycleEndTM(oly, state(135), [topSet(3, 0)])).toBe(120); });
  it("O3-R3: any logged top set under 3 → hold", () => {
    expect(cycleEndTM(oly, state(135), [topSet(3, 1)])).toBe(135);
    expect(cycleEndTM(oly, state(135), [topSet(3, 2)])).toBe(135);
    expect(cycleEndTM(oly, state(135), [topSet(1, 2), topSet(2, 3), topSet(3, 3)])).toBe(135);
    expect(cycleEndTM(oly, state(135), [topSet(1, 3), topSet(2, 0), topSet(3, 3)])).toBe(135);
  });
  it("O3-R4: every logged top set = 3 → +5", () => {
    expect(cycleEndTM(oly, state(135), [topSet(1, 3), topSet(2, 3), topSet(3, 3)])).toBe(140);
  });
  it("O3 note: a missing week 1 or 2 log is not a miss", () => { expect(cycleEndTM(oly, state(135), [topSet(3, 3)])).toBe(140); });
});

describe("Examples", () => {
  it("E1: week 3 at TM 135 → 100, 115, 130 × 3", () => { expect(loads(3, 135)).toEqual(["100x3", "115x3", "130x3"]); });
  it("E2: 3 reps → 140", () => { expect(cycleEndTM(oly, state(135), [topSet(3, 3)])).toBe(140); });
  it("E3: a week 2 miss blocks progress", () => { expect(cycleEndTM(oly, state(135), [topSet(1, 3), topSet(2, 2), topSet(3, 3)])).toBe(135); });
  it("E4: 2 reps → 135", () => { expect(cycleEndTM(oly, state(135), [topSet(3, 2)])).toBe(135); });
  it("E5: 0 reps → 120", () => { expect(cycleEndTM(oly, state(135), [topSet(3, 0)])).toBe(120); });
  it("E6: no set allows more than 3 reps", () => {
    for (const w of [1, 2, 3, 4] as const) for (const s of sets(w, 200)) expect(s.maxReps ?? s.reps).toBeLessThanOrEqual(3);
  });
});
