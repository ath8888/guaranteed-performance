import { WAVE, REP_SCHEME, roundLb, type PlannedSet, type Session } from "./shared";
import type { SessionLog, Standard, TrainingState } from "./types";
import type { StandardEngine } from "./registry";

export function liftWeek(week: 1 | 2 | 3 | 4, tm: number): Session[] {
  const pcts = WAVE[week];
  const reps = REP_SCHEME[week];
  const sets: PlannedSet[] = pcts.map((p, i) => {
    const last = i === pcts.length - 1 && week !== 4;
    return { weight: roundLb(tm * p), reps: reps[i], amrap: last };
  });
  const main: Session = {
    title: week === 4 ? "Main lift — Deload" : "Main lift",
    lines: sets.map(s => `${s.weight} lb × ${s.reps}${s.amrap ? "+" : ""}`),
    sets,
    amrap: week !== 4,
    kind: "main",
  };
  if (week === 4) return [main];
  const bbbWeight = roundLb(tm * 0.5);
  const bbbSets: PlannedSet[] = Array.from({ length: 5 }, () => ({ weight: bbbWeight, reps: 10 }));
  const bbb: Session = {
    title: "Boring But Big",
    lines: [`5 × 10 @ ${bbbWeight} lb`],
    sets: bbbSets,
    kind: "bbb",
    optional: true,
  };
  return [main, bbb];
}

// Decision table: decision-tables/lifts.md
// CURRENT is the source of truth. TM = 90% of CURRENT, rounded, whenever CURRENT changes.

// Minimum reps on each + set (week 1: 5, week 2: 3, week 3: 1)
export const MIN_REPS: Record<number, number> = { 1: 5, 2: 3, 3: 1 };
export const REP_CAP = 10; // reps above 10 count as 10 in the estimate

// Cycle-end increase (L5)
const INCREASE_LB: Record<string, number> = { squat: 10, deadlift: 10, bench: 5, ohp: 5 };

export function liftTM(current: number): number { return roundLb(current * 0.9); }

// Stored CURRENT; states saved before CURRENT was stored fall back to TM / 0.9.
export function liftCurrent(t: TrainingState): number { return t.current ?? roundLb(t.trainingMax / 0.9); }

// L4: CURRENT after a logged + set (weeks 1–3). Rows checked in order.
export function currentAfterTopSet(current: number, week: number, weight: number, reps: number): number {
  const min = MIN_REPS[week];
  if (min == null) return current;                                            // deload: no + set
  if (reps < min) return roundLb(current * 0.9);                              // L4-R1: miss → −10%
  const estimate = roundLb(weight * (1 + Math.min(reps, REP_CAP) / 30));
  return Math.max(current, estimate);                                         // L4-R2 / R3
}

// L5: CURRENT at cycle end. Increase only if the week 3 + set was logged.
export function currentAtCycleEnd(s: Standard, current: number, logs: SessionLog[], cycle: number): number {
  const w3 = logs.find((l) => l.cycle === cycle && l.week === 3 && l.sessionIndex === 0 && !l.skipped);
  const reps = w3?.sets?.[w3.sets.length - 1]?.reps;
  if (reps == null) return current;                                           // L5-R1
  return current + INCREASE_LB[s.type];                                       // L5-R2 to R5
}

export const strengthEngine: StandardEngine = {
  buildWeek(s, t) { return liftWeek(t.week, t.trainingMax); },
  initTrainingMax(s) { return liftTM(s.start); },                           // L1: CURRENT = START
  progressTrainingMax(s, current) { return current + INCREASE_LB[s.type]; },
  nextTM(s, currentTM) { return currentTM; },                                // unused: lifts move TM through CURRENT
  cycleEndTM(s, t, logs) { return liftTM(currentAtCycleEnd(s, liftCurrent(t), logs, t.cycle)); },
  currentValue(s, t) { return liftCurrent(t); },
  // Cycles until CURRENT reaches target at the fixed increase (AMRAP gains not projected)
  wavesToTarget(s, trainingMax) {
    return Math.ceil((s.target * 0.9 - trainingMax) / (INCREASE_LB[s.type] * 0.9));
  },
};
