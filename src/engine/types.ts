export type StandardType = "bench" | "ohp" | "squat" | "deadlift";

// Future categories: "cardio" | "olympics" | ... — each will have its own progression engine
export type StandardCategory = "lifts";

export const STANDARD_META: Record<StandardType, { label: string; short: string; unit: string; kind: "load"; lower: false }> = {
  bench:    { label: "Bench Press",    short: "Bench",    unit: "lb", kind: "load", lower: false },
  ohp:      { label: "Overhead Press", short: "OHP",      unit: "lb", kind: "load", lower: false },
  squat:    { label: "Squat",          short: "Squat",    unit: "lb", kind: "load", lower: false },
  deadlift: { label: "Deadlift",       short: "Deadlift", unit: "lb", kind: "load", lower: false },
};

// Standard field definitions (displayed in UI as Start / Current / Target):
//   start       (UI: "Start")   — the 1RM the user entered when adding the standard; never changes
//   trainingMax                 — internal training max = 90% of estimated 1RM; used to calculate working sets
//   Current (derived, UI only)  — estimated 1RM = roundLb(trainingMax / 0.9); equals Start at init, grows each cycle
//   target      (UI: "Target")  — the 1RM the user is working toward
export interface Standard {
  id: string;
  type: StandardType;
  name?: string;
  category: StandardCategory;
  start: number;
  target: number;
  createdAt: string;
  status: "active" | "archived";
}

export interface TrainingState {
  standardId: string;
  trainingMax: number;
  cycle: number;
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
  sessionIndex: number;
  completedAt: string;
  sets?: SetActual[];
}
