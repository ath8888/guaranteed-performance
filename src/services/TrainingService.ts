import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CalisthenicsState, TrainingState } from "../engine/types";

const key = (standardId: string) => `training:${standardId}`;

export const TrainingService = {
  async get(standardId: string): Promise<TrainingState | null> {
    const raw = await AsyncStorage.getItem(key(standardId));
    return raw ? JSON.parse(raw) : null;
  },

  async save(state: TrainingState): Promise<void> {
    await AsyncStorage.setItem(key(state.standardId), JSON.stringify(state));
  },

  async remove(standardId: string): Promise<void> {
    await AsyncStorage.removeItem(key(standardId));
  },

  async init(standardId: string, trainingMax: number, cal?: CalisthenicsState): Promise<TrainingState> {
    const state: TrainingState = { standardId, trainingMax, cycle: 1, week: 1, ...(cal ? { cal } : {}) };
    await TrainingService.save(state);
    return state;
  },

  async advanceWeek(standardId: string, nextTM: number): Promise<TrainingState> {
    const current = await TrainingService.get(standardId);
    if (!current) throw new Error(`No training state for ${standardId}`);
    const nextWeek = current.week === 4 ? 1 : ((current.week + 1) as 1 | 2 | 3 | 4);
    const nextCycle = current.week === 4 ? current.cycle + 1 : current.cycle;
    const next: TrainingState = {
      ...current,
      trainingMax: nextWeek === 1 ? nextTM : current.trainingMax,
      week: nextWeek,
      cycle: nextCycle,
    };
    await TrainingService.save(next);
    return next;
  },
};
