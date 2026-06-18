import { get, set, createStore } from "idb-keyval";
import type { Standard, TrainingState, CheckIn, SessionLog } from "./types";

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
  async isDone(standardId: string, cycle: number, week: number, sessionIndex: number) {
    const all = await this.list(standardId);
    return all.some(s => s.cycle === cycle && s.week === week && s.sessionIndex === sessionIndex);
  },
};

export async function resetAll() {
  await write(K.standards, []);
  await write(K.training, []);
  await write(K.checkins, []);
  await write(K.sessions, []);
}
