export type StandardType = "run3mi" | "pushups" | "pullups" | "bench" | "ohp" | "squat" | "deadlift";

export const STANDARD_META: Record<StandardType, { label: string; short: string; unit: string; kind: "load" | "reps" | "time"; lower: boolean }> = {
  run3mi:   { label: "3-Mile Run",    short: "Run",      unit: "mm:ss", kind: "time", lower: true  },
  pushups:  { label: "Pushups (2 min)", short: "Pushups",  unit: "reps", kind: "reps", lower: false },
  pullups:  { label: "Pull-ups",        short: "Pull-ups", unit: "reps", kind: "reps", lower: false },
  bench:    { label: "Bench Press",   short: "Bench",    unit: "lb",    kind: "load", lower: false },
  ohp:      { label: "Overhead Press",short: "OHP",      unit: "lb",    kind: "load", lower: false },
  squat:    { label: "Squat",         short: "Squat",    unit: "lb",    kind: "load", lower: false },
  deadlift: { label: "Deadlift",      short: "Deadlift", unit: "lb",    kind: "load", lower: false },
};

export interface Standard {
  id: string;
  type: StandardType;
  baseline: number;       // load lb, reps, or time in seconds
  target: number;
  /** Fixed external test date — set once at setup, never overwritten. */
  desiredCompletionDate: string;       // ISO date
  /** Calculated ETA from current progress. Updated as user progresses; informational only. */
  estCompletionDate?: string;   // ISO date
  createdAt: string;
  status: "active" | "archived";
  /**
   * Pull-ups only. Seed data for Day A's weighted Training Max.
   * baseline/target above remain bodyweight rep counts (the actual
   * standard) — this is a separate, one-time measurement used only to
   * estimate a starting added-weight 1RM via Epley. Not used for
   * Guarantee tracking.
   */
  pullupTest?: { bodyweightLb: number; addedLb: number; reps: number };
}

export interface TrainingState {
  standardId: string;
  trainingMax: number;    // load (lb) for lifts; rep TM for pushups; target pace seconds/mile for run
  cycle: number;          // 1-based
  week: 1 | 2 | 3 | 4;
}

export interface CheckIn {
  id: string;
  standardId: string;
  value: number;
  date: string;
}

export interface SetActual { weight?: number; reps?: number }

export interface SessionLog {
  id: string;
  standardId: string;
  cycle: number;
  week: number;
  sessionIndex: number;   // 0..n within the week
  completedAt: string;
  sets?: SetActual[];     // index matches Session.sets order
}
