import { get, set, createStore } from "idb-keyval";
import type { Standard, TrainingState, CheckIn, SessionLog, SetActual } from "./types";
import { progressTrainingMax, wendlerNextTM, etaDate, buildWeek } from "./plan";

const store = typeof indexedDB !== "undefined" ? createStore("gs-db", "kv") : undefined;

async function read<T>(key: string, fallback: T): Promise<T> {
  if (!store) return fallback;
  const v = await get<T>(key, store);
  return v ?? fallback;
}
async function write<T>(key: string, value: T) {
  if (!store) return;
  await set(key, value, store);
}

const K = {
  standards: "standards",
  training: "training",
  checkins: "checkins",
  sessions: "sessions",
  draft: "setup-draft",
};

// ---------- Setup draft ----------
export const draftService = {
  async get<T>(): Promise<T | undefined> {
    return read<T | undefined>(K.draft, undefined);
  },
  async save<T>(value: T) {
    await write(K.draft, value);
  },
  async clear() {
    await write(K.draft, undefined);
  },
};

// ---------- Standards ----------
export const standardService = {
  async list(): Promise<Standard[]> {
    return read<Standard[]>(K.standards, []);
  },
  async save(s: Standard) {
    const all = await this.list();
    const i = all.findIndex(x => x.id === s.id);
    if (i >= 0) all[i] = s; else all.push(s);
    await write(K.standards, all);
  },
  async remove(id: string) {
    const all = (await this.list()).filter(s => s.id !== id);
    await write(K.standards, all);
  },
};

// ---------- Training ----------
export const trainingService = {
  async getAll(): Promise<TrainingState[]> {
    return read<TrainingState[]>(K.training, []);
  },
  async get(standardId: string): Promise<TrainingState | undefined> {
    return (await this.getAll()).find(t => t.standardId === standardId);
  },
  async save(t: TrainingState) {
    const all = await this.getAll();
    const i = all.findIndex(x => x.standardId === t.standardId);
    if (i >= 0) all[i] = t; else all.push(t);
    await write(K.training, all);
  },
  async remove(standardId: string) {
    const all = (await this.getAll()).filter(t => t.standardId !== standardId);
    await write(K.training, all);
  },
};

// ---------- Check-ins ----------
export const checkinService = {
  async list(standardId?: string): Promise<CheckIn[]> {
    const all = await read<CheckIn[]>(K.checkins, []);
    return standardId ? all.filter(c => c.standardId === standardId) : all;
  },
  async add(c: CheckIn) {
    const all = await read<CheckIn[]>(K.checkins, []);
    all.push(c);
    await write(K.checkins, all);
  },
  async latest(standardId: string): Promise<CheckIn | undefined> {
    const list = await this.list(standardId);
    return list.sort((a, b) => b.date.localeCompare(a.date))[0];
  },
};

// ---------- Sessions ----------
export const sessionService = {
  async list(standardId?: string): Promise<SessionLog[]> {
    const all = await read<SessionLog[]>(K.sessions, []);
    return standardId ? all.filter(s => s.standardId === standardId) : all;
  },
  async toggle(log: Omit<SessionLog, "id" | "completedAt">) {
    const all = await read<SessionLog[]>(K.sessions, []);
    const match = all.find(s =>
      s.standardId === log.standardId &&
      s.cycle === log.cycle &&
      s.week === log.week &&
      s.sessionIndex === log.sessionIndex
    );
    if (match) {
      const next = all.filter(s => s !== match);
      await write(K.sessions, next);
      return false;
    } else {
      all.push({ ...log, id: crypto.randomUUID(), completedAt: new Date().toISOString() });
      await write(K.sessions, all);
      return true;
    }
  },
  async saveActuals(
    log: Omit<SessionLog, "id" | "completedAt" | "sets">,
    sets: SetActual[]
  ) {
    const all = await read<SessionLog[]>(K.sessions, []);
    const match = all.find(s =>
      s.standardId === log.standardId &&
      s.cycle === log.cycle &&
      s.week === log.week &&
      s.sessionIndex === log.sessionIndex
    );
    if (match) {
      match.sets = sets;
      match.completedAt = new Date().toISOString();
    } else {
      all.push({ ...log, sets, id: crypto.randomUUID(), completedAt: new Date().toISOString() });
    }
    await write(K.sessions, all);
  },
  async find(standardId: string, cycle: number, week: number, sessionIndex: number) {
    const all = await this.list(standardId);
    return all.find(s => s.cycle === cycle && s.week === week && s.sessionIndex === sessionIndex);
  },
  async isDone(standardId: string, cycle: number, week: number, sessionIndex: number) {
    const all = await this.list(standardId);
    return all.some(s => s.cycle === cycle && s.week === week && s.sessionIndex === sessionIndex);
  },
}; 

// ---------- Derived ----------
/** Current value = latest check-in if any, else baseline (locked at setup). */
export async function currentValue(s: Standard): Promise<number> {
  const latest = await checkinService.latest(s.id);
  return latest?.value ?? s.baseline;
}

/**
 * Advance to the next wave week. After Week 4, increment cycle and bump
 * training max per `progressTrainingMax`. For runs, pass the latest 3-mile
 * test time (seconds) as `amrapValue` so the new pace can be derived.
 */
export async function advanceWave(s: Standard, amrapValue?: number) {
  const t = await trainingService.get(s.id);
  if (!t) return;
  if (t.week < 4) {
    await trainingService.save({ ...t, week: (t.week + 1) as 1 | 2 | 3 | 4 });
    return;
  }
  let nextTM = t.trainingMax;
  if (s.type === "run3mi") {
    nextTM = progressTrainingMax(s, t.trainingMax, amrapValue);
  } else {
    // Find Week 3 main session's AMRAP (last set) actual reps from this cycle.
    const week3Sessions = buildWeek(s, { ...t, week: 3 });
    const mainIdx = week3Sessions.findIndex(x => x.kind === "main");
    if (mainIdx >= 0) {
      const log = await sessionService.find(s.id, t.cycle, 3, mainIdx);
      const lastSet = log?.sets?.[log.sets.length - 1];
      nextTM = wendlerNextTM(s, t.trainingMax, lastSet?.reps);
    }
  }
  await trainingService.save({
    standardId: s.id,
    trainingMax: nextTM,
    cycle: t.cycle + 1,
    week: 1,
  });
  const newCurrent = s.type === "run3mi" && amrapValue
    ? amrapValue
    : await currentValue(s);
  const eta = etaDate(s, newCurrent);
  await standardService.save({
    ...s,
    // Never overwrite `deadlineDate` — it's the user's real test date.
    estCompletionDate: eta ? eta.toISOString() : undefined,
  });
}

export async function resetAll() {
  await write(K.standards, []);
  await write(K.training, []);
  await write(K.checkins, []);
  await write(K.sessions, []);
}
