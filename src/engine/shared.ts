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

// Nearest 5 lb, exact halves round up (Lifts table, Shared definitions).
// Trims float noise first so 175 × 0.7 (= 122.4999…) rounds as 122.5 → 125.
export function roundLb(x: number) { return Math.round(Math.round(x * 1e6) / 1e6 / 5) * 5; }

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
  // Run: one rep (reps = 1)
  part?: "speed" | "threshold" | "zone2" | "trial";
  distance?: number; // m — speed reps, time trial
  minutes?: number;  // threshold reps, Zone 2
  time?: number;     // target split (s) for distance reps
  pace?: number;     // target pace (s/mi) for timed reps; Zone 2: pace ceiling
  ladder?: boolean;  // counts toward ladder steps
}

export interface Session {
  title: string;
  lines: string[];
  sets?: PlannedSet[];
  amrap?: boolean;
  kind?: "main" | "bbb" |"density" | "test" | "strength" | "endurance" | "backoff" | "intervals" | "zone2" | "trial";
  optional?: boolean; // supplemental work the user may SKIP
  recommended?: boolean; // calisthenics: block the plan currently emphasizes
  sessionNo?: number;  // calisthenics: training day within the week (0 = strength day, 1 = endurance day)
}
