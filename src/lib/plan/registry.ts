import type { Standard, StandardType, TrainingState } from "../types";
import type { Session } from "./shared";

/**
 * Every standard type implements this interface in exactly one file.
 * To add a new standard: write one file exporting an engine that
 * satisfies this shape, then add one line to ENGINES below.
 * No other file in the plan engine needs to change.
 *
 * `currentValue` on buildWeek is optional and only meaningful for
 * standards whose Day B (or equivalent) needs the live current value
 * of the Guarantee-tracked metric, separate from trainingMax — e.g.
 * pull-ups, where trainingMax tracks added weight but Day B needs the
 * current bodyweight rep count. Engines that don't need it just omit
 * the parameter; TypeScript allows a function with fewer parameters
 * to satisfy an interface that declares more (optional) ones.
 */
export interface StandardEngine {
  buildWeek(s: Standard, t: TrainingState, currentValue?: number): Session[];
  initTrainingMax(s: Standard): number;
  progressTrainingMax(s: Standard, current: number, amrapValue?: number): number;
  nextTM(s: Standard, currentTM: number, amrapReps?: number): number;
  wavesToTarget(s: Standard, currentValue: number): number;
}

import { strengthEngine } from "./strength";
import { calisthenicsEngine } from "./calisthenics";
import { runEngine } from "./run";

export const ENGINES: Record<StandardType, StandardEngine> = {
  bench: strengthEngine,
  ohp: strengthEngine,
  squat: strengthEngine,
  deadlift: strengthEngine,
  pushups: calisthenicsEngine,
  run3mi: runEngine,
};
