import type { Standard, TrainingState } from "./types";
import { ENGINES } from "./registry";
import { roundLb } from "./shared";

export function initTrainingMax(s: Standard): number {
  return ENGINES[s.type].initTrainingMax(s);
}

export function progressTrainingMax(s: Standard, current: number): number {
  return ENGINES[s.type].progressTrainingMax(s, current);
}

export function wendlerNextTM(s: Standard, currentTM: number, amrapReps?: number): number {
  return ENGINES[s.type].nextTM(s, currentTM, amrapReps);
}

// Number of training-max increases (one per completed cycle) still needed to reach target.
export function wavesToTarget(s: Standard, trainingMax: number): number {
  const met = roundLb(trainingMax / 0.9) >= s.target;
  if (met) return 0;
  return Math.max(1, ENGINES[s.type].wavesToTarget(s, trainingMax));
}

// Estimated completion date: finish the current cycle (TM increases at the start of the next one),
// then 4 weeks per further increase. Assumes one training week per calendar week and on-plan progress.
// Returns null when the target is already reached.
export function estCompletionDate(s: Standard, t: TrainingState, from = new Date()): Date | null {
  const waves = wavesToTarget(s, t.trainingMax);
  if (waves === 0) return null;
  const weeks = (5 - t.week) + (waves - 1) * 4;
  const d = new Date(from);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

export function estCompletionLabel(s: Standard, t: TrainingState | null): string {
  if (!t) return "—";
  const d = estCompletionDate(s, t);
  return d ? fmtDate(d).toUpperCase() : "REACHED";
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
