import { STANDARD_META, type Standard } from "../types";
import { roundLb } from "./shared";

export function initTrainingMax(s: Standard): number {
  if (s.type === "run3mi") {
    // current pace = baseline time / 3 (seconds per mile)
    return Math.round(s.baseline / 3);
  }
  if (s.type === "pushups") return Math.round(s.baseline * 0.9);
  return roundLb(s.baseline * 0.9);
}

export function progressTrainingMax(s: Standard, current: number, amrapValue?: number): number {
  if (s.type === "run3mi") {
    if (amrapValue && amrapValue > 0) return Math.round(amrapValue / 3);
    return current;
  }
  if (s.type === "pushups") return current + 2;
  if (s.type === "bench" || s.type === "ohp") return current + 5;
  return current + 10;
}

/**
 * Wendler decision from Week 3 Day A top-set AMRAP:
 *   reps >= prescribed + 1 → bump TM
 *   reps == prescribed     → hold
 *   reps <  prescribed     → reset TM * 0.9
 */
export function wendlerNextTM(s: Standard, currentTM: number, amrapReps?: number): number {
  if (s.type === "run3mi") return currentTM;
  const prescribed = 1;
  if (amrapReps == null || amrapReps <= 0) return currentTM;
  if (amrapReps < prescribed) {
    if (s.type === "pushups") return Math.max(1, Math.round(currentTM * 0.9));
    return roundLb(currentTM * 0.9);
  }
  if (amrapReps === prescribed) return currentTM;
  return progressTrainingMax(s, currentTM);
}

export function wavesToTarget(s: Standard, currentValue: number): number {
  const meta = STANDARD_META[s.type];
  const met = meta.lower ? currentValue <= s.target : currentValue >= s.target;
  if (met) return 0;
  switch (s.type) {
    case "bench":
    case "ohp":      return Math.ceil((s.target - currentValue) / 5);
    case "squat":
    case "deadlift": return Math.ceil((s.target - currentValue) / 10);
    case "pushups":  return Math.ceil((s.target - currentValue) / 2);
    case "run3mi": {
      const curPace = currentValue / 3;
      const tgtPace = s.target / 3;
      return Math.max(1, Math.ceil((curPace - tgtPace) / 5));
    }
  }
}

export function etaDate(s: Standard, currentValue: number, from = new Date()): Date | null {
  const waves = wavesToTarget(s, currentValue);
  if (waves === 0) return null;
  const d = new Date(from);
  d.setDate(d.getDate() + waves * 28);
  return d;
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
