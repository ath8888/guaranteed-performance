import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SessionLog, SetActual } from "../engine/types";

const key = (standardId: string) => `sessions:${standardId}`;

export const SessionService = {
  async getAll(standardId: string): Promise<SessionLog[]> {
    const raw = await AsyncStorage.getItem(key(standardId));
    return raw ? JSON.parse(raw) : [];
  },

  async log(
    standardId: string,
    cycle: number,
    week: number,
    sessionIndex: number,
    sets?: SetActual[]
  ): Promise<SessionLog> {
    const entry: SessionLog = {
      id: `${standardId}-${cycle}-${week}-${sessionIndex}-${Date.now()}`,
      standardId,
      cycle,
      week,
      sessionIndex,
      completedAt: new Date().toISOString(),
      sets,
    };
    const all = await SessionService.getAll(standardId);
    all.push(entry);
    await AsyncStorage.setItem(key(standardId), JSON.stringify(all));
    return entry;
  },

  async removeAll(standardId: string): Promise<void> {
    await AsyncStorage.removeItem(key(standardId));
  },
};
