import type { PlannedSet, Session } from "./shared";
import type { StandardEngine } from "./registry";
import type { CalisthenicsState, SetActual, Standard, TrainingState } from "./types";

// Calisthenics category (Push-ups): two blocks per workout, each with its own double progression.
//   Strength  — 1 set of 5–8 reps to failure with a weight vest. 8 reps → +load, back to 5.
//   Endurance — 3 sets at ~50% of max, 60s rest. 2 clean sessions in a row → +2 reps per set.
//   Load and endurance reps never advance in the same workout (strength wins, endurance waits).
//   Week 4 — retest the bodyweight max; resets endurance to 50% of the new max.
//   Stalls — 2 retests in a row without improvement → +1 endurance set; 2 more → 3rd workout/week.
//            Any improvement resets both levers.
//   Tiers  — the thresholds are heuristics, so they live here, not inline.
export const CALISTHENICS_CONFIG = {
  strengthFocusBelow: 30,   // max < this → strength Recommended, endurance Optional
  enduranceFocusAbove: 60,  // max > this → strength Optional (maintenance), endurance Recommended + 1 set
  loadStep: 5,              // lb added to the vest when the strength set hits the top of the range
  strengthRepMin: 5,
  strengthRepMax: 8,
  enduranceBasePct: 0.5,
  enduranceRepStep: 2,
  enduranceSets: 3,
  cleanSessionsToAdvance: 2,
  restSec: 60,
  baseSessionsPerWeek: 2,
  stallsPerLever: 2,
  stalledNoteAt: 6,         // stalls after both levers are in use → show "Stalled" note
  defaultGainPerCycle: 0.1, // estimate before 2 retests exist: +10% of max per 4-week cycle
};

type Config = typeof CALISTHENICS_CONFIG;
export type Tier = "strength" | "balanced" | "endurance";

export function tierFor(max: number, cfg: Config = CALISTHENICS_CONFIG): Tier {
  if (max < cfg.strengthFocusBelow) return "strength";
  if (max > cfg.enduranceFocusAbove) return "endurance";
  return "balanced";
}

export function enduranceBase(max: number, cfg: Config = CALISTHENICS_CONFIG): number {
  return Math.max(1, Math.round(max * cfg.enduranceBasePct));
}

export function enduranceSetCount(c: CalisthenicsState, cfg: Config = CALISTHENICS_CONFIG): number {
  const lever = c.stallCount >= cfg.stallsPerLever ? 1 : 0;
  const highMax = tierFor(c.max, cfg) === "endurance" ? 1 : 0;
  return cfg.enduranceSets + lever + highMax;
}

export function sessionsPerWeek(c: CalisthenicsState, cfg: Config = CALISTHENICS_CONFIG): number {
  return cfg.baseSessionsPerWeek + (c.stallCount >= cfg.stallsPerLever * 2 ? 1 : 0);
}

export function isStalled(c: CalisthenicsState, cfg: Config = CALISTHENICS_CONFIG): boolean {
  return c.stallCount >= cfg.stalledNoteAt;
}

export function initCalState(max: number, load: number, cfg: Config = CALISTHENICS_CONFIG): CalisthenicsState {
  return {
    max,
    load,
    enduranceReps: enduranceBase(max, cfg),
    enduranceStreak: 0,
    endurancePending: false,
    stallCount: 0,
    retests: [],
  };
}

const LETTERS = ["A", "B", "C"];

export function calisthenicsWeek(t: TrainingState, cfg: Config = CALISTHENICS_CONFIG): Session[] {
  const c = t.cal!;
  if (t.week === 4) {
    return [{
      title: "Retest — Max push-ups",
      lines: [`1 set to failure · beat ${c.max}`],
      sets: [{ reps: c.max, amrap: true, note: "bodyweight" }],
      amrap: true,
      kind: "retest",
    }];
  }
  const tier = tierFor(c.max, cfg);
  const nSets = enduranceSetCount(c, cfg);
  const sessions: Session[] = [];
  for (let n = 0; n < sessionsPerWeek(c, cfg); n++) {
    const strengthSets: PlannedSet[] = [{ weight: c.load, reps: cfg.strengthRepMin, amrap: true }];
    sessions.push({
      title: `Session ${LETTERS[n]} — Strength`,
      lines: [`${c.load} lb vest × ${cfg.strengthRepMin}–${cfg.strengthRepMax} (to failure)`],
      sets: strengthSets,
      amrap: true,
      kind: "strength",
      sessionNo: n,
      recommended: tier !== "endurance",
      optional: tier === "endurance",
    });
    const enduranceSets: PlannedSet[] = Array.from({ length: nSets }, () => ({
      reps: c.enduranceReps, amrap: true, maxReps: c.enduranceReps,
    }));
    sessions.push({
      title: `Session ${LETTERS[n]} — Endurance`,
      lines: [`${nSets} × ${c.enduranceReps} push-ups · rest ${cfg.restSec}s`],
      sets: enduranceSets,
      kind: "endurance",
      sessionNo: n,
      restSec: cfg.restSec,
      recommended: tier !== "strength",
      optional: tier === "strength",
    });
  }
  return sessions;
}

const sessionKey = (t: TrainingState, s: Session) => `${t.cycle}-${t.week}-${s.sessionNo ?? 0}`;

// Apply one logged (or skipped) block to the push-up state. Pure — the caller saves the result.
// Does not move the week forward; that is decided by whether every card in the week is logged.
export function applyCalisthenicsResult(
  t: TrainingState,
  session: Session,
  sets: SetActual[] | undefined,
  skipped = false,
  today = new Date(),
  cfg: Config = CALISTHENICS_CONFIG
): CalisthenicsState {
  const c: CalisthenicsState = { ...t.cal!, retests: [...t.cal!.retests] };
  if (skipped) return c; // skipped blocks neither progress nor break streaks

  if (session.kind === "strength") {
    const set = sets?.[0];
    if (set?.reps == null) return c;
    c.load = set.weight ?? c.load; // user may edit the load each session
    c.lastStrengthReps = set.reps;
    const maintenance = tierFor(c.max, cfg) === "endurance";
    if (!maintenance && set.reps >= cfg.strengthRepMax) {
      c.load += cfg.loadStep;
      c.strengthAdvancedAt = sessionKey(t, session);
    }
    // under 5 reps → hold the load and try again
    return c;
  }

  if (session.kind === "endurance") {
    const strengthAdvancedHere = c.strengthAdvancedAt === sessionKey(t, session);
    if (c.endurancePending) {
      if (!strengthAdvancedHere) {
        c.enduranceReps += cfg.enduranceRepStep;
        c.endurancePending = false;
        c.enduranceStreak = 0;
      }
      return c;
    }
    const planned = session.sets?.length ?? 0;
    const clean =
      !!sets && sets.length >= planned && planned > 0 &&
      sets.every((s) => (s.reps ?? 0) >= c.enduranceReps);
    c.enduranceStreak = clean ? c.enduranceStreak + 1 : 0;
    if (c.enduranceStreak >= cfg.cleanSessionsToAdvance) {
      if (strengthAdvancedHere) {
        c.endurancePending = true; // streak kept; applied next workout
      } else {
        c.enduranceReps += cfg.enduranceRepStep;
        c.enduranceStreak = 0;
      }
    }
    return c;
  }

  if (session.kind === "retest") {
    const newMax = sets?.[0]?.reps;
    if (newMax == null) return c;
    const improved = newMax > c.max;
    c.stallCount = improved ? 0 : c.stallCount + 1; // improvement resets both volume levers
    c.max = newMax;
    c.enduranceReps = enduranceBase(newMax, cfg);
    c.enduranceStreak = 0;
    c.endurancePending = false;
    c.retests.push({ date: today.toISOString().slice(0, 10), max: newMax });
    return c;
  }

  return c;
}

// Weeks until the bodyweight max reaches target (0 = reached). Gains show up at retests (end of cycle).
// Average gain between retests once there are 2; otherwise (or if not improving) +10% of max per cycle.
export function calisthenicsWeeksToTarget(s: Standard, t: TrainingState, cfg: Config = CALISTHENICS_CONFIG): number {
  const c = t.cal!;
  if (c.max >= s.target) return 0;
  let cycles: number;
  const r = c.retests;
  const avgGain = r.length >= 2 ? (r[r.length - 1].max - r[0].max) / (r.length - 1) : 0;
  if (avgGain > 0) {
    cycles = Math.ceil((s.target - c.max) / avgGain);
  } else {
    const base = Math.max(c.max, 1);
    cycles = Math.max(1, Math.ceil(Math.log(s.target / base) / Math.log(1 + cfg.defaultGainPerCycle)));
  }
  return (5 - t.week) + (cycles - 1) * 4;
}

export const calisthenicsEngine: StandardEngine = {
  buildWeek(s, t) { return calisthenicsWeek(t); },
  // Barbell training-max hooks don't apply; progression runs per session via applyCalisthenicsResult.
  initTrainingMax() { return 0; },
  progressTrainingMax(s, current) { return current; },
  nextTM(s, currentTM) { return currentTM; },
  wavesToTarget() { return 0; },
  currentValue(s, t) { return t.cal?.max ?? s.start; },
  estWeeksToTarget(s, t) { return calisthenicsWeeksToTarget(s, t); },
};
