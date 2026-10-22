export const WAVE = {
  1: [0.65, 0.75, 0.85],
  2: [0.70, 0.80, 0.90],
  3: [0.75, 0.85, 0.95],
  4: [0.40, 0.50, 0.60],
} as const;

export const REP_SCHEME = {
  1: [5, 5, 5],
  2: [3, 3, 3],
  3: [5, 3, 1],
  4: [5, 5, 5],
} as const;

export function roundLb(x: number) { return Math.round(x / 5) * 5; }

export function fmtValue(v: number): string { return `${v} lb`; }

export function estimate1RM(weight: number, reps: number): number {
  if (reps <= 0) return weight;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export interface PlannedSet {
  weight?: number;
  reps: number;
  amrap?: boolean;
  maxReps?: number; // caps the logged reps on an amrap set (rep-logged set, not all-out)
  note?: string;
}

export interface Session {
  title: string;
  lines: string[];
  sets?: PlannedSet[];
  amrap?: boolean;
  kind?: "main" | "bbb" | "fsl" | "density" | "test" | "strength" | "endurance" | "retest";
  optional?: boolean; // supplemental work the user may SKIP
  recommended?: boolean; // calisthenics: block the plan currently emphasizes
  sessionNo?: number;  // calisthenics: workout number within the week (0 = A, 1 = B, 2 = C)
  restSec?: number;    // rest between sets, display only
}
