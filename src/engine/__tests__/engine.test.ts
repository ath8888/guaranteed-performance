import { roundLb, estimate1RM } from "../shared";
import { liftWeek } from "../strength";
import { ENGINES } from "../registry";
import { initTrainingMax, wendlerNextTM, wavesToTarget, etaDate } from "../progression";
import type { Standard } from "../types";

const bench: Standard = {
  id: "1",
  type: "bench",
  category: "lifts",
  start: 200,
  target: 300,
  desiredCompletionDate: "2027-01-01",
  createdAt: "2026-01-01",
  status: "active",
};

const squat: Standard = {
  id: "2",
  type: "squat",
  category: "lifts",
  start: 300,
  target: 400,
  desiredCompletionDate: "2027-01-01",
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
  it("returns 0 when already at target", () => {
    const done = { ...bench, start: 300 };
    expect(wavesToTarget(done, 300)).toBe(0);
  });
  it("returns 0 when above target", () => {
    expect(wavesToTarget(bench, 350)).toBe(0);
  });
  it("calculates waves needed for bench (5lb/wave)", () => {
    // bench at 200, target 300 → 100lb gap / 5 per wave = 20 waves
    expect(wavesToTarget(bench, 200)).toBe(20);
  });
  it("calculates waves needed for squat (10lb/wave)", () => {
    // squat at 300, target 400 → 100lb gap / 10 per wave = 10 waves
    expect(wavesToTarget(squat, 300)).toBe(10);
  });
});

describe("etaDate", () => {
  it("returns null when target already met", () => {
    expect(etaDate(bench, 300, new Date("2026-01-01"))).toBeNull();
  });
  it("returns a future date proportional to waves", () => {
    const from = new Date("2026-01-01");
    const eta = etaDate(bench, 200, from); // 20 waves × 28 days = 560 days
    expect(eta).not.toBeNull();
    const diffDays = Math.round((eta!.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(560);
  });
});
