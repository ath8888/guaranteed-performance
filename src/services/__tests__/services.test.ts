import { StandardService } from "../StandardService";
import { TrainingService } from "../TrainingService";
import { SessionService } from "../SessionService";
import { ExportService } from "../ExportService";
import type { Standard, TrainingState, SessionLog } from "../../engine/types";

// AsyncStorage mock provided by @react-native-async-storage/async-storage/jest/async-storage-mock
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const bench: Standard = {
  id: "bench-1",
  type: "bench",
  category: "lifts",
  start: 200,
  target: 300,
  createdAt: "2026-01-01T00:00:00.000Z",
  status: "active",
};

beforeEach(() => {
  jest.clearAllMocks();
  const AsyncStorage = require("@react-native-async-storage/async-storage");
  AsyncStorage.clear();
});

// ── StandardService ──────────────────────────────────────────────────────────

describe("StandardService", () => {
  it("getAll returns [] when empty", async () => {
    expect(await StandardService.getAll()).toEqual([]);
  });

  it("save and getAll round-trips a standard", async () => {
    await StandardService.save(bench);
    const all = await StandardService.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe("bench-1");
  });

  it("save updates an existing standard", async () => {
    await StandardService.save(bench);
    await StandardService.save({ ...bench, target: 350 });
    const all = await StandardService.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].target).toBe(350);
  });

  it("getById returns correct standard", async () => {
    await StandardService.save(bench);
    expect((await StandardService.getById("bench-1"))?.id).toBe("bench-1");
    expect(await StandardService.getById("nope")).toBeNull();
  });

  it("remove deletes a standard", async () => {
    await StandardService.save(bench);
    await StandardService.remove("bench-1");
    expect(await StandardService.getAll()).toHaveLength(0);
  });

  it("create returns a standard with generated id", async () => {
    const s = await StandardService.create("ohp", 100, 150);
    expect(s.type).toBe("ohp");
    expect(s.start).toBe(100);
    const all = await StandardService.getAll();
    expect(all).toHaveLength(1);
  });
});

// ── TrainingService ──────────────────────────────────────────────────────────

describe("TrainingService", () => {
  it("get returns null when no state", async () => {
    expect(await TrainingService.get("bench-1")).toBeNull();
  });

  it("init creates week 1 state", async () => {
    const state = await TrainingService.init("bench-1", 180);
    expect(state).toEqual({ standardId: "bench-1", trainingMax: 180, cycle: 1, week: 1 });
  });

  it("advanceWeek increments week", async () => {
    await TrainingService.init("bench-1", 180);
    const next = await TrainingService.advanceWeek("bench-1", 185);
    expect(next.week).toBe(2);
    expect(next.cycle).toBe(1);
    expect(next.trainingMax).toBe(180); // TM only updates on new cycle
  });

  it("advanceWeek from week 4 rolls to cycle 2 week 1 with new TM", async () => {
    await TrainingService.save({ standardId: "bench-1", trainingMax: 180, cycle: 1, week: 4 });
    const next = await TrainingService.advanceWeek("bench-1", 185);
    expect(next.week).toBe(1);
    expect(next.cycle).toBe(2);
    expect(next.trainingMax).toBe(185);
  });

  it("remove clears state", async () => {
    await TrainingService.init("bench-1", 180);
    await TrainingService.remove("bench-1");
    expect(await TrainingService.get("bench-1")).toBeNull();
  });
});

// ── SessionService ───────────────────────────────────────────────────────────

describe("SessionService", () => {
  it("getAll returns [] when empty", async () => {
    expect(await SessionService.getAll("bench-1")).toEqual([]);
  });

  it("log appends a session entry", async () => {
    const entry = await SessionService.log("bench-1", 1, 1, 0);
    expect(entry.standardId).toBe("bench-1");
    expect(entry.cycle).toBe(1);
    const all = await SessionService.getAll("bench-1");
    expect(all).toHaveLength(1);
  });

  it("log appends multiple entries", async () => {
    await SessionService.log("bench-1", 1, 1, 0);
    await SessionService.log("bench-1", 1, 1, 1);
    expect((await SessionService.getAll("bench-1"))).toHaveLength(2);
  });

  it("removeAll clears sessions", async () => {
    await SessionService.log("bench-1", 1, 1, 0);
    await SessionService.removeAll("bench-1");
    expect(await SessionService.getAll("bench-1")).toHaveLength(0);
  });
});

// ── ExportService ────────────────────────────────────────────────────────────

const training: TrainingState = { standardId: "bench-1", trainingMax: 180, cycle: 1, week: 2 };
const session: SessionLog = {
  id: "s1",
  standardId: "bench-1",
  cycle: 1,
  week: 1,
  sessionIndex: 0,
  completedAt: "2026-03-01T10:00:00.000Z",
};
const exportData = { standards: [bench], training: [training], sessions: [session] };

describe("ExportService.toMarkdown", () => {
  it("includes standard label and values", () => {
    const md = ExportService.toMarkdown(exportData);
    expect(md).toContain("Bench Press");
    expect(md).toContain("200");
    expect(md).toContain("300");
  });

  it("includes training max and week", () => {
    const md = ExportService.toMarkdown(exportData);
    expect(md).toContain("180");
    expect(md).toContain("| 2 |");
  });

  it("includes session date", () => {
    const md = ExportService.toMarkdown(exportData);
    expect(md).toContain("2026-03-01");
  });
});

describe("ExportService.toCSV", () => {
  it("produces comma-separated rows", () => {
    const csv = ExportService.toCSV(exportData);
    expect(csv).toContain("Bench Press,200,300");
    expect(csv).toContain("Bench Press,180,1,2");
    expect(csv).toContain("2026-03-01");
  });

  it("has section headers", () => {
    const csv = ExportService.toCSV(exportData);
    expect(csv).toContain("STANDARDS");
    expect(csv).toContain("TRAINING STATE");
    expect(csv).toContain("SESSION LOG");
  });
});
