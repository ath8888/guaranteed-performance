import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SessionLog, Standard } from "../engine/types";
import { STANDARD_META } from "../engine/types";
import { StandardService } from "./StandardService";
import { runSessionTitle } from "../engine/run";

// Standards deleted from Home: kept so their session logs still show in History.
const DELETED_KEY = "deletedStandards";
const SESSIONS_PREFIX = "sessions:";

export interface HistoryEntry {
  log: SessionLog;
  name: string; // standard's display name
  title: string; // session title, e.g. "Main lift", "Session B — Endurance"
  day: string; // local date, YYYY-MM-DD
}

// Mirrors the engines' session order: lifts [main, BBB], olympic [main], push-ups [A strength, B endurance, B endurance],
// run [A, B — Zone 2, A] (week 4: Time Trial, B, A).
export function sessionTitle(std: Standard, log: SessionLog): string {
  if (std.category === "run") return runSessionTitle(std, log.week, log.sessionIndex);
  if (std.category === "calisthenics") {
    return log.sessionIndex === 0 ? "Session A — Strength" : "Session B — Endurance";
  }
  if (std.category === "lifts" && log.sessionIndex === 1) return "Boring But Big";
  return log.week === 4 ? "Main lift — Deload" : "Main lift";
}

export function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// Completed (not skipped) workouts, newest first. Logs whose standard is unknown are dropped.
export function buildHistory(logs: SessionLog[], standards: Standard[]): HistoryEntry[] {
  const byId = new Map(standards.map((s) => [s.id, s]));
  const entries: HistoryEntry[] = [];
  for (const log of logs) {
    if (log.skipped) continue;
    const std = byId.get(log.standardId);
    if (!std) continue;
    entries.push({
      log,
      name: std.name ?? STANDARD_META[std.type].label,
      title: sessionTitle(std, log),
      day: dayKey(new Date(log.completedAt)),
    });
  }
  return entries.sort((a, b) => b.log.completedAt.localeCompare(a.log.completedAt));
}

export const HistoryService = {
  async getDeleted(): Promise<Standard[]> {
    const raw = await AsyncStorage.getItem(DELETED_KEY);
    return raw ? JSON.parse(raw) : [];
  },

  async rememberDeleted(std: Standard): Promise<void> {
    const all = await HistoryService.getDeleted();
    await AsyncStorage.setItem(DELETED_KEY, JSON.stringify([...all.filter((s) => s.id !== std.id), std]));
  },

  async getAll(): Promise<HistoryEntry[]> {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(SESSIONS_PREFIX));
    const pairs = await AsyncStorage.multiGet(keys);
    const logs: SessionLog[] = pairs.flatMap(([, raw]) => (raw ? JSON.parse(raw) : []));
    const standards = [...(await StandardService.getAll()), ...(await HistoryService.getDeleted())];
    return buildHistory(logs, standards);
  },
};
