import { RunService } from "../RunService";
import { TrainingService } from "../TrainingService";
import { SessionService } from "../SessionService";
import { initRunState } from "../../engine/run";
import type { RunState, SetActual, Standard } from "../../engine/types";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const r: Standard = {
  id: "r1", type: "run800", category: "run", start: 160, target: 150,
  createdAt: "2026-11-01T12:00:00.000Z", status: "active",
};
const AsyncStorage = () => require("@react-native-async-storage/async-storage");
const state = async () => (await TrainingService.get("r1"))!;
// Session A at target: 2 × 100m in 0:18, 4 × 45s @ 5:22/mi, threshold left unchecked
const sessionA: SetActual[] = [
  ...Array.from({ length: 2 }, () => ({ part: "speed" as const, distance: 100, time: 18, rest: 90 })),
  ...Array.from({ length: 4 }, () => ({ part: "interval" as const, length: 45, pace: 322, rest: 100 })),
  {},
];

beforeEach(async () => {
  await AsyncStorage().clear();
  await TrainingService.init("r1", 0, undefined, initRunState(r));
});

describe("RunService.record", () => {
  it("init saves the run state", async () => {
    expect((await state()).run).toMatchObject({ rung: 1, base: 322, current: 160, counter: 0 });
  });

  it("logs a card and saves the counter", async () => {
    await RunService.record(r, await state(), 0, sessionA);
    expect((await state()).run!.counter).toBe(1);
    expect(await SessionService.getAll("r1")).toHaveLength(1);
  });

  it("2 Session A's at target → next rung; week advances once all 3 cards are logged, in any order", async () => {
    await RunService.record(r, await state(), 2, sessionA);
    await RunService.record(r, await state(), 0, sessionA);
    let s = await state();
    expect(s.run).toMatchObject({ rung: 2, counter: 0 });
    expect(s.week).toBe(1);
    await RunService.record(r, await state(), 1, [{ part: "zone2", minutes: 20 }]);
    s = await state();
    expect(s.week).toBe(2);
    expect(s.run).toMatchObject({ rung: 2, z2Full: 1 });
  });

  it("skips count toward the week and leave the counter alone", async () => {
    await RunService.record(r, await state(), 0, sessionA);
    await RunService.record(r, await state(), 1, undefined, true);
    await RunService.record(r, await state(), 2, undefined, true);
    const s = await state();
    expect(s.week).toBe(2);
    expect(s.run!.counter).toBe(1);
    expect((await SessionService.getAll("r1")).filter((l) => l.skipped)).toHaveLength(2);
  });

  it("unchecked intervals are logged as not done and break the counter", async () => {
    await RunService.record(r, await state(), 0, sessionA);
    const miss = [...sessionA]; miss[2] = {};
    await RunService.record(r, await state(), 2, miss);
    expect((await state()).run!.counter).toBe(0);
    expect((await SessionService.getAll("r1"))[1].sets![2]).toEqual({});
  });

  it("R11: an old v0.3 state is converted and saved on the next log", async () => {
    const old = { ladder: 300, streak: 1, current: 155, adjust: { speed: -3 }, trials: [], points: [] } as unknown as RunState;
    await TrainingService.save({ ...(await state()), run: old });
    await RunService.record(r, await state(), 1, [{ part: "zone2", minutes: 10 }]);
    expect((await state()).run).toEqual({ rung: 1, counter: 0, base: 312, current: 155, z2Min: 20, z2Full: 0, trials: [], points: [] });
  });
});
