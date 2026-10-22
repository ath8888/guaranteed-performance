import type { Standard, StandardType, TrainingState } from "./types";
import type { Session } from "./shared";

export interface StandardEngine {
  buildWeek(s: Standard, t: TrainingState): Session[];
  initTrainingMax(s: Standard): number;
  progressTrainingMax(s: Standard, current: number): number;
  nextTM(s: Standard, currentTM: number, amrapReps?: number): number;
  wavesToTarget(s: Standard, trainingMax: number): number;
  // Optional overrides for engines not driven by a barbell training max (e.g. calisthenics)
  currentValue?(s: Standard, t: TrainingState): number;
  estWeeksToTarget?(s: Standard, t: TrainingState): number; // 0 = target reached
}

import { strengthEngine } from "./strength";
import { olympicEngine } from "./olympic";
import { calisthenicsEngine } from "./calisthenics";

export const ENGINES: Record<StandardType, StandardEngine> = {
  bench:    strengthEngine,
  ohp:      strengthEngine,
  squat:    strengthEngine,
  deadlift: strengthEngine,
  olympic:  olympicEngine,
  pushups:  calisthenicsEngine,
};
