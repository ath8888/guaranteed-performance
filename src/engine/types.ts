export type StandardType = "bench" | "ohp" | "squat" | "deadlift" | "olympic" | "pushups";

// Each category has its own progression engine; every type in a category shares it.
export type StandardCategory = "lifts" | "olympic" | "calisthenics";

export const CATEGORY_LABEL: Record<StandardCategory, string> = {
  lifts: "Lifts",
  olympic: "Olympic Lift",
  calisthenics: "Calisthenics",
};

export const STANDARD_META: Record<StandardType, { label: string; short: string; unit: string; kind: "load" | "reps"; lower: false; category: StandardCategory }> = {
  bench:    { label: "Bench Press",    short: "Bench",    unit: "lb",   kind: "load", lower: false, category: "lifts" },
  ohp:      { label: "Overhead Press", short: "OHP",      unit: "lb",   kind: "load", lower: false, category: "lifts" },
  squat:    { label: "Squat",          short: "Squat",    unit: "lb",   kind: "load", lower: false, category: "lifts" },
  deadlift: { label: "Deadlift",       short: "Deadlift", unit: "lb",   kind: "load", lower: false, category: "lifts" },
  olympic:  { label: "Olympic Lift",   short: "Olympic",  unit: "lb",   kind: "load", lower: false, category: "olympic" },
  pushups:  { label: "Push-ups",       short: "Push-ups", unit: "reps", kind: "reps", lower: false, category: "calisthenics" },
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
  cal?: CalisthenicsState; // calisthenics standards only (trainingMax unused there)
}

// Push-ups (calisthenics): Start / Current / Target are bodyweight max reps.
// Each week: Strength day (vest AMRAP) + Endurance day (bodyweight AMRAP + back-off sets).
export interface CalisthenicsState {
  max: number;                // latest endurance AMRAP (Start until the first one)
  best: number;               // best AMRAP so far — "improvement" means beating this
  load: number;               // weight-vest load (lb) for the strength day
  lastStrengthReps?: number;  // reps logged on the most recent strength set
  stallCount: number;         // consecutive endurance days without a new best (drives volume levers)
  amraps: { date: string; reps: number; cycle?: number }[]; // cycle: added in F16 (older entries have none)
  amrapWeek?: string;         // "cycle-week" of the latest AMRAP (back-off sets use it that week)
  nextOpensAt?: string;       // ISO local midnight when the next training day's first card opens
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
  skipped?: boolean; // optional session skipped (calisthenics: counts toward week completion, no progression)
}
