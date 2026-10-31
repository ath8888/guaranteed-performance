import { CalisthenicsService } from "../CalisthenicsService";
import { TrainingService } from "../TrainingService";
import { SessionService } from "../SessionService";
import { initCalState } from "../../engine/calisthenics";
import type { Standard } from "../../engine/types";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const pu: Standard = {
  id: "p1", type: "pushups", category: "calisthenics", start: 50, target: 60,
  createdAt: "2026-01-01", status: "active",
};

const AsyncStorage = () => require("@react-native-async-storage/async-storage");
const state = async () => (await TrainingService.get("p1"))!;

beforeEach(async () => {
  await AsyncStorage().clear();
});

describe("CalisthenicsService.record", () => {
  beforeEach(async () => {
    await TrainingService.init("p1", 0, initCalState(50, 35));
  });

  it("strength day: logs and saves progression (9 reps → +5 lb)", async () => {
    await CalisthenicsService.record(pu, await state(), 0, [{ weight: 35, reps: 9 }]);
    expect((await state()).cal!.load).toBe(40);
    expect(await SessionService.getAll("p1")).toHaveLength(1);
  });

  it("week advances after strength, AMRAP and back-off sets", async () => {
    await CalisthenicsService.record(pu, await state(), 0, [{ weight: 35, reps: 7 }]);
    await CalisthenicsService.record(pu, await state(), 1, [{ reps: 52 }]);
    expect((await state()).week).toBe(1);
    await CalisthenicsService.record(pu, await state(), 2, [{ reps: 21 }, { reps: 21 }]);
    const s = await state();
    expect(s.week).toBe(2);
    expect(s.cal).toMatchObject({ max: 52, best: 52, stallCount: 0 });
  });

  it("skipped back-off sets are logged as skipped and still finish the week", async () => {
    await CalisthenicsService.record(pu, await state(), 0, [{ weight: 35, reps: 7 }]);
    await CalisthenicsService.record(pu, await state(), 1, [{ reps: 48 }]);
    await CalisthenicsService.record(pu, await state(), 2, undefined, true);
    const logs = await SessionService.getAll("p1");
    expect(logs[2].skipped).toBe(true);
    expect((await state()).week).toBe(2);
  });
});

describe("TrainingService upgrades old push-up state on read", () => {
  it("converts and saves it once", async () => {
    await AsyncStorage().setItem("training:p1", JSON.stringify({
      standardId: "p1", trainingMax: 0, cycle: 1, week: 1,
      cal: { max: 50, load: 35, enduranceReps: 25, enduranceStreak: 0, endurancePending: false, stallCount: 0, retests: [] },
    }));
    const s = await state();
    expect(s.week).toBe(2);
    expect(s.cal).toEqual({ max: 50, best: 50, load: 35, stallCount: 0, amraps: [] });
    expect(JSON.parse(await AsyncStorage().getItem("training:p1")).cal.best).toBe(50);
  });
});
