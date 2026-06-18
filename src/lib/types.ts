export type StandardType = "run3mi" | "pushups" | "bench" | "ohp" | "squat" | "deadlift";

export const STANDARD_META: Record<StandardType, { label: string; short: string; unit: string; kind: "load" | "reps" | "time"; lower: boolean }> = {
  run3mi:   { label: "3-Mile Run",    short: "Run",      unit: "mm:ss", kind: "time", lower: true  },
  pushups:  { label: "Pushups (2 min)", short: "Pushups", unit: "reps",  kind: "reps", lower: false },
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
  deadline: string;       // ISO date
  createdAt: string;
  status: "active" | "archived";
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
