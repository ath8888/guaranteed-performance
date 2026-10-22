import { roundLb, estimate1RM } from "../shared";
import { liftWeek } from "../strength";
import { ENGINES } from "../registry";
import { initTrainingMax, wendlerNextTM, wavesToTarget, estCompletionDate } from "../progression";
import type { Standard } from "../types";

const bench: Standard = {
  id: "1",
  type: "bench",
  category: "lifts",
  start: 200,
  target: 300,
  createdAt: "2026-01-01",
  status: "active",
};

const squat: Standard = {
  id: "2",
  type: "squat",
  category: "lifts",
  start: 300,
  target: 400,
  createdAt: "2026-01-01",
  status: "active",
};

describe("roundLb", () => {
  it("rounds to nearest 5", () => {
    expect(roundLb(133)).toBe(135);
    expect(roundLb(131)).toBe(130);
    expect(roundLb(100)).toBe(100);
  });
});

describe("estimate1RM", () => {
  it("returns weight when reps is 1", () => {
    expect(estimate1RM(225, 1)).toBe(225);
  });
  it("estimates higher for more reps", () => {
    expect(estimate1RM(200, 5)).toBeGreaterThan(200);
  });
});

describe("initTrainingMax", () => {
  it("sets TM to 90% of start, rounded to 5", () => {
    expect(initTrainingMax(bench)).toBe(180); // 200 * 0.9 = 180
    expect(initTrainingMax(squat)).toBe(270); // 300 * 0.9 = 270
  });
});

describe("liftWeek", () => {
  it("week 1 produces main + BBB sessions", () => {
    const sessions = liftWeek(1, 200);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].kind).toBe("main");
    expect(sessions[1].kind).toBe("bbb");
  });

  it("week 1 main sets are 65/75/85% of TM", () => {
    const sessions = liftWeek(1, 200);
    const sets = sessions[0].sets!;
    expect(sets[0].weight).toBe(roundLb(200 * 0.65)); // 130
    expect(sets[1].weight).toBe(roundLb(200 * 0.75)); // 150
    expect(sets[2].weight).toBe(roundLb(200 * 0.85)); // 170
  });

  it("last set of week 1 is AMRAP", () => {
    const sessions = liftWeek(1, 200);
    expect(sessions[0].sets![2].amrap).toBe(true);
  });

  it("week 4 (deload) produces only main session", () => {
    const sessions = liftWeek(4, 200);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].title).toContain("Deload");
  });

  it("week 4 main sets are NOT amrap", () => {
    const sessions = liftWeek(4, 200);
    const sets = sessions[0].sets!;
    sets.forEach(s => expect(s.amrap).toBeFalsy());
  });

  it("BBB is 5x10 at 50% TM", () => {
    const sessions = liftWeek(1, 200);
    const bbb = sessions[1].sets!;
    expect(bbb).toHaveLength(5);
    bbb.forEach(s => {
      expect(s.reps).toBe(10);
      expect(s.weight).toBe(100); // 200 * 0.5
    });
  });
});

describe("wendlerNextTM", () => {
  it("bench: +5 lb when amrap > 1", () => {
    expect(wendlerNextTM(bench, 180, 5)).toBe(185);
  });
  it("squat: +10 lb when amrap > 1", () => {
    expect(wendlerNextTM(squat, 270, 5)).toBe(280);
  });
  it("no progress when amrap = 1", () => {
    expect(wendlerNextTM(bench, 180, 1)).toBe(180);
  });
  it("resets TM to 90% when amrap = 0", () => {
    expect(wendlerNextTM(bench, 180, 0)).toBe(160); // roundLb(180 * 0.9) = roundLb(162) = 160
  });
});

describe("wavesToTarget", () => {
  it("returns 0 when current 1RM (TM / 0.9) reaches target", () => {
    // bench target 300 → TM 270 → est 1RM 300
    expect(wavesToTarget(bench, 270)).toBe(0);
  });
  it("returns 0 when above target", () => {
    expect(wavesToTarget(bench, 300)).toBe(0);
  });
  it("calculates TM increases needed for bench (5lb/wave)", () => {
    // TM 180, target TM 270 → 90 / 5 = 18 waves
    expect(wavesToTarget(bench, 180)).toBe(18);
  });
  it("calculates TM increases needed for squat (10lb/wave)", () => {
    // TM 270, target TM 360 → 90 / 10 = 9 waves
    expect(wavesToTarget(squat, 270)).toBe(9);
  });
  it("needs at least 1 wave when just short of target", () => {
    // TM 266 → est 1RM 295 < 300; gap to 270 is 4lb → 1 wave
    expect(wavesToTarget(bench, 266)).toBe(1);
  });
});

describe("estCompletionDate", () => {
  const from = new Date("2026-01-01");
  const daysFrom = (d: Date) => Math.round((d.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  const state = (trainingMax: number, week: 1 | 2 | 3 | 4) => ({ standardId: "x", trainingMax, cycle: 1, week });

  it("returns null when target already met", () => {
    expect(estCompletionDate(bench, state(270, 2), from)).toBeNull();
  });
  it("bench at week 1: finish this cycle + 4 weeks per further wave", () => {
    // 18 waves → 4 + 17×4 = 72 weeks = 504 days
    expect(daysFrom(estCompletionDate(bench, state(180, 1), from)!)).toBe(504);
  });
  it("squat mid-cycle (week 3) counts only the weeks left in this cycle", () => {
    // 9 waves → 2 + 8×4 = 34 weeks = 238 days
    expect(daysFrom(estCompletionDate(squat, state(270, 3), from)!)).toBe(238);
  });
  it("last wave during deload week completes in 1 week", () => {
    // TM 265 → 1 wave; week 4 → 1 week = 7 days
    expect(daysFrom(estCompletionDate(bench, state(265, 4), from)!)).toBe(7);
  });
});
