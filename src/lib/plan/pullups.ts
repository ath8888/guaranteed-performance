import { liftWeek } from "./strength";
import { estimate1RM, roundLb, type PlannedSet, type Session } from "./shared";
import type { Standard } from "../types";
import type { StandardEngine } from "./registry";

/**
 * Pull-ups hybrid. Two genuinely different axes tracked at once:
 *
 *   Day A — weighted 5/3/1 + BBB (reuses strength.ts's liftWeek directly).
 *           TrainingState.trainingMax here = added weight (lb) for a
 *           1-rep max weighted pull-up, NOT bodyweight rep count.
 *
 *   Day B — bodyweight-only, graduated toward a single untimed max-rep
 *           test (the actual fitness-test event), not a timed density
 *           circuit. Week 1: 2 sets @ ~70%, full rest. Week 2: 3 sets
 *           @ ~80%, full rest. Week 3: 1 all-out set — this IS the
 *           Check-in for the Guarantee-tracked bodyweight rep count.
 *           Week 4: 1 light taper set, true deload.
 *
 * Why Day A is percentage-of-added-weight, not percentage-of-total-load:
 * bodyweight is fixed and not something the lifter is "percenting" — the
 * only free variable each week is how much weight goes on the belt. So
 * Training Max is defined as 90% of the ADDED-WEIGHT 1RM specifically,
 * and the standard WAVE percentages apply to that number directly, exactly
 * like a barbell lift.
 */
export function pullupWeek(week: 1 | 2 | 3 | 4, addedWeightTM: number, currentMaxReps: number): Session[] {
  const dayA = liftWeek(week, addedWeightTM).map(relabelDayA);
  const dayB = buildDayB(week, currentMaxReps);
  return [...dayA, dayB];
}

function relabelDayA(s: Session): Session {
  return {
    ...s,
    title: s.title
      .replace("Main lift — Deload", "Day A — Deload")
      .replace("Main lift", "Day A — Weighted")
      .replace("Boring But Big", "Day A — Boring But Big (volume)"),
  };
}

function buildDayB(week: 1 | 2 | 3 | 4, currentMaxReps: number): Session {
  if (week === 1) {
    const reps = Math.max(1, Math.round(currentMaxReps * 0.70));
    return {
      title: "Day B — Build (70%)",
      lines: [`2 sets × ${reps} reps`, "Full rest between sets"],
      sets: Array.from({ length: 2 }, () => ({ reps })),
      kind: "density",
    };
  }
  if (week === 2) {
    const reps = Math.max(1, Math.round(currentMaxReps * 0.80));
    return {
      title: "Day B — Build (80%)",
      lines: [`3 sets × ${reps} reps`, "Full rest between sets"],
      sets: Array.from({ length: 3 }, () => ({ reps })),
      kind: "density",
    };
  }
  if (week === 3) {
    return {
      title: "Day B — Max test (all-out)",
      lines: ["1 set, max reps, unbroken.", "Logs as Check-in on save."],
      sets: [{ reps: currentMaxReps, amrap: true }],
      amrap: true,
      kind: "test",
    };
  }
  const reps = Math.max(1, Math.round(currentMaxReps * 0.5));
  return {
    title: "Day B — Taper",
    lines: [`1 set × ${reps} reps, easy`],
    sets: [{ reps }],
    kind: "density",
  };
}

export const pullupsEngine: StandardEngine = {
  buildWeek(s, t, currentValue) {
    const currentMaxReps = currentValue ?? s.baseline;
    return pullupWeek(t.week, t.trainingMax, currentMaxReps);
  },
  initTrainingMax(s) {
    if (!s.pullupTest) return 0; // Setup enforces this is always present for pullups.
    const { bodyweightLb, addedLb, reps } = s.pullupTest;
    const totalLoad = bodyweightLb + addedLb;
    const estTotal1RM = estimate1RM(totalLoad, reps);
    const estAdded1RM = Math.max(0, estTotal1RM - bodyweightLb);
    return roundLb(estAdded1RM * 0.9);
  },
  progressTrainingMax(s, current) {
    return current + 5; // added-weight progression, matches upper-body lift convention
  },
  nextTM(s, currentTM, amrapReps) {
    const prescribed = 1;
    if (amrapReps == null || amrapReps <= 0) return currentTM;
    if (amrapReps < prescribed) return roundLb(currentTM * 0.9);
    if (amrapReps === prescribed) return currentTM;
    return pullupsEngine.progressTrainingMax(s, currentTM);
  },
  wavesToTarget(s, current) {
    // Calibrated conservatively for advanced-range gains (e.g. 21→30 reps);
    // a judgment-call estimate, not an empirically derived constant.
    const gap = s.target - current;
    const perWave = Math.max(2, Math.round(gap * 0.4));
    return Math.ceil(gap / perWave);
  },
};
