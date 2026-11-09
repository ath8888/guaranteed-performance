import { LiftService } from "../LiftService";
import { TrainingService } from "../TrainingService";
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
