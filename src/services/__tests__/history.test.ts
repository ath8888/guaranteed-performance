import { HistoryService, buildHistory, sessionTitle, dayKey } from "../HistoryService";
import { StandardService } from "../StandardService";
import { SessionService } from "../SessionService";
import { monthGrid, groupByDay } from "../../screens/HistoryScreen";
import type { SessionLog, Standard } from "../../engine/types";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const bench: Standard = {
  id: "bench-1", type: "bench", category: "lifts", start: 200, target: 300,
  createdAt: "2026-01-01T00:00:00.000Z", status: "active",
};
const pushups: Standard = {
  id: "pushups-1", type: "pushups", category: "calisthenics", start: 40, target: 80,
  createdAt: "2026-01-01T00:00:00.000Z", status: "active",
};
const snatch: Standard = {
  id: "olympic-1", type: "olympic", name: "Snatch", category: "olympic", start: 150, target: 200,
  createdAt: "2026-01-01T00:00:00.000Z", status: "active",
};

function log(std: Standard, sessionIndex: number, completedAt: string, extra: Partial<SessionLog> = {}): SessionLog {
  return { id: `${std.id}-${completedAt}`, standardId: std.id, cycle: 1, week: 1, sessionIndex, completedAt, ...extra };
}

beforeEach(() => {
  require("@react-native-async-storage/async-storage").clear();
});

describe("sessionTitle", () => {
  it("names lift, olympic and push-up sessions", () => {
    expect(sessionTitle(bench, log(bench, 0, "x"))).toBe("Main lift");
    expect(sessionTitle(bench, log(bench, 0, "x", { week: 4 }))).toBe("Main lift — Deload");
    expect(sessionTitle(bench, log(bench, 1, "x"))).toBe("Boring But Big");
    expect(sessionTitle(snatch, log(snatch, 0, "x"))).toBe("Main lift");
    expect(sessionTitle(pushups, log(pushups, 0, "x"))).toBe("Session A — Strength");
    expect(sessionTitle(pushups, log(pushups, 2, "x"))).toBe("Session B — Endurance");
  });
});

describe("buildHistory", () => {
  it("sorts newest first, drops skipped and unknown-standard logs, uses custom names", () => {
    const logs = [
      log(bench, 0, "2026-10-01T10:00:00.000Z"),
      log(snatch, 0, "2026-10-20T10:00:00.000Z"),
      log(bench, 1, "2026-10-05T10:00:00.000Z", { skipped: true }),
      { ...log(bench, 0, "2026-10-25T10:00:00.000Z"), standardId: "gone" },
    ];
    const h = buildHistory(logs, [bench, snatch]);
    expect(h.map((e) => e.name)).toEqual(["Snatch", "Bench Press"]);
    expect(h[0].day).toBe(dayKey(new Date("2026-10-20T10:00:00.000Z")));
  });
});

describe("HistoryService.getAll", () => {
  it("gathers logs across standards and keeps history of deleted standards", async () => {
    await StandardService.save(bench);
    await StandardService.save(pushups);
    await SessionService.log(bench.id, 1, 1, 0, [{ weight: 180, reps: 5 }]);
    await SessionService.log(pushups.id, 1, 1, 0, [{ weight: 15, reps: 9 }]);

    await HistoryService.rememberDeleted(pushups);
    await StandardService.remove(pushups.id);

    const h = await HistoryService.getAll();
    expect(h).toHaveLength(2);
    expect(h.map((e) => e.name).sort()).toEqual(["Bench Press", "Push-ups"]);
  });
});

describe("calendar helpers", () => {
  it("monthGrid pads to whole Sunday-first weeks", () => {
    const oct = monthGrid(2026, 9); // Oct 1 2026 is a Thursday
    expect(oct.slice(0, 5)).toEqual([null, null, null, null, 1]);
    expect(oct.filter((d) => d !== null)).toHaveLength(31);
    expect(oct.length % 7).toBe(0);
  });

  it("groupByDay keeps order and groups same-day entries", () => {
    const h = buildHistory(
      [
        log(bench, 0, "2026-10-20T18:00:00"),
        log(bench, 1, "2026-10-20T19:00:00"),
        log(bench, 0, "2026-10-13T18:00:00"),
      ],
      [bench]
    );
    const groups = groupByDay(h);
    expect(groups.map((g) => g.day)).toEqual(["2026-10-20", "2026-10-13"]);
    expect(groups[0].entries.map((e) => e.title)).toEqual(["Boring But Big", "Main lift"]);
  });
});
