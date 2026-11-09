// One test per row and per example in decision-tables/shared.md (v1.0)
import { ENGINES } from "../registry";
import { roundLb } from "../shared";
import { liftTM, currentAtCycleEnd } from "../strength";
import { olympicWeek, olympicCurrentAtCycleEnd } from "../olympic";
import { calisthenicsWeek, applyCalisthenicsResult, initCalState } from "../calisthenics";
import { runWeek, applyRunResult, initRunState } from "../run";
import { currentValue, estCompletionDate, estCompletionLabel, initTrainingMax, isWeekComplete } from "../progression";
import type { SessionLog, Standard, StandardType, TrainingState } from "../types";
import { LiftService } from "../../services/LiftService";
import { TrainingService } from "../../services/TrainingService";
import { SessionService } from "../../services/SessionService";
import { StandardService } from "../../services/StandardService";
import { HistoryService, buildHistory } from "../../services/HistoryService";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
const AsyncStorage = () => require("@react-native-async-storage/async-storage");
beforeEach(async () => { await AsyncStorage().clear(); });

const std = (id: string, type: StandardType, category: Standard["category"], start: number, target: number): Standard => ({
  id, type, category, start, target, createdAt: "2026-11-02T12:00:00.000Z", status: "active",
});
const bench = std("bn", "bench", "lifts", 225, 300);
const oly = std("ol", "olympic", "olympic", 150, 200);
const pu = std("pu", "pushups", "calisthenics", 50, 60);
const run = std("rn", "run1_5", "run", 720, 600);

const liftState = (current: number, week: 1 | 2 | 3 | 4 = 1): TrainingState => ({ standardId: "bn", trainingMax: liftTM(current), current, cycle: 1, week });
const puState = (): TrainingState => ({ standardId: "pu", trainingMax: 0, cycle: 1, week: 1, cal: initCalState(50, 15) });
const runState = (): TrainingState => ({ standardId: "rn", trainingMax: 0, cycle: 1, week: 1, run: initRunState(run) });
const log = (standardId: string, week: number, sessionIndex: number, extra: Partial<SessionLog> = {}): SessionLog => ({
  id: `${standardId}-${week}-${sessionIndex}`, standardId, cycle: 1, week, sessionIndex, completedAt: "2026-11-03T18:00:00.000Z", ...extra,
});
const main = (weight: number, reps: number) => [{ weight: 150, reps: 5 }, { weight: 170, reps: 5 }, { weight, reps }];

describe("S1 — CURRENT and TM", () => {
  it("S1-R1: every engine has one CURRENT", () => {
    for (const type of Object.keys(ENGINES) as StandardType[]) expect(typeof ENGINES[type].currentValue).toBe("function");
  });
  it("S1-R2: Lifts + Olympic: CURRENT starts at START, TM = 90% of CURRENT", () => {
    expect(initTrainingMax(bench)).toBe(205);
    expect(initTrainingMax(oly)).toBe(135);
    expect(currentValue(bench, liftState(240))).toBe(240);
    expect(currentValue(oly, { standardId: "ol", trainingMax: liftTM(165), current: 165, cycle: 1, week: 1 })).toBe(165);
  });
  it("S1-R3: Lifts + Olympic: no stored CURRENT → TM ÷ 0.9", () => {
    expect(currentValue(bench, { standardId: "bn", trainingMax: 180, cycle: 1, week: 1 })).toBe(200);
    expect(currentValue(oly, { standardId: "ol", trainingMax: 135, cycle: 1, week: 1 })).toBe(150);
  });
});

describe("S2 — rounding", () => {
  it("S2-R1: nearest 5 lb, exact halves round up (Lifts + Olympic loads)", () => {
    expect(roundLb(186.55)).toBe(185);
    expect(roundLb(175 * 0.7)).toBe(125); // float 122.4999… still a half
    expect(roundLb(67.5)).toBe(70);
    expect(olympicWeek(1, 175)[0].sets!.map((s) => s.weight)).toEqual([115, 130, 150]); // 113.75, 131.25, 148.75
  });
});

describe("S3 — cycle and week", () => {
  const cases: [Standard, TrainingState][] = [[bench, liftState(225)], [oly, { standardId: "ol", trainingMax: 135, current: 150, cycle: 1, week: 1 }], [pu, puState()], [run, runState()]];
  it("S3-R1: a card not logged → week stays (every engine)", () => {
    for (const [s, t] of cases) {
      const n = ENGINES[s.type].buildWeek(s, t).length;
      const logs = Array.from({ length: n - 1 }, (_, i) => log(t.standardId, 1, i));
      expect(isWeekComplete(s, t, logs)).toBe(false);
    }
  });
  it("S3-R2: every card logged, done or skipped → week complete (every engine)", () => {
    for (const [s, t] of cases) {
      const n = ENGINES[s.type].buildWeek(s, t).length;
      const logs = Array.from({ length: n }, (_, i) => log(t.standardId, 1, i, i === n - 1 ? { skipped: true } : {}));
      expect(isWeekComplete(s, t, logs)).toBe(true);
    }
  });
  it("S3-R2/R3: week advance, and week 4 rolls to week 1 of the next cycle", async () => {
    await TrainingService.init("x", 100);
    expect(await TrainingService.advanceWeek("x", 100)).toMatchObject({ week: 2, cycle: 1 });
    await TrainingService.save({ standardId: "x", trainingMax: 100, cycle: 1, week: 4 });
    expect(await TrainingService.advanceWeek("x", 105)).toMatchObject({ week: 1, cycle: 2, trainingMax: 105 });
  });
  it("S3-R3: finishing week 4 runs the cycle-end rule", async () => {
    await TrainingService.init("bn", 205, undefined, undefined, 225);
    await TrainingService.save({ ...liftState(225, 3) });
    await LiftService.record(bench, (await TrainingService.get("bn"))!, 0, main(195, 3));
    await LiftService.record(bench, (await TrainingService.get("bn"))!, 1, undefined, true);
    const next = await LiftService.record(bench, (await TrainingService.get("bn"))!, 0, main(120, 5));
    // week 3: 195 × 3 → estimate 215, CURRENT holds at 225; cycle end (L5) → +5
    expect(next).toMatchObject({ current: 230, trainingMax: 205, cycle: 2, week: 1 });
  });
});

describe("S4 — skips", () => {
  it("S4-R1: a skip is saved as skipped and counts toward the week", async () => {
    await SessionService.log("bn", 1, 1, 1, undefined, true);
    const logs = await SessionService.getAll("bn");
    expect(logs[0].skipped).toBe(true);
    expect(isWeekComplete(bench, liftState(225), [log("bn", 1, 0), ...logs])).toBe(true);
  });
  it("S4-R2: a skip never changes CURRENT (every engine)", async () => {
    await TrainingService.init("bn", 205, undefined, undefined, 225);
    expect((await LiftService.record(bench, liftState(225), 1, undefined, true)).current).toBe(225);
    await TrainingService.init("ol", 135, undefined, undefined, 150);
    const olyT: TrainingState = { standardId: "ol", trainingMax: 135, current: 150, cycle: 1, week: 1 };
    expect((await LiftService.record(oly, olyT, 0, undefined, true)).current).toBe(150);
    const p = puState();
    for (const session of calisthenicsWeek(p)) {
      expect(currentValue(pu, { ...p, cal: applyCalisthenicsResult(p, session, undefined, true) })).toBe(currentValue(pu, p));
    }
    const r = runState();
    for (const session of runWeek(run, r)) expect(applyRunResult(run, r, session, undefined, true).current).toBe(r.run!.current);
  });
  it("S4-R3: engine rules treat a skipped card as not logged", () => {
    const w3Skipped = [log("x", 3, 0, { skipped: true, sets: main(195, 5) })];
    expect(currentAtCycleEnd(bench, 225, w3Skipped, 1)).toBe(225);
    expect(olympicCurrentAtCycleEnd(150, w3Skipped, 1)).toBe(150);
  });
  it("S4-R4: skipped cards are not shown in History", () => {
    expect(buildHistory([log("bn", 1, 0), log("bn", 1, 1, { skipped: true })], [bench])).toHaveLength(1);
  });
});

describe("S5 — estimated completion date", () => {
  it("S5-R1: CURRENT at target → REACHED", () => {
    expect(estCompletionLabel(bench, liftState(300))).toBe("REACHED");
  });
  it("S5-R2: otherwise a date that stays the same all week", () => {
    const t = liftState(225, 2);
    const logs = [log("bn", 1, 0, { completedAt: "2026-11-09T18:00:00.000Z" })];
    const mon = estCompletionDate(bench, t, logs, new Date("2026-11-09T20:00:00.000Z"))!;
    const sat = estCompletionDate(bench, t, logs, new Date("2026-11-14T20:00:00.000Z"))!;
    expect(sat.getTime()).toBe(mon.getTime());
    expect(mon.getTime()).toBeGreaterThan(new Date("2026-11-16T00:00:00.000Z").getTime());
  });
});

describe("S6 — deleting a standard", () => {
  it("S6-R1: leaves the standard list, logs and name stay in History", async () => {
    const s = await StandardService.create("bench", 225, 300);
    await SessionService.log(s.id, 1, 1, 0, main(185, 8));
    await HistoryService.rememberDeleted(s);
    await StandardService.remove(s.id);
    expect(await StandardService.getAll()).toHaveLength(0);
    const h = await HistoryService.getAll();
    expect(h).toHaveLength(1);
    expect(h[0].name).toBe("Bench Press");
  });
});

describe("Examples", () => {
  it("E1: bench CURRENT 225 → TM 205", () => { expect(liftTM(225)).toBe(205); });
  it("E2: Olympic saved with TM 135, no CURRENT → CURRENT 150", () => {
    expect(currentValue(oly, { standardId: "ol", trainingMax: 135, cycle: 1, week: 1 })).toBe(150);
  });
  it("E3: week 2 with BBB not logged stays on week 2", () => {
    expect(isWeekComplete(bench, liftState(225, 2), [log("bn", 2, 0)])).toBe(false);
  });
  it("E4: skipping BBB finishes the week, CURRENT unchanged", async () => {
    await TrainingService.init("bn", 205, undefined, undefined, 225);
    await LiftService.record(bench, liftState(225), 0, main(170, 5));
    const next = await LiftService.record(bench, (await TrainingService.get("bn"))!, 1, undefined, true);
    expect(next).toMatchObject({ week: 2, current: 225 });
  });
});
