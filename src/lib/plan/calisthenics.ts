import { WAVE, REP_SCHEME, type PlannedSet, type Session } from "./shared";
import type { StandardEngine } from "./registry";

/**
 * Calisthenics hybrid (pushups): 5/3/1 + density + submaximal frequent exposure.
 * Two sessions per week:
 *   Day A — 5/3/1 Strength Anchor (+ FSL accessory weeks 1–3)
 *   Day B — Adaptive density (+ 2-min test weeks 2–4)
 */
export function pushupWeek(week: 1 | 2 | 3 | 4, repTM: number): Session[] {
  return [...dayA_(week, repTM), ...dayB(week, repTM)];
}

function dayA(week: 1 | 2 | 3 | 4, repTM: number): Session[] | Session {
  const pcts = WAVE[week];
  const reps = REP_SCHEME[week];
  const sets: PlannedSet[] = pcts.map((p, i) => {
    const last = i === pcts.length - 1 && week !== 4;
    return { reps: Math.max(1, Math.round(repTM * p)), amrap: last };
  });
  const main: Session = {
    title: week === 4 ? "Day A — Deload" : "Day A — 5/3/1 Strength",
    lines: sets.map((s, i) => {
      const target = reps[i];
      return `${s.reps} reps${week !== 4 ? ` (target ${target}${s.amrap ? "+" : ""})` : ""}`;
    }),
    sets,
    amrap: week !== 4,
    kind: "main",
  };
  if (week === 4) return main;
  const fslReps = Math.max(1, Math.round(repTM * 0.55));
  const fslSets: PlannedSet[] = Array.from({ length: 3 }, () => ({ reps: fslReps }));
  const fsl: Session = {
    title: "FSL accessory",
    lines: [`3 × ${fslReps} reps · clean, relaxed pace`],
    sets: fslSets,
    kind: "fsl",
  };
  return [main, fsl];
}

function dayA_(week: 1 | 2 | 3 | 4, repTM: number): Session[] {
  const out = dayA(week, repTM);
  return Array.isArray(out) ? out : [out];
}

function dayB(week: 1 | 2 | 3 | 4, repTM: number): Session[] {
  const cfg = {
    1: { sets: 10, coef: 0.22, rest: "30–45 s rest", title: "Day B — Density" },
    2: { sets: 8,  coef: 0.26, rest: "30 s rest",    title: "Day B — Density" },
    3: { sets: 6,  coef: 0.32, rest: "30 s rest",    title: "Day B — Density" },
    4: { sets: 5,  coef: 0.20, rest: "easy",          title: "Day B — Taper" },
  }[week];
  const r = Math.max(1, Math.round(repTM * cfg.coef));
  const dSets: PlannedSet[] = Array.from({ length: cfg.sets }, () => ({ reps: r, note: cfg.rest }));
  const density: Session = {
    title: cfg.title,
    lines: [`${cfg.sets} × ${r} reps · ${cfg.rest}`],
    sets: dSets,
    kind: "density",
  };
  if (week === 1) return [density];

  const testCfg = {
    2: { title: "2-min effort @ ~80%", reps: Math.max(1, Math.round(repTM * 0.80)), amrap: false, note: "Paced — not all-out" },
    3: { title: "2-min test (all-out)", reps: Math.max(1, Math.round(repTM * 1.00)), amrap: true,  note: "Logs as Check-in on save" },
    4: { title: "2-min relaxed @ ~85%", reps: Math.max(1, Math.round(repTM * 0.85)), amrap: false, note: "Paced — not all-out" },
  }[week as 2 | 3 | 4];
  const test: Session = {
    title: testCfg.title,
    lines: [`Target ${testCfg.reps} reps${testCfg.amrap ? "+" : ""} · ${testCfg.note}`],
    sets: [{ reps: testCfg.reps, amrap: testCfg.amrap, note: testCfg.note }],
    amrap: testCfg.amrap,
    kind: "test",
  };
  return [density, test];
}

export { dayA_ as pushupDayA };

export const calisthenicsEngine: StandardEngine = {
  buildWeek(s, t) {
    return pushupWeek(t.week, t.trainingMax);
  },
  initTrainingMax(s) {
    return Math.round(s.baseline * 0.9);
  },
  progressTrainingMax(s, current) {
    return current + 2;
  },
  nextTM(s, currentTM, amrapReps) {
    const prescribed = 1;
    if (amrapReps == null || amrapReps <= 0) return currentTM;
    if (amrapReps < prescribed) return Math.max(1, Math.round(currentTM * 0.9));
    if (amrapReps === prescribed) return currentTM;
    return calisthenicsEngine.progressTrainingMax(s, currentTM);
  },
  wavesToTarget(s, current) {
    const gap = s.target - current;
    const perWave = Math.max(10, Math.round(gap * 0.30));
    return Math.ceil(gap / perWave);
  },
};
