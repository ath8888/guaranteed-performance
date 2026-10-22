import { roundLb, type PlannedSet, type Session } from "./shared";
import type { StandardEngine } from "./registry";

// Olympic Lift category: 5/3/1-style waves, all triples (no all-out sets), optional FSL.
// Percentages are of the training max (TM = 90% of 1RM).
const OLY_WAVE = {
  1: [0.65, 0.75, 0.85],
  2: [0.70, 0.80, 0.90],
  3: [0.75, 0.85, 0.95],
  4: [0.40, 0.50, 0.60],
} as const;

const REPS = 3;
const PER_WAVE = 5;

export function olympicWeek(week: 1 | 2 | 3 | 4, tm: number): Session[] {
  const pcts = OLY_WAVE[week];
  // Top set (set 3) logs reps done, capped at 3, every non-deload week.
  // Only week 3's top set decides TM progression (see cycleEndTM).
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
  if (week === 4) return [main];
  const fslWeight = roundLb(tm * pcts[0]);
  const fslSets: PlannedSet[] = Array.from({ length: 3 }, () => ({ weight: fslWeight, reps: REPS }));
  const fsl: Session = {
    title: "First Set Last",
    lines: [`3 × 3 @ ${fslWeight} lb`],
    sets: fslSets,
    kind: "fsl",
    optional: true,
  };
  return [main, fsl];
}

export const olympicEngine: StandardEngine = {
  buildWeek(s, t) { return olympicWeek(t.week, t.trainingMax); },
  initTrainingMax(s) { return roundLb(s.start * 0.9); },
  progressTrainingMax(s, current) { return current + PER_WAVE; },
  // reps = reps done on week 3's top set (95% × 3)
  nextTM(s, currentTM, reps) {
    if (reps == null) return currentTM;
    if (reps === 0) return roundLb(currentTM * 0.9);
    if (reps < REPS) return currentTM;
    return olympicEngine.progressTrainingMax(s, currentTM);
  },
  wavesToTarget(s, trainingMax) {
    return Math.ceil((s.target * 0.9 - trainingMax) / PER_WAVE);
  },
};
