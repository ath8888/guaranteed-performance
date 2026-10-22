import type { SessionLog, Standard, TrainingState } from "./types";
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

// TM for the next cycle: decided only by the reps logged on this cycle's week 3 main-lift top set.
// No week 3 log (or no reps) → TM holds.
export function cycleEndTM(s: Standard, t: TrainingState, logs: SessionLog[]): number {
  const week3Main = logs.find((l) => l.cycle === t.cycle && l.week === 3 && l.sessionIndex === 0);
  const lastSet = week3Main?.sets?.[week3Main.sets.length - 1];
  return wendlerNextTM(s, t.trainingMax, lastSet?.reps);
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
  const engine = ENGINES[s.type];
  let weeks: number;
  if (engine.estWeeksToTarget) {
    weeks = engine.estWeeksToTarget(s, t);
    if (weeks === 0) return null;
  } else {
    const waves = wavesToTarget(s, t.trainingMax);
    if (waves === 0) return null;
    weeks = (5 - t.week) + (waves - 1) * 4;
  }
  const d = new Date(from);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

// "Current" shown in the UI: estimated 1RM for barbell engines, latest max reps for calisthenics.
export function currentValue(s: Standard, t: TrainingState | null): number {
  if (!t) return s.start;
  const engine = ENGINES[s.type];
  return engine.currentValue ? engine.currentValue(s, t) : roundLb(t.trainingMax / 0.9);
}

// True when every session in the current week has a log (completed or skipped).
export function isWeekComplete(s: Standard, t: TrainingState, logs: SessionLog[]): boolean {
  const count = ENGINES[s.type].buildWeek(s, t).length;
  for (let i = 0; i < count; i++) {
    if (!logs.some((l) => l.cycle === t.cycle && l.week === t.week && l.sessionIndex === i)) return false;
  }
  return true;
}

export function estCompletionLabel(s: Standard, t: TrainingState | null): string {
  if (!t) return "—";
  const d = estCompletionDate(s, t);
  return d ? fmtDate(d).toUpperCase() : "REACHED";
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
