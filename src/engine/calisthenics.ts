import type { PlannedSet, Session } from "./shared";
import type { StandardEngine } from "./registry";
import type { CalisthenicsState, SetActual, Standard, TrainingState } from "./types";

// Calisthenics category (Push-ups) — one Strength day and one Endurance day per week.
//   Strength day  — 1 weighted-vest set to failure. More than 8 reps → +5 lb; under 5 → hold.
//   Endurance day — 1 bodyweight AMRAP (= the new max), then back-off sets at 40% of today's AMRAP.
//   Stalls        — AMRAP doesn't beat the best so far for 2 weeks → back-off sets become Recommended;
//                   4 weeks → a 3rd back-off set. Any new best resets both. Volume is the first lever.
//   Spacing       — 2 full rest days after strength day, 3 after endurance day (Mon / Thu / Mon).
export const CALISTHENICS_CONFIG = {
  startLoad: 15,          // lb vest for a new program (user can change it on the strength day)
  loadStep: 5,            // lb added to the vest
  addLoadAbove: 8,        // strength reps > this → +loadStep
  holdLoadBelow: 5,       // strength reps < this → hold (documented; holding is the default anyway)
  backoffPct: 0.4,        // back-off set reps = 40% of today's AMRAP
  backoffSets: 2,
  stallsPerLever: 2,      // 2 stalls → back-offs Recommended; 4 → +1 back-off set
  stalledNoteAt: 6,       // stalls continue after both levers → "Stalled" note
  restAfterStrength: 2,   // full rest days before endurance day
  restAfterEndurance: 3,  // full rest days before next week's strength day
  defaultGainPer4Weeks: 0.1, // estimate before 2 AMRAPs exist: +10% of max per 4 weeks
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

const localMidnightPlus = (d: Date, days: number) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() + days);
  return x;
};

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
        if (set.reps > cfg.addLoadAbove) c.load += cfg.loadStep;
      }
    }
    c.nextOpensAt = localMidnightPlus(today, cfg.restAfterStrength + 1).toISOString();
    return c;
  }

  if (session.kind === "endurance") {
    const reps = sets?.[0]?.reps;
    if (skipped || reps == null) return c;
    c.stallCount = reps > c.best ? 0 : c.stallCount + 1; // a new best resets both levers
    c.best = Math.max(c.best, reps);
    c.max = reps;
    c.amrapWeek = weekKey(t);
    c.amraps.push({ date: today.toISOString().slice(0, 10), reps, cycle: t.cycle });
    return c;
  }

  if (session.kind === "backoff") {
    // Logged for the record; back-off sets don't change the plan. Next week's strength day opens after rest.
    c.nextOpensAt = localMidnightPlus(today, cfg.restAfterEndurance + 1).toISOString();
    return c;
  }

  return c;
}

// Card availability: cards go in order; the first card of a new training day waits for nextOpensAt.
// Returns null when the card is open, { } when an earlier card isn't done, or { date } when it opens later.
export function cardLock(
  c: CalisthenicsState,
  sessions: Session[],
  idx: number,
  isLogged: (i: number) => boolean,
  now = new Date()
): { date?: Date } | null {
  for (let i = 0; i < idx; i++) if (!isLogged(i)) return {};
  const startsDay = idx === 0 || sessions[idx].sessionNo !== sessions[idx - 1].sessionNo;
  if (startsDay && c.nextOpensAt && now < new Date(c.nextOpensAt)) return { date: new Date(c.nextOpensAt) };
  return null;
}

// CURRENT: best endurance AMRAP this cycle — only rises within a cycle, resets at cycle end.
// Until this cycle's first AMRAP (or for entries saved before F16, which have no cycle) it's the latest max.
export function calisthenicsCurrent(s: Standard, t: TrainingState): number {
  const c = t.cal;
  if (!c) return s.start;
  const inCycle = c.amraps.filter((a) => a.cycle === t.cycle).map((a) => a.reps);
  return inCycle.length ? Math.max(...inCycle) : c.max;
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
