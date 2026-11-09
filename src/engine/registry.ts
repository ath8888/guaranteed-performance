import type { SessionLog, Standard, StandardType, TrainingState } from "./types";
import type { Session } from "./shared";

export interface StandardEngine {
  buildWeek(s: Standard, t: TrainingState): Session[];
  initTrainingMax(s: Standard): number;
  progressTrainingMax(s: Standard, current: number): number;
  nextTM(s: Standard, currentTM: number, amrapReps?: number): number;
  wavesToTarget(s: Standard, trainingMax: number): number;
  // Optional: engine-specific end-of-cycle TM rule (default: week 3 top set via nextTM)
  cycleEndTM?(s: Standard, t: TrainingState, logs: SessionLog[]): number;
  // Optional overrides for engines not driven by a barbell training max (e.g. calisthenics)
  currentValue?(s: Standard, t: TrainingState): number;
  estWeeksToTarget?(s: Standard, t: TrainingState, current: number): number; // from the start of the current week; 0 = target reached
}

import { strengthEngine } from "./strength";
import { olympicEngine } from "./olympic";
import { calisthenicsEngine } from "./calisthenics";
import { runEngine } from "./run";

export const ENGINES: Record<StandardType, StandardEngine> = {
  bench:    strengthEngine,
  ohp:      strengthEngine,
  squat:    strengthEngine,
  deadlift: strengthEngine,
  olympic:  olympicEngine,
  pushups:  calisthenicsEngine,
  run800:   runEngine,
  run1_5:   runEngine,
  run3:     runEngine,
  run5:     runEngine,
};
