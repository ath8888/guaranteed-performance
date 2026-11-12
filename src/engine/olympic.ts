import { roundLb, type PlannedSet, type Session } from "./shared";
import type { StandardEngine } from "./registry";
import type { SessionLog, TrainingState } from "./types";
import { liftCurrent, liftTM } from "./strength";

// Decision table: decision-tables/olympic-lifts.md
// CURRENT is the source of truth. TM = 90% of CURRENT, rounded. CURRENT changes once per cycle, when week 3 is finished (O3).

// Olympic Lift category: 5/3/1-style waves, all triples (no all-out sets), main lift only.
// Percentages are of the training max (TM = 90% of CURRENT).
const OLY_WAVE = {
  1: [0.65, 0.75, 0.85],
  2: [0.70, 0.80, 0.90],
  3: [0.75, 0.85, 0.95],
  4: [0.40, 0.50, 0.60],
} as const;

const REPS = 3;
const PER_CYCLE = 5; // O3-R3: CURRENT + 5 lb
export const OLY_PROGRESS_WEEK = 3; // O3: CURRENT moves when week 3 is finished

// O3 runs once per cycle: at the end of week 3. A state saved before v0.8 that was already in
// week 4 (so it missed the week 3 check) gets O3 at the end of week 4 instead.
export function olympicDueForProgress(t: TrainingState): boolean {
  if (t.olyProgressCycle === t.cycle) return false;
  return t.week === OLY_PROGRESS_WEEK || t.week === 4;
}

export function olympicWeek(week: 1 | 2 | 3 | 4, tm: number): Session[] {
  const pcts = OLY_WAVE[week];
  // Top set (set 3) logs reps done, capped at 3, every non-deload week.
  // Top sets never move CURRENT mid-cycle; they are judged when week 3 is finished (see olympicCurrentAtCycleEnd).
  const sets: PlannedSet[] = pcts.map((p, i) => {
    const logged = week !== 4 && i === pcts.length - 1;
    return { weight: roundLb(tm * p), reps: REPS, ...(logged ? { amrap: true, maxReps: REPS } : {}) };
  });
  const main: Session = {
    title: week === 4 ? "Main lift — Deload" : "Main lift",
    lines: sets.map(s => `${s.weight} lb × ${s.reps}`),
    sets,
    amrap: week !== 4,
    kind: "main",
  };
  return [main];
}

function topSetReps(logs: SessionLog[], cycle: number, week: number): number | undefined {
  const main = logs.find((l) => l.cycle === cycle && l.week === week && l.sessionIndex === 0 && !l.skipped);
  return main?.sets?.[main.sets.length - 1]?.reps;
}

// O3: CURRENT at cycle end. Rows checked in order R1 → R3. Weeks 1–3 top sets are all judged.
export function olympicCurrentAtCycleEnd(current: number, logs: SessionLog[], cycle: number): number {
  if (topSetReps(logs, cycle, 3) == null) return current;           // O3-R1: week 3 not logged → hold
  for (const w of [1, 2, 3]) {
    const reps = topSetReps(logs, cycle, w);
    if (reps != null && reps < REPS) return current;                // O3-R2: any logged top set under 3 → hold
  }
  return current + PER_CYCLE;                                       // O3-R3: all triples → +5
}

export const olympicEngine: StandardEngine = {
  buildWeek(s, t) { return olympicWeek(t.week, t.trainingMax); },
  initTrainingMax(s) { return liftTM(s.start); },                   // O1: CURRENT = START
  progressWeek: OLY_PROGRESS_WEEK,
  progressTrainingMax(s, current) { return current + PER_CYCLE; },
  nextTM(s, currentTM) { return currentTM; },                       // unused: TM moves through CURRENT
  cycleEndTM(s, t: TrainingState, logs) { return liftTM(olympicCurrentAtCycleEnd(liftCurrent(t), logs, t.cycle)); },
  currentValue(s, t) { return liftCurrent(t); },
  // Cycles until CURRENT reaches target at +5 per cycle
  wavesToTarget(s, trainingMax) {
    return Math.ceil((s.target * 0.9 - trainingMax) / (PER_CYCLE * 0.9));
  },
};
