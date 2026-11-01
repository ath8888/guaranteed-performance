import type { SessionLog, Standard, TrainingState } from "./types";
import { ENGINES } from "./registry";
import { estimate1RM, roundLb } from "./shared";

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

// When the current plan week started: the latest log from an earlier week (the week advances when
// its last card is logged), or the standard's creation date before any week is finished.
export function currentWeekStart(s: Standard, t: TrainingState, logs: SessionLog[]): Date {
  let start = new Date(s.createdAt);
  for (const l of logs) {
    if (l.cycle === t.cycle && l.week === t.week) continue;
    const d = new Date(l.completedAt);
    if (d > start) start = d;
  }
  return start;
}

// Estimated completion date: finish the current cycle (TM increases at the start of the next one),
// then 4 weeks per further increase, based on CURRENT (implied TM = CURRENT × 0.9).
// Anchored to when the current week started, so it only moves when the user gets ahead or falls
// behind (an overdue week is counted as ending today). Returns null when the target is already reached.
export function estCompletionDate(s: Standard, t: TrainingState, logs: SessionLog[] = [], now = new Date()): Date | null {
  const engine = ENGINES[s.type];
  const current = currentValue(s, t, logs);
  let weeks: number;
  if (engine.estWeeksToTarget) {
    weeks = engine.estWeeksToTarget(s, t, current);
    if (weeks === 0) return null;
  } else {
    const waves = wavesToTarget(s, current * 0.9);
    if (waves === 0) return null;
    weeks = (5 - t.week) + (waves - 1) * 4;
  }
  const weekEnd = currentWeekStart(s, t, logs);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const d = weekEnd > now ? weekEnd : new Date(now);
  d.setDate(d.getDate() + (weeks - 1) * 7);
  return d;
}

// Barbell CURRENT: est. 1RM from the TM, raised by the best e1RM of the main-lift top set logged in
// weeks 2–3 of this cycle (week 1 and deload ignored; supplemental work isn't sessionIndex 0).
// Only rises within a cycle; resets to the new TM when the cycle ends.
function barbellCurrent(t: TrainingState, logs: SessionLog[]): number {
  let best = roundLb(t.trainingMax / 0.9);
  for (const l of logs) {
    if (l.cycle !== t.cycle || l.sessionIndex !== 0 || (l.week !== 2 && l.week !== 3) || l.skipped) continue;
    const top = l.sets?.[l.sets.length - 1];
    if (top?.weight == null || !top.reps) continue;
    best = Math.max(best, roundLb(estimate1RM(top.weight, top.reps)));
  }
  return best;
}

// "Current" shown in the UI: see barbellCurrent; calisthenics engines supply their own.
export function currentValue(s: Standard, t: TrainingState | null, logs: SessionLog[] = []): number {
  if (!t) return s.start;
  const engine = ENGINES[s.type];
  return engine.currentValue ? engine.currentValue(s, t) : barbellCurrent(t, logs);
}

// True when every session in the current week has a log (completed or skipped).
export function isWeekComplete(s: Standard, t: TrainingState, logs: SessionLog[]): boolean {
  const count = ENGINES[s.type].buildWeek(s, t).length;
  for (let i = 0; i < count; i++) {
    if (!logs.some((l) => l.cycle === t.cycle && l.week === t.week && l.sessionIndex === i)) return false;
  }
  return true;
}

export function estCompletionLabel(s: Standard, t: TrainingState | null, logs: SessionLog[] = []): string {
  if (!t) return "—";
  const d = estCompletionDate(s, t, logs);
  return d ? fmtDate(d).toUpperCase() : "REACHED";
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
