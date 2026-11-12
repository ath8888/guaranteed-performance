// BUG-3 — shared.md S3, checked when the plan opens: a stuck week (all cards logged) catches up
import { WeekService } from "../WeekService";
import { TrainingService } from "../TrainingService";
import { SessionService } from "../SessionService";
import { initCalState } from "../../engine/calisthenics";
import { initRunState } from "../../engine/run";
import type { Standard, TrainingState } from "../../engine/types";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
beforeEach(async () => { await require("@react-native-async-storage/async-storage").clear(); });

const std = (id: string, type: Standard["type"], category: Standard["category"], start: number, target: number): Standard => ({
  id, type, category, start, target, createdAt: "2026-11-01T12:00:00.000Z", status: "active",
});
const oly = std("ol", "olympic", "olympic", 150, 200);
const bench = std("bn", "bench", "lifts", 225, 300);
const triple = (reps: number) => [{ weight: 100, reps: 3 }, { weight: 115, reps: 3 }, { weight: 130, reps }];
const stuck = async (t: TrainingState) => { await TrainingService.save(t); return t; };

describe("WeekService.catchUp (shared S3 on plan open)", () => {
  it("Olympic stuck on W2 with W2 logged → W3 (the Clean and Press case)", async () => {
    const t = await stuck({ standardId: "ol", trainingMax: 135, current: 150, cycle: 1, week: 2 });
    await SessionService.log("ol", 1, 1, 0, triple(3));
    await SessionService.log("ol", 1, 2, 0, triple(3));
    const next = await WeekService.catchUp(oly, t);
    expect(next).toMatchObject({ cycle: 1, week: 3, current: 150, trainingMax: 135 });
    expect(await TrainingService.get("ol")).toMatchObject({ week: 3 });
  });
  it("Olympic stuck on W3 after all triples → O3 (+5) at the end of week 3, W4", async () => {
    const t = await stuck({ standardId: "ol", trainingMax: 135, current: 150, cycle: 1, week: 3 });
    for (const w of [1, 2, 3]) await SessionService.log("ol", 1, w, 0, triple(3));
    expect(await WeekService.catchUp(oly, t)).toMatchObject({ cycle: 1, week: 4, current: 155, trainingMax: 140, olyProgressCycle: 1 });
  });
  it("Olympic stuck on W4 after O3 already ran this cycle → no second +5", async () => {
    const t = await stuck({ standardId: "ol", trainingMax: 140, current: 155, cycle: 1, week: 4, olyProgressCycle: 1 });
    for (const w of [1, 2, 3, 4]) await SessionService.log("ol", 1, w, 0, triple(3));
    expect(await WeekService.catchUp(oly, t)).toMatchObject({ cycle: 2, week: 1, current: 155, trainingMax: 140 });
  });
  it("Olympic saved before v0.8, stuck on W4 after all triples → O3 at the end of week 4 (+5), cycle 2 W1", async () => {
    const t = await stuck({ standardId: "ol", trainingMax: 135, current: 150, cycle: 1, week: 4 });
    for (const w of [1, 2, 3]) await SessionService.log("ol", 1, w, 0, triple(3));
    await SessionService.log("ol", 1, 4, 0, triple(3));
    expect(await WeekService.catchUp(oly, t)).toMatchObject({ cycle: 2, week: 1, current: 155, trainingMax: 140 });
  });
  it("old Olympic state without CURRENT still catches up (CURRENT from TM ÷ 0.9)", async () => {
    const t = await stuck({ standardId: "ol", trainingMax: 135, cycle: 1, week: 2 });
    await SessionService.log("ol", 1, 2, 0, triple(3));
    expect(await WeekService.catchUp(oly, t)).toMatchObject({ week: 3, current: 150, trainingMax: 135 });
  });
  it("Lifts stuck on W4 → L5 cycle end, cycle 2 W1", async () => {
    const t = await stuck({ standardId: "bn", trainingMax: 205, current: 225, cycle: 1, week: 4 });
    await SessionService.log("bn", 1, 3, 0, [{ weight: 155, reps: 5 }, { weight: 175, reps: 3 }, { weight: 195, reps: 2 }]);
    await SessionService.log("bn", 1, 4, 0, [{ weight: 80, reps: 5 }, { weight: 105, reps: 5 }, { weight: 125, reps: 5 }]);
    expect(await WeekService.catchUp(bench, t)).toMatchObject({ cycle: 2, week: 1, current: 230, trainingMax: 205 });
  });
  it("Push-ups and Run stuck weeks move on", async () => {
    const pu = std("pu", "pushups", "calisthenics", 50, 60);
    const tp = await stuck({ standardId: "pu", trainingMax: 0, cycle: 1, week: 2, cal: initCalState(50, 15) });
    for (const i of [0, 1, 2]) await SessionService.log("pu", 1, 2, i, undefined, i === 2);
    expect(await WeekService.catchUp(pu, tp)).toMatchObject({ week: 3 });
    const rn = std("rn", "run800", "run", 160, 150);
    const tr = await stuck({ standardId: "rn", trainingMax: 0, cycle: 1, week: 1, run: initRunState(rn) });
    for (const i of [0, 1, 2]) await SessionService.log("rn", 1, 1, i, undefined, true);
    expect(await WeekService.catchUp(rn, tr)).toMatchObject({ week: 2 });
  });
  it("a week with a card not logged stays (S3-R1); nothing is saved", async () => {
    const t = await stuck({ standardId: "bn", trainingMax: 205, current: 225, cycle: 1, week: 2 });
    await SessionService.log("bn", 1, 2, 0, [{ weight: 145, reps: 3 }, { weight: 165, reps: 3 }, { weight: 185, reps: 5 }]);
    expect(await WeekService.catchUp(bench, t)).toEqual(t); // BBB not logged yet
    expect(await TrainingService.get("bn")).toEqual(t);
  });
  it("a healthy plan (current week empty) is untouched", async () => {
    const t = await stuck({ standardId: "ol", trainingMax: 135, current: 150, cycle: 1, week: 3 });
    await SessionService.log("ol", 1, 2, 0, triple(3));
    expect(await WeekService.catchUp(oly, t)).toEqual(t);
  });
});
