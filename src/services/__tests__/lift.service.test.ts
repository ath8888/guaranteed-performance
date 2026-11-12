import { LiftService } from "../LiftService";
import { TrainingService } from "../TrainingService";
import { SessionService } from "../SessionService";
import { olympicWeek } from "../../engine/olympic";
import type { Standard, TrainingState } from "../../engine/types";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const sq: Standard = { id: "sq", type: "squat", category: "lifts", start: 335, target: 400, createdAt: "2026-11-01T12:00:00.000Z", status: "active" };
const AsyncStorage = () => require("@react-native-async-storage/async-storage");
const state = async () => (await TrainingService.get("sq"))!;
const top = (weight: number, reps: number) => [{ weight: 200, reps: 5 }, { weight: 230, reps: 3 }, { weight, reps }];
const bbb = Array.from({ length: 5 }, () => ({ weight: 150, reps: 10 }));

async function goToWeek(week: 1 | 2 | 3 | 4) {
  const s = await state();
  await TrainingService.save({ ...s, week } as TrainingState);
}

beforeEach(async () => {
  await AsyncStorage().clear();
  await TrainingService.init("sq", 300, undefined, undefined, 335);
});

describe("LiftService.record (lifts.md)", () => {
  it("init stores CURRENT = START and TM = 90%", async () => {
    expect(await state()).toMatchObject({ current: 335, trainingMax: 300 });
  });
  it("a big + set raises CURRENT and the TM at once, mid-week", async () => {
    await goToWeek(3);
    const next = await LiftService.record(sq, await state(), 0, top(285, 8));
    expect(next).toMatchObject({ current: 360, trainingMax: 325, week: 3 });
  });
  it("a miss cuts CURRENT 10% at once", async () => {
    await goToWeek(3);
    const next = await LiftService.record(sq, await state(), 0, top(285, 0));
    expect(next).toMatchObject({ current: 300, trainingMax: 270 });
  });
  it("BBB (logged or skipped) finishes the week without moving CURRENT", async () => {
    await LiftService.record(sq, await state(), 0, top(255, 5));
    const next = await LiftService.record(sq, await state(), 1, undefined, true);
    expect(next).toMatchObject({ current: 335, trainingMax: 300, week: 2 });
  });
  it("cycle end: week 3 logged → +10 to CURRENT, TM = 90% of it, new cycle", async () => {
    await goToWeek(3);
    await LiftService.record(sq, await state(), 0, top(285, 3));
    await LiftService.record(sq, await state(), 1, bbb);
    const next = await LiftService.record(sq, await state(), 0, top(180, 5));
    expect(next).toMatchObject({ current: 345, trainingMax: 310, week: 1, cycle: 2 });
  });
  it("cycle end: no week 3 log → no increase", async () => {
    await goToWeek(4);
    const next = await LiftService.record(sq, await state(), 0, top(180, 5));
    expect(next).toMatchObject({ current: 335, trainingMax: 300, week: 1, cycle: 2 });
  });
});

describe("LiftService.record (olympic-lifts.md)", () => {
  const oly: Standard = { id: "ol", type: "olympic", name: "Power Clean", category: "olympic", start: 150, target: 200, createdAt: "2026-11-01T12:00:00.000Z", status: "active" };
  const olyState = async () => (await TrainingService.get("ol"))!;
  const triple = (weight: number, reps: number) => [{ weight: 100, reps: 3 }, { weight: 115, reps: 3 }, { weight, reps }];
  async function runCycle(w1: number, w2: number, w3: number) {
    await LiftService.record(oly, await olyState(), 0, triple(115, w1));
    await LiftService.record(oly, await olyState(), 0, triple(120, w2));
    await LiftService.record(oly, await olyState(), 0, triple(130, w3));
    const mid = await olyState();
    return { mid, end: await LiftService.record(oly, mid, 0, triple(80, 3)) };
  }
  beforeEach(async () => { await TrainingService.init("ol", 135, undefined, undefined, 150); });

  it("weeks 1–2 top sets never move CURRENT", async () => {
    await LiftService.record(oly, await olyState(), 0, triple(115, 3));
    const w2 = await LiftService.record(oly, await olyState(), 0, triple(120, 3));
    expect(w2).toMatchObject({ current: 150, trainingMax: 135, week: 3 });
  });
  it("O3 v0.8: all triples → +5 when week 3 is finished; week 4 deload built from the new TM (E2)", async () => {
    const { mid } = await runCycle(3, 3, 3);
    expect(mid).toMatchObject({ current: 155, trainingMax: 140, week: 4, olyProgressCycle: 1 });
    expect(olympicWeek(mid.week, mid.trainingMax)[0].sets!.map((s) => s.weight)).toEqual([55, 70, 85]);
  });
  it("O3 runs once per cycle: finishing week 4 adds nothing more", async () => {
    const { end } = await runCycle(3, 3, 3);
    expect(end).toMatchObject({ current: 155, trainingMax: 140, week: 1, cycle: 2 });
  });
  it("0 reps on week 3 → CURRENT holds at the end of week 3 and stays held after week 4", async () => {
    const { mid, end } = await runCycle(3, 3, 0);
    expect(mid).toMatchObject({ current: 150, trainingMax: 135, week: 4, olyProgressCycle: 1 });
    expect(end).toMatchObject({ current: 150, trainingMax: 135, week: 1, cycle: 2 });
  });
  it("next cycle: +5 again at the end of its week 3", async () => {
    await runCycle(3, 3, 3);
    const { mid } = await runCycle(3, 3, 3);
    expect(mid).toMatchObject({ current: 160, trainingMax: 145, week: 4, cycle: 2, olyProgressCycle: 2 });
  });
  it("state saved before v0.8, already in week 4 → O3 runs when week 4 is finished", async () => {
    await TrainingService.save({ standardId: "ol", trainingMax: 135, current: 150, cycle: 1, week: 4 });
    for (const w of [1, 2, 3] as const) await SessionService.log("ol", 1, w, 0, triple(130, 3));
    const end = await LiftService.record(oly, await olyState(), 0, triple(80, 3));
    expect(end).toMatchObject({ current: 155, trainingMax: 140, week: 1, cycle: 2, olyProgressCycle: 1 });
  });
  it("skipping the week 3 card finishes week 3 and holds CURRENT (O3-R1)", async () => {
    await LiftService.record(oly, await olyState(), 0, triple(115, 3));
    await LiftService.record(oly, await olyState(), 0, triple(120, 3));
    const w4 = await LiftService.record(oly, await olyState(), 0, undefined, true);
    expect(w4).toMatchObject({ current: 150, trainingMax: 135, week: 4, olyProgressCycle: 1 });
  });
});
