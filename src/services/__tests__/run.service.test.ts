import { RunService } from "../RunService";
import { TrainingService } from "../TrainingService";
import { SessionService } from "../SessionService";
import { initRunState } from "../../engine/run";
import type { Standard } from "../../engine/types";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const r: Standard = {
  id: "r1", type: "run800", category: "run", start: 160, target: 150,
  createdAt: "2026-11-01T12:00:00.000Z", status: "active",
};
const AsyncStorage = () => require("@react-native-async-storage/async-storage");
const state = async () => (await TrainingService.get("r1"))!;
// Session A at target: 6 × 200m in 0:40, 2 × 3 min @ 6:44/mi
const sessionA = [
  ...Array.from({ length: 6 }, () => ({ distance: 200, time: 40 })),
  ...Array.from({ length: 2 }, () => ({ minutes: 3, pace: 404 })),
];

beforeEach(async () => {
  await AsyncStorage().clear();
  await TrainingService.init("r1", 0, undefined, initRunState(r));
});

describe("RunService.record", () => {
  it("init saves the run state", async () => {
    expect((await state()).run).toMatchObject({ ladder: 322, current: 160, streak: 0 });
  });

  it("logs a card and saves the ladder counter", async () => {
    await RunService.record(r, await state(), 0, sessionA);
    expect((await state()).run!.streak).toBe(1);
    expect(await SessionService.getAll("r1")).toHaveLength(1);
  });

  it("2 Session A's at target → step; week advances once all 3 cards are logged, in any order", async () => {
    await RunService.record(r, await state(), 2, sessionA);
    await RunService.record(r, await state(), 0, sessionA);
    let s = await state();
    expect(s.run!.ladder).toBe(307);
    expect(s.week).toBe(1);
    await RunService.record(r, await state(), 1, [{ minutes: 25 }]);
    s = await state();
    expect(s.week).toBe(2);
    expect(s.run!.ladder).toBe(307);
  });

  it("skips count toward the week and leave the counter alone", async () => {
    await RunService.record(r, await state(), 0, sessionA);
    await RunService.record(r, await state(), 1, undefined, true);
    await RunService.record(r, await state(), 2, undefined, true);
    const s = await state();
    expect(s.week).toBe(2);
    expect(s.run!.streak).toBe(1);
    expect((await SessionService.getAll("r1")).filter((l) => l.skipped)).toHaveLength(2);
  });
});

describe("RunService.record — unfinished reps", () => {
  it("unchecked reps are logged as not done and count as a ladder miss", async () => {
    await RunService.record(r, await state(), 0, sessionA);
    await RunService.record(r, await state(), 2, [{}, ...sessionA.slice(1)]);
    expect((await state()).run!.streak).toBe(0);
    expect((await SessionService.getAll("r1"))[1].sets![0]).toEqual({});
  });
});
