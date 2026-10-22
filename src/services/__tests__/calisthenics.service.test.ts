import { CalisthenicsService } from "../CalisthenicsService";
import { TrainingService } from "../TrainingService";
import { SessionService } from "../SessionService";
import { initCalState } from "../../engine/calisthenics";
import type { Standard } from "../../engine/types";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const pu: Standard = {
  id: "p1", type: "pushups", category: "calisthenics", start: 40, target: 60,
  createdAt: "2026-01-01", status: "active",
};

beforeEach(async () => {
  await require("@react-native-async-storage/async-storage").clear();
});

const state = async () => (await TrainingService.get("p1"))!;
const reps = (n: number, count: number) => Array.from({ length: count }, () => ({ reps: n }));

describe("CalisthenicsService.record", () => {
  beforeEach(async () => {
    await TrainingService.init("p1", 0, initCalState(40, 10));
  });

  it("logs the card and saves progression (8 reps → +5 lb)", async () => {
    await CalisthenicsService.record(pu, await state(), 0, [{ weight: 10, reps: 8 }]);
    expect((await state()).cal!.load).toBe(15);
    expect(await SessionService.getAll("p1")).toHaveLength(1);
  });

  it("skips are logged as skipped and don't progress", async () => {
    await CalisthenicsService.record(pu, await state(), 1, undefined, true);
    const [log] = await SessionService.getAll("p1");
    expect(log.skipped).toBe(true);
    expect((await state()).cal!.enduranceStreak).toBe(0);
  });

  it("week advances only after all 4 cards are completed or skipped", async () => {
    await CalisthenicsService.record(pu, await state(), 0, [{ weight: 10, reps: 6 }]);
    await CalisthenicsService.record(pu, await state(), 1, reps(20, 3));
    await CalisthenicsService.record(pu, await state(), 2, undefined, true);
    expect((await state()).week).toBe(1);
    await CalisthenicsService.record(pu, await state(), 3, reps(20, 3));
    const s = await state();
    expect(s.week).toBe(2);
    expect(s.cal!.enduranceReps).toBe(22); // 2 clean endurance sessions in a row
  });

  it("week 4 retest rolls into the next cycle with the new max", async () => {
    await TrainingService.save({ ...(await state()), week: 4 });
    await CalisthenicsService.record(pu, await state(), 0, [{ reps: 45 }]);
    const s = await state();
    expect([s.cycle, s.week]).toEqual([2, 1]);
    expect(s.cal!.max).toBe(45);
    expect(s.cal!.enduranceReps).toBe(23);
  });
});
