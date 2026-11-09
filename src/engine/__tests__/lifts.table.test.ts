// One test per row and per example in decision-tables/lifts.md
import { currentAfterTopSet, currentAtCycleEnd, liftTM, liftWeek } from "../strength";
import { initTrainingMax, cycleEndTM } from "../progression";
import { roundLb } from "../shared";
import type { SessionLog, Standard, StandardType, TrainingState } from "../types";

const std = (type: StandardType, start = 300): Standard => ({
  id: type, type, category: "lifts", start, target: start + 100, createdAt: "2026-01-01", status: "active",
});
const topSet = (week: number, reps: number, extra: Partial<SessionLog> = {}): SessionLog => ({
  id: `w${week}`, standardId: "x", cycle: 1, week, sessionIndex: 0, completedAt: "2026-01-01",
  sets: [{ weight: 100, reps: 5 }, { weight: 110, reps: 5 }, { weight: 120, reps }], ...extra,
});
const main = (week: 1 | 2 | 3 | 4, tm: number) =>
  liftWeek(week, tm)[0].sets!.map((s) => `${s.weight}x${s.reps}${s.amrap ? "+" : ""}`);

describe("Shared definitions", () => {
  it("rounding: nearest 5 lb", () => { expect(roundLb(186.55)).toBe(185); expect(roundLb(188)).toBe(190); });
  it("rounding: exact halves round up, even with float noise", () => {
    expect(roundLb(67.5)).toBe(70);
    expect(roundLb(175 * 0.7)).toBe(125);
  });
  it("TM = 90% of CURRENT, rounded", () => { expect(liftTM(333)).toBe(300); expect(liftTM(360)).toBe(325); });
});

describe("L1 — starting CURRENT", () => {
  it("L1-R1: CURRENT = START, TM = 90% of it", () => {
    expect(initTrainingMax(std("bench", 200))).toBe(180);
    expect(initTrainingMax(std("squat", 287))).toBe(260);
  });
});

describe("L2 — main-lift weekly prescription", () => {
  it("L2-R1: week 1 65/75/85 × 5, 5, 5+", () => { expect(main(1, 300)).toEqual(["195x5", "225x5", "255x5+"]); });
  it("L2-R2: week 2 70/80/90 × 3, 3, 3+", () => { expect(main(2, 300)).toEqual(["210x3", "240x3", "270x3+"]); });
  it("L2-R3: week 3 75/85/95 × 5, 3, 1+", () => { expect(main(3, 300)).toEqual(["225x5", "255x3", "285x1+"]); });
  it("L2-R4: week 4 40/50/60 × 5, no + set", () => { expect(main(4, 300)).toEqual(["120x5", "150x5", "180x5"]); });
});

describe("L3 — supplemental work (BBB)", () => {
  it("L3-R1: weeks 1–3 → 5 × 10 at 50% of TM", () => {
    for (const w of [1, 2, 3] as const) {
      const bbb = liftWeek(w, 300)[1];
      expect(bbb.kind).toBe("bbb");
      expect(bbb.sets!.map((s) => `${s.weight}x${s.reps}`)).toEqual(Array(5).fill("150x10"));
    }
  });
  it("L3-R2: week 4 → no supplemental work", () => { expect(liftWeek(4, 300)).toHaveLength(1); });
});

describe("L4 — CURRENT after a + set", () => {
  it("L4-R1: reps below the week's minimum → CURRENT × 0.90", () => {
    expect(currentAfterTopSet(330, 1, 255, 4)).toBe(295);
    expect(currentAfterTopSet(330, 2, 270, 2)).toBe(295);
    expect(currentAfterTopSet(330, 3, 285, 0)).toBe(295);
  });
  it("L4-R2: estimate above CURRENT → CURRENT = estimate", () => {
    expect(currentAfterTopSet(335, 3, 285, 8)).toBe(360); // 285 × 1.267 = 361
  });
  it("L4-R3: estimate at or below CURRENT → unchanged", () => {
    expect(currentAfterTopSet(335, 3, 285, 1)).toBe(335);
  });
  it("reps above 10 count as 10", () => {
    expect(currentAfterTopSet(300, 1, 255, 15)).toBe(currentAfterTopSet(300, 1, 255, 10));
    expect(currentAfterTopSet(300, 1, 255, 10)).toBe(340); // 255 × 1.333
  });
  it("deload week sets never move CURRENT", () => { expect(currentAfterTopSet(300, 4, 180, 20)).toBe(300); });
});

describe("L5 — CURRENT at cycle end", () => {
  const end = (type: StandardType, logs: SessionLog[]) => currentAtCycleEnd(std(type), 300, logs, 1);
  it("L5-R1: week 3 + set not logged (or skipped) → unchanged", () => {
    expect(end("squat", [topSet(1, 5), topSet(2, 3)])).toBe(300);
    expect(end("squat", [topSet(3, 1, { skipped: true })])).toBe(300);
  });
  it("L5-R2: week 3 + set missed (0 reps) → unchanged", () => { expect(end("ohp", [topSet(3, 0)])).toBe(300); });
  it("L5-R3: squat → +10", () => { expect(end("squat", [topSet(3, 1)])).toBe(310); });
  it("L5-R4: deadlift → +10", () => { expect(end("deadlift", [topSet(3, 1)])).toBe(310); });
  it("L5-R5: bench → +5", () => { expect(end("bench", [topSet(3, 1)])).toBe(305); });
  it("L5-R6: overhead press → +5", () => { expect(end("ohp", [topSet(3, 1)])).toBe(305); });
  it("only this cycle's week 3 counts", () => { expect(end("squat", [topSet(3, 1, { cycle: 0 })])).toBe(300); });
  it("engine cycleEndTM = 90% of the new CURRENT", () => {
    const t: TrainingState = { standardId: "x", trainingMax: 300, current: 335, cycle: 1, week: 4 };
    expect(cycleEndTM(std("squat"), t, [topSet(3, 3)])).toBe(310); // 345 × 0.9 = 310.5
  });
});

describe("Examples", () => {
  it("E1: week 3 squat at TM 300 → 225×5, 255×3, 285×1+", () => { expect(main(3, 300)).toEqual(["225x5", "255x3", "285x1+"]); });
  it("E2: big AMRAP raises CURRENT and TM at once", () => {
    const c = currentAfterTopSet(335, 3, 285, 8);
    expect([c, liftTM(c)]).toEqual([360, 325]);
  });
  it("E3: a miss cuts CURRENT 10% at once", () => {
    const c = currentAfterTopSet(335, 3, 285, 0);
    expect([c, liftTM(c)]).toEqual([300, 270]);
  });
  it("E4: deadlift TM 287, week 1 set 1 → 185", () => { expect(liftWeek(1, 287)[0].sets![0].weight).toBe(185); });
  it("E5: OHP TM 135, week 4 set 2 → 70", () => { expect(liftWeek(4, 135)[0].sets![1].weight).toBe(70); });
  it("E6: cycle end adds +5 on bench after week 3 is logged", () => {
    expect(currentAtCycleEnd(std("bench"), 225, [topSet(3, 2)], 1)).toBe(230);
  });
  it("E7: week 4 has no BBB", () => { expect(liftWeek(4, 300).some((s) => s.kind === "bbb")).toBe(false); });
  it("E8: a week 3 miss cuts CURRENT and blocks the cycle-end increase", () => {
    const c = currentAfterTopSet(335, 3, 285, 0);
    expect([c, currentAtCycleEnd(std("squat"), c, [topSet(3, 0)], 1)]).toEqual([300, 300]);
  });
});
