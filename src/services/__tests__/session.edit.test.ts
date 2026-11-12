// F30 — edit everything on the Session screen: completed date, weights, reps, notes
import { SessionService } from "../SessionService";
import { TrainingService } from "../TrainingService";
import { LiftService } from "../LiftService";
import { CalisthenicsService } from "../CalisthenicsService";
import { RunService } from "../RunService";
import { HistoryService } from "../HistoryService";
import { StandardService } from "../StandardService";
import { ExportService } from "../ExportService";
import { initCalState } from "../../engine/calisthenics";
import { initRunState } from "../../engine/run";
import type { Standard } from "../../engine/types";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
beforeEach(async () => { await require("@react-native-async-storage/async-storage").clear(); });

const std = (id: string, type: Standard["type"], category: Standard["category"], start: number, target: number): Standard => ({
  id, type, category, start, target, createdAt: "2026-11-01T12:00:00.000Z", status: "active",
});
const DATE = "2026-11-05T18:30:00.000Z";

describe("SessionService.log extras", () => {
  it("saves the chosen completed date and the trimmed note", async () => {
    const log = await SessionService.log("x", 1, 1, 0, [{ weight: 100, reps: 5 }], false, { completedAt: DATE, notes: "  felt heavy  " });
    expect(log).toMatchObject({ completedAt: DATE, notes: "felt heavy" });
    expect((await SessionService.getAll("x"))[0]).toMatchObject({ completedAt: DATE, notes: "felt heavy" });
  });
  it("no extras → now, and a blank note isn't saved", async () => {
    const before = Date.now();
    const log = await SessionService.log("x", 1, 1, 0, undefined, false, { notes: "   " });
    expect(new Date(log.completedAt).getTime()).toBeGreaterThanOrEqual(before);
    expect("notes" in log).toBe(false);
  });
});

describe("the engine uses what was logged", () => {
  it("Lifts: a heavier + set than planned raises CURRENT by its own estimate", async () => {
    const bench = std("bn", "bench", "lifts", 225, 300);
    await TrainingService.init("bn", 205, undefined, undefined, 225);
    // week 1 plan: 135 × 5, 155 × 5, 175 × 5+ — logged top set edited to 200 × 5
    const sets = [{ weight: 135, reps: 5 }, { weight: 155, reps: 4 }, { weight: 200, reps: 5 }];
    const next = await LiftService.record(bench, (await TrainingService.get("bn"))!, 0, sets, false, { completedAt: DATE });
    expect(next).toMatchObject({ current: 235, trainingMax: 210 }); // 200 × 1.167 = 233 → 235
    expect((await SessionService.getAll("bn"))[0]).toMatchObject({ sets, completedAt: DATE });
  });
  it("Push-ups: the AMRAP is dated with the chosen day", async () => {
    const pu = std("pu", "pushups", "calisthenics", 50, 60);
    await TrainingService.init("pu", 0, initCalState(50, 15));
    await CalisthenicsService.record(pu, (await TrainingService.get("pu"))!, 0, [{ weight: 15, reps: 7 }], false, { completedAt: DATE });
    const next = await CalisthenicsService.record(pu, (await TrainingService.get("pu"))!, 1, [{ reps: 52 }], false, { completedAt: DATE });
    expect(next.cal!.amraps).toEqual([{ date: "2026-11-05", reps: 52, cycle: 1 }]);
  });
  it("Run: the Time Trial is dated with the chosen day", async () => {
    const r = std("rn", "run800", "run", 160, 150);
    await TrainingService.init("rn", 0, undefined, initRunState(r));
    await TrainingService.save({ ...(await TrainingService.get("rn"))!, week: 4 });
    const next = await RunService.record(r, (await TrainingService.get("rn"))!, 2, [{ part: "trial", distance: 800, time: 155 }], false, { completedAt: DATE });
    expect(next.run!.trials).toEqual([{ date: "2026-11-05", time: 155, cycle: 1 }]);
  });
});

describe("notes show up", () => {
  it("in History", async () => {
    const s = await StandardService.create("bench", 225, 300);
    await SessionService.log(s.id, 1, 1, 0, [{ weight: 175, reps: 8 }], false, { completedAt: DATE, notes: "new belt" });
    const h = await HistoryService.getAll();
    expect(h[0].log.notes).toBe("new belt");
    expect(h[0].log.completedAt).toBe(DATE); // History and the calendar use the chosen date
  });
  it("in the Markdown and CSV export, escaped", () => {
    const s = std("bn", "bench", "lifts", 225, 300);
    const data = {
      standards: [s], training: [],
      sessions: [{ id: "1", standardId: "bn", cycle: 1, week: 1, sessionIndex: 0, completedAt: DATE, notes: 'grip | "wide"\nslow' }],
    };
    expect(ExportService.toMarkdown(data)).toContain('| 2026-11-05 | grip \\| "wide" slow |');
    expect(ExportService.toCSV(data)).toContain('2026-11-05,"grip | ""wide""\nslow"');
  });
});
