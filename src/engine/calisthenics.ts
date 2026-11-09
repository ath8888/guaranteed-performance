import type { PlannedSet, Session } from "./shared";
import type { StandardEngine } from "./registry";
import type { CalisthenicsState, SetActual, Standard, TrainingState } from "./types";

// Decision table: decision-tables/calisthenics.md
// Calisthenics category (Push-ups) — one Strength day (A) and one Endurance day (B) per week.
//   Day A — 1 weighted-vest set to failure. More than 8 reps → +5 lb. Never changes CURRENT.
//   Day B — 1 bodyweight AMRAP (= Max), then back-off sets at 40% of today's AMRAP.
//   CURRENT — stored as cal.best: the highest Day B AMRAP ever. Only a higher AMRAP raises it; nothing lowers it.
//   Stalls — AMRAP doesn't beat CURRENT 2 times → back-off sets Recommended; 4 → a 3rd set. A new CURRENT resets both.
//   No rest days — cards go in order, each opens as soon as the one before it is logged.
export const CALISTHENICS_CONFIG = {
  startLoad: 15,          // lb vest for a new program (user can change it on the strength day)
  loadStep: 5,            // lb added to the vest
  addLoadAbove: 8,        // strength reps > this → +loadStep
  backoffPct: 0.4,        // back-off set reps = 40% of today's AMRAP
  backoffSets: 2,
  stallsPerLever: 2,      // 2 stalls → back-offs Recommended; 4 → +1 back-off set
  stalledNoteAt: 6,       // stalls continue after both levers → "Stalled" note
  defaultGainPer4Weeks: 0.05, // C8-R3: estimate before 2 AMRAPs exist: +5% per 4 weeks
};

type Config = typeof CALISTHENICS_CONFIG;

export function initCalState(max: number, load: number): CalisthenicsState {
  return { max, best: max, load, stallCount: 0, amraps: [] };
}

// Pre-F15 push-up state (strength + endurance blocks, retests) → weekly AMRAP state.
// Keeps max, vest load and test history; starts a fresh week so old logs don't mark new cards done.
export function migrateCalState(t: TrainingState): TrainingState | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const old = t.cal as any;
  if (!old || "best" in old) return null;
  const history: { date: string; reps: number }[] = (old.retests ?? []).map((r: { date: string; max: number }) => ({
    date: r.date, reps: r.max,
  }));
  const best = Math.max(old.max, ...history.map((h) => h.reps));
  const cal: CalisthenicsState = { max: old.max, best, load: old.load ?? 0, stallCount: 0, amraps: history };
  if (old.lastStrengthReps != null) cal.lastStrengthReps = old.lastStrengthReps;
  const nextWeek = t.week === 4 ? 1 : ((t.week + 1) as 1 | 2 | 3 | 4);
  return { ...t, cycle: t.week === 4 ? t.cycle + 1 : t.cycle, week: nextWeek, cal };
}

export function backoffRecommended(c: CalisthenicsState, cfg: Config = CALISTHENICS_CONFIG): boolean {
  return c.stallCount >= cfg.stallsPerLever;
}

export function backoffSetCount(c: CalisthenicsState, cfg: Config = CALISTHENICS_CONFIG): number {
  return cfg.backoffSets + (c.stallCount >= cfg.stallsPerLever * 2 ? 1 : 0);
}

export function backoffReps(amrap: number, cfg: Config = CALISTHENICS_CONFIG): number {
  return Math.max(1, Math.round(amrap * cfg.backoffPct));
}

export function isStalled(c: CalisthenicsState, cfg: Config = CALISTHENICS_CONFIG): boolean {
  return c.stallCount >= cfg.stalledNoteAt;
}

const weekKey = (t: TrainingState) => `${t.cycle}-${t.week}`;

// Cards: 0 Strength (day A) · 1 Endurance AMRAP (day B) · 2 Back-off sets (day B, after the AMRAP)
export function calisthenicsWeek(t: TrainingState, cfg: Config = CALISTHENICS_CONFIG): Session[] {
  const c = t.cal!;
  const strength: Session = {
    title: "Session A — Strength",
    lines: [`${c.load} lb vest × max reps (to failure)`],
    sets: [{ weight: c.load, reps: cfg.addLoadAbove, amrap: true }],
    amrap: true,
    kind: "strength",
    sessionNo: 0,
    recommended: true,
    optional: false,
  };
  const endurance: Session = {
    title: "Session B — Endurance",
    lines: [`1 set to failure · best ${c.best}`],
    sets: [{ reps: c.best, amrap: true }],
    amrap: true,
    kind: "endurance",
    sessionNo: 1,
    recommended: true,
    optional: false,
  };
  const n = backoffSetCount(c, cfg);
  const todays = c.amrapWeek === weekKey(t); // AMRAP already logged this week
  const reps = backoffReps(c.max, cfg);
  const backoffSets: PlannedSet[] = Array.from({ length: n }, () => ({ reps, amrap: true, maxReps: reps }));
  const backoff: Session = {
    title: "Session B — Endurance",
    lines: [todays ? `${n} × ${reps} push-ups (40% of today)` : `${n} × 40% of today's max`],
    sets: backoffSets,
    kind: "backoff",
    sessionNo: 1,
    recommended: backoffRecommended(c, cfg),
    optional: !backoffRecommended(c, cfg),
  };
  return [strength, endurance, backoff];
}

// Apply one logged (or skipped) card to the push-up state. Pure — the caller saves the result.
export function applyCalisthenicsResult(
  t: TrainingState,
  session: Session,
  sets: SetActual[] | undefined,
  skipped = false,
  today = new Date(),
  cfg: Config = CALISTHENICS_CONFIG
): CalisthenicsState {
  const c: CalisthenicsState = { ...t.cal!, amraps: [...t.cal!.amraps] };

  if (session.kind === "strength") {
    if (!skipped) {
      const set = sets?.[0];
      if (set?.reps != null) {
        c.load = set.weight ?? c.load; // user may edit the load each session
        c.lastStrengthReps = set.reps;
        if (set.reps > cfg.addLoadAbove) c.load += cfg.loadStep;     // C3-R2
      }
    }
    return c;
  }

  if (session.kind === "endurance") {
    const reps = sets?.[0]?.reps;
    if (skipped || reps == null) return c;
    c.stallCount = reps > c.best ? 0 : c.stallCount + 1; // C4-R2 / R3: a new CURRENT resets both levers
    c.best = Math.max(c.best, reps);                     // CURRENT never drops
    c.max = reps;
    c.amrapWeek = weekKey(t);
    c.amraps.push({ date: today.toISOString().slice(0, 10), reps, cycle: t.cycle });
    return c;
  }

  // Back-off sets are logged for the record; they don't change the plan.
  return c;
}

// Card availability (C2): cards go in order, no rest days.
// Returns null when the card is open, or { } when an earlier card isn't done.
export function cardLock(isLogged: (i: number) => boolean, idx: number): { date?: Date } | null {
  for (let i = 0; i < idx; i++) if (!isLogged(i)) return {};
  return null;
}

// C7: CURRENT is stored (cal.best) — the highest Day B AMRAP ever. No reset at cycle end.
export function calisthenicsCurrent(s: Standard, t: TrainingState): number {
  return t.cal ? t.cal.best : s.start;
}

// Weeks until CURRENT reaches target (0 = reached): average weekly AMRAP gain once there are 2+,
// otherwise (or if not improving) +10% of max per 4 weeks.
export function calisthenicsWeeksToTarget(
  s: Standard, t: TrainingState, cfg: Config = CALISTHENICS_CONFIG, current = calisthenicsCurrent(s, t)
): number {
  const c = t.cal!;
  if (current >= s.target) return 0;
  const a = c.amraps;
  const avgGain = a.length >= 2 ? (a[a.length - 1].reps - a[0].reps) / (a.length - 1) : 0;
  if (avgGain > 0) return Math.ceil((s.target - current) / avgGain);
  const base = Math.max(current, 1);
  const weeklyFactor = Math.pow(1 + cfg.defaultGainPer4Weeks, 1 / 4);
  return Math.max(1, Math.ceil(Math.log(s.target / base) / Math.log(weeklyFactor)));
}

export const calisthenicsEngine: StandardEngine = {
  buildWeek(s, t) { return calisthenicsWeek(t); },
  // Barbell training-max hooks don't apply; progression runs per card via applyCalisthenicsResult.
  initTrainingMax() { return 0; },
  progressTrainingMax(s, current) { return current; },
  nextTM(s, currentTM) { return currentTM; },
  wavesToTarget() { return 0; },
  currentValue(s, t) { return calisthenicsCurrent(s, t); },
  // Counted from the start of the current week: once this week's AMRAP is in, gains start next week.
  estWeeksToTarget(s, t, current) {
    const weeks = calisthenicsWeeksToTarget(s, t, CALISTHENICS_CONFIG, current);
    return weeks === 0 ? 0 : weeks + (t.cal?.amrapWeek === weekKey(t) ? 1 : 0);
  },
};
