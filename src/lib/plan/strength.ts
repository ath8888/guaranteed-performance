import { WAVE, REP_SCHEME, roundLb, type PlannedSet, type Session } from "./shared";
import type { StandardType } from "../types";
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
  };
  return [main, bbb];
}

function isUpperBody(type: StandardType): boolean {
  return type === "bench" || type === "ohp";
}

export const strengthEngine: StandardEngine = {
  buildWeek(s, t) {
    return liftWeek(t.week, t.trainingMax);
  },
  initTrainingMax(s) {
    return roundLb(s.baseline * 0.9);
  },
  progressTrainingMax(s, current) {
    return isUpperBody(s.type) ? current + 5 : current + 10;
  },
  nextTM(s, currentTM, amrapReps) {
    const prescribed = 1;
    if (amrapReps == null || amrapReps <= 0) return currentTM;
    if (amrapReps < prescribed) return roundLb(currentTM * 0.9);
    if (amrapReps === prescribed) return currentTM;
    return strengthEngine.progressTrainingMax(s, currentTM);
  },
  wavesToTarget(s, current) {
    const perWave = isUpperBody(s.type) ? 5 : 10;
    return Math.ceil((s.target - current) / perWave);
  },
};
