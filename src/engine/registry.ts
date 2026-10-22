import type { Standard, StandardType, TrainingState } from "./types";
import type { Session } from "./shared";

export interface StandardEngine {
  buildWeek(s: Standard, t: TrainingState): Session[];
  initTrainingMax(s: Standard): number;
  progressTrainingMax(s: Standard, current: number): number;
  nextTM(s: Standard, currentTM: number, amrapReps?: number): number;
  wavesToTarget(s: Standard, trainingMax: number): number;
}

import { strengthEngine } from "./strength";
import { olympicEngine } from "./olympic";

export const ENGINES: Record<StandardType, StandardEngine> = {
  bench:    strengthEngine,
  ohp:      strengthEngine,
  squat:    strengthEngine,
  deadlift: strengthEngine,
  olympic:  olympicEngine,
};
