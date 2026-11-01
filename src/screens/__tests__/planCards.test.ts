import { buildCards } from "../PlanScreen";
import type { Standard, SessionLog, TrainingState } from "../../engine/types";
import { initCalState } from "../../engine/calisthenics";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const dl: Standard = {
  id: "dl-1", type: "deadlift", category: "lifts", start: 400, target: 500,
  createdAt: "2026-01-01", status: "active",
};
const state: TrainingState = { standardId: "dl-1", trainingMax: 360, cycle: 1, week: 2 };
const log = (sessionIndex: number, skipped = false): SessionLog => ({
  id: `${sessionIndex}`, standardId: "dl-1", cycle: 1, week: 1, sessionIndex, completedAt: "x",
  ...(skipped ? { skipped } : {}),
});

// BUG-1: a skipped card shows SKIPPED, not DONE.
describe("buildCards — skipped badge", () => {
  it("BBB logged as skipped shows skipped", () => {
    const [main, bbb] = buildCards(dl, state, [log(0), log(1, true)], 1);
    expect(main.skipped).toBe(false);
    expect(bbb).toMatchObject({ status: "done", skipped: true });
  });

  it("BBB skipped before skips were logged (no log) still shows skipped", () => {
    const [main, bbb] = buildCards(dl, state, [log(0)], 1);
    expect(main.skipped).toBe(false);
    expect(bbb).toMatchObject({ status: "done", skipped: true });
  });

  it("BBB completed shows done, not skipped", () => {
    const [, bbb] = buildCards(dl, state, [log(0), log(1)], 1);
    expect(bbb).toMatchObject({ status: "done", skipped: false });
  });

  it("current week's unlogged BBB is not skipped", () => {
    const [, bbb] = buildCards(dl, state, [], 2);
    expect(bbb.skipped).toBe(false);
  });
});

// BUG-2: a done card shows what was logged, not the prescription rebuilt from the current state.
describe("buildCards — done cards show logged sets", () => {
  const pu: Standard = {
    id: "p1", type: "pushups", category: "calisthenics", start: 50, target: 60,
    createdAt: "2026-01-01", status: "active",
  };
  const logged = (sessionIndex: number, sets: SessionLog["sets"], week = 1): SessionLog => ({
    id: `${sessionIndex}`, standardId: "p1", cycle: 1, week, sessionIndex, completedAt: "x", sets,
  });

  it("push-ups strength card shows the logged vest load and reps after the state moves on", () => {
    // State has already progressed (vest bumped to 40) since the 35 lb × 9 session was logged.
    const t: TrainingState = { standardId: "p1", trainingMax: 0, cycle: 1, week: 1, cal: { ...initCalState(50, 40) } };
    const [strength] = buildCards(pu, t, [logged(0, [{ weight: 35, reps: 9 }])], 1);
    expect(strength.status).toBe("done");
    expect(strength.loggedLines).toEqual(["35 lb × 9"]);
  });

  it("bodyweight sets show reps only", () => {
    const t: TrainingState = { standardId: "p1", trainingMax: 0, cycle: 1, week: 1, cal: { ...initCalState(50, 15) } };
    const cards = buildCards(pu, t, [logged(0, [{ weight: 15, reps: 7 }]), logged(1, [{ reps: 52 }])], 1);
    expect(cards[1].loggedLines).toEqual(["52 reps"]);
  });

  it("barbell main shows logged sets in a past week", () => {
    const sets = [{ weight: 235, reps: 3 }, { weight: 270, reps: 3 }, { weight: 305, reps: 5 }];
    const [main] = buildCards(dl, state, [{ ...log(0), sets }], 1);
    expect(main.loggedLines).toEqual(["235 lb × 3", "270 lb × 3", "305 lb × 5"]);
  });

  it("skipped, unlogged and not-yet-done cards fall back to the prescription", () => {
    const [main, bbb] = buildCards(dl, state, [log(1, true)], 1);
    expect(main.loggedLines).toBeUndefined(); // past week, no sets logged
    expect(bbb.loggedLines).toBeUndefined(); // skipped
    expect(buildCards(dl, state, [], 2)[0].loggedLines).toBeUndefined(); // today
  });
});

// F23: run cards
import { loggedLine } from "../PlanScreen";
import { initRunState } from "../../engine/run";

describe("buildCards — run", () => {
  const r: Standard = {
    id: "r1", type: "run800", category: "run", start: 160, target: 150,
    createdAt: "2026-11-01", status: "active",
  };
  const rs: TrainingState = { standardId: "r1", trainingMax: 0, cycle: 1, week: 1, run: initRunState(r) };
  const rlog = (sessionIndex: number, skipped = false): SessionLog => ({
    id: `${sessionIndex}`, standardId: "r1", cycle: 1, week: 1, sessionIndex, completedAt: "x",
    ...(skipped ? { skipped } : { sets: [{ part: "speed" as const, distance: 200, time: 39 }] }),
  });

  it("all 3 cards open at once (no locks), each can be skipped, no tag; only the first shows TODAY", () => {
    const cards = buildCards(r, rs, [], 1);
    expect(cards.map((c) => c.status)).toEqual(["today", "today", "today"]);
    expect(cards.map((c) => c.badgeToday)).toEqual([true, false, false]);
    expect(cards.every((c) => c.canSkip && c.session.recommended === undefined)).toBe(true);
  });
  it("done in any order; skipped card shows SKIPPED; done card shows logged sets", () => {
    const cards = buildCards(r, rs, [rlog(2), rlog(1, true)], 1);
    expect(cards.map((c) => c.status)).toEqual(["today", "done", "done"]);
    expect(cards.map((c) => c.badgeToday)).toEqual([true, false, false]);
    expect(cards[1].skipped).toBe(true);
    expect(cards[2].loggedLines).toEqual(["200m @ 5:14/mi in 0:39secs"]);
  });
  it("loggedLine formats run sets", () => {
    expect(loggedLine({ part: "trial", distance: 800, time: 155 })).toBe("800m · 2:35");
    expect(loggedLine({ part: "speed", distance: 400, time: 112 })).toBe("400m @ 7:31/mi in 1:52secs");
    expect(loggedLine({ minutes: 3, pace: 400 })).toBe("3 min @ 6:40/mi");
    expect(loggedLine({ minutes: 30 })).toBe("30 min");
    expect(loggedLine({})).toBe("Not done");
    expect(loggedLine({ weight: 35, reps: 9 })).toBe("35 lb × 9");
  });
});

describe("buildCards — TODAY badge outside run is unchanged", () => {
  it("lifts: open cards keep TODAY", () => {
    const cards = buildCards(dl, state, [], 2);
    expect(cards.filter((c) => c.status === "today").every((c) => c.badgeToday)).toBe(true);
  });
});
