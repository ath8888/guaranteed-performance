import { olympicWeek } from "../olympic";
import { liftWeek } from "../strength";
import { ENGINES } from "../registry";
import { initTrainingMax, wendlerNextTM, wavesToTarget, estCompletionDate, cycleEndTM } from "../progression";
import type { Standard } from "../types";

// 1RM 150 → TM 135
const oly: Standard = {
  id: "o1",
  type: "olympic",
  name: "Clean & Press",
  category: "olympic",
  start: 150,
  target: 200,
  createdAt: "2026-01-01",
  status: "active",
};

const TM = 135;
const weights = (w: 1 | 2 | 3 | 4) => olympicWeek(w, TM)[0].sets!.map((s) => s.weight);

describe("olympic engine registration", () => {
  it("olympic type uses the olympic engine", () => {
    expect(ENGINES.olympic.buildWeek(oly, { standardId: "o1", trainingMax: TM, cycle: 1, week: 1 }))
      .toEqual(olympicWeek(1, TM));
  });
  it("training max is 90% of 1RM", () => {
    expect(initTrainingMax(oly)).toBe(135);
  });
});

describe("olympicWeek main sets (% of TM, all × 3)", () => {
  it("week 1: 65/75/85", () => {
    expect(weights(1)).toEqual([90, 100, 115]);
  });
  it("week 2: 70/80/90", () => {
    expect(weights(2)).toEqual([95, 110, 120]);
  });
  it("week 3: 75/85/95", () => {
    expect(weights(3)).toEqual([100, 115, 130]);
  });
  it("week 4 deload: 40/50/60, main only", () => {
    expect(weights(4)).toEqual([55, 70, 80]);
    expect(olympicWeek(4, TM)).toHaveLength(1);
  });
  it("every main set is 3 reps", () => {
    for (const w of [1, 2, 3, 4] as const) {
      expect(olympicWeek(w, TM)[0].sets!.every((s) => s.reps === 3)).toBe(true);
    }
  });
  it("set 3 logs reps (capped at 3) in weeks 1–3, not in deload", () => {
    for (const w of [1, 2, 3] as const) {
      const sets = olympicWeek(w, TM)[0].sets!;
      expect(sets.map((s) => !!s.amrap)).toEqual([false, false, true]);
      expect(sets[2].maxReps).toBe(3);
    }
    expect(olympicWeek(4, TM)[0].sets!.some((s) => s.amrap)).toBe(false);
  });
});

describe("FSL supplemental", () => {
  it("is optional 3 × 3 at the first-set weight", () => {
    for (const w of [1, 2, 3] as const) {
      const [main, fsl] = olympicWeek(w, TM);
      expect(fsl.kind).toBe("fsl");
      expect(fsl.optional).toBe(true);
      expect(fsl.sets).toHaveLength(3);
      expect(fsl.sets!.every((s) => s.reps === 3 && s.weight === main.sets![0].weight)).toBe(true);
    }
  });
});

describe("BBB is optional for strength lifts", () => {
  it("marks BBB optional, main not optional", () => {
    const [main, bbb] = liftWeek(1, 180);
    expect(main.optional).toBeUndefined();
    expect(bbb.optional).toBe(true);
  });
});

describe("olympic TM progression (week 3 top set reps)", () => {
  it("3 reps → +5 lb", () => {
    expect(wendlerNextTM(oly, TM, 3)).toBe(140);
  });
  it("1–2 reps → hold", () => {
    expect(wendlerNextTM(oly, TM, 2)).toBe(135);
    expect(wendlerNextTM(oly, TM, 1)).toBe(135);
  });
  it("0 reps → reset to 90%", () => {
    expect(wendlerNextTM(oly, TM, 0)).toBe(120);
  });
  it("no reps logged → hold", () => {
    expect(wendlerNextTM(oly, TM, undefined)).toBe(135);
  });
});

describe("cycleEndTM: week 3 set 3 decides next cycle", () => {
  const state = { standardId: "o1", trainingMax: TM, cycle: 2, week: 4 as const };
  // main-lift log with set 3 reps; other weeks deliberately disagree to prove only week 3 counts
  const mainLog = (cycle: number, week: number, set3Reps: number) => ({
    id: `${cycle}-${week}`, standardId: "o1", cycle, week, sessionIndex: 0, completedAt: "2026-01-01",
    sets: [{ weight: 100, reps: 3 }, { weight: 115, reps: 3 }, { weight: 130, reps: set3Reps }],
  });

  it("week 3 set 3 = 3 reps → +5, even if weeks 1–2 missed reps", () => {
    const logs = [mainLog(2, 1, 0), mainLog(2, 2, 1), mainLog(2, 3, 3)];
    expect(cycleEndTM(oly, state, logs)).toBe(140);
  });
  it("week 3 set 3 = 2 reps → hold, even if weeks 1–2 were perfect", () => {
    const logs = [mainLog(2, 1, 3), mainLog(2, 2, 3), mainLog(2, 3, 2)];
    expect(cycleEndTM(oly, state, logs)).toBe(135);
  });
  it("week 3 set 3 = 0 reps → reset to 90%", () => {
    expect(cycleEndTM(oly, state, [mainLog(2, 3, 0)])).toBe(120);
  });
  it("ignores week 3 logs from other cycles", () => {
    expect(cycleEndTM(oly, state, [mainLog(1, 3, 3)])).toBe(135);
  });
  it("FSL logs (session 1) don't count", () => {
    const fsl = { ...mainLog(2, 3, 3), sessionIndex: 1 };
    expect(cycleEndTM(oly, state, [fsl, mainLog(2, 3, 1)])).toBe(135);
  });
});

describe("olympic estimated completion", () => {
  it("waves at +5 lb per cycle", () => {
    // target TM 180, from 135 → 45 / 5 = 9
    expect(wavesToTarget(oly, TM)).toBe(9);
  });
  it("date: 4 + 8×4 = 36 weeks from week 1", () => {
    const from = new Date("2026-01-01");
    const d = estCompletionDate(oly, { standardId: "o1", trainingMax: TM, cycle: 1, week: 1 }, from)!;
    expect(Math.round((d.getTime() - from.getTime()) / 86400000)).toBe(252);
  });
});
