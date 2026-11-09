import type { PlannedSet, Session } from "./shared";
import type { StandardEngine } from "./registry";
import type { RunState, SetActual, Standard, StandardType, TrainingState } from "./types";

// Decision table: decision-tables/run.md
// Run category (800m / 1.5 / 3 / 5 mile) — 2 × Session A + 1 × Session B — Zone 2 per week, any order.
//   Session A     — ≤1.5 mi: Speed + Threshold · >1.5 mi: Threshold + Speed (named part first).
//   Pace ladder   — the race-pace reps (≤1.5 mi speed, >1.5 mi threshold). Starts at START race pace.
//                   2 qualifying sessions in a row (every ladder rep at or under target) → −15 s/mi.
//                   A miss restarts the counter; an average past the next step jumps to the fastest step run.
//   Week 4        — Session A — Time Trial (faster than CURRENT sets it and counts toward a step;
//                   equal or slower holds CURRENT, restarts the counter) + a deload Session A (doesn't count) + shorter Zone 2.
//   CURRENT       — race time: set by a faster time trial, moved by half of each ladder step; never gets worse.
//   Other paces   — from CURRENT (Riegel); logged faster than planned → personal adjustment. Zone 2 never adjusts.
export const RUN_CONFIG = {
  step: 15,                // s/mi per ladder step
  sessionsPerStep: 2,      // qualifying sessions in a row to earn a step
  currentShare: 0.5,       // share of a ladder step that moves CURRENT
  thresholdAdd: 10,        // s/mi added to the Riegel 10K pace
  zone2Add: 75,            // Zone 2 ceiling = threshold + this
  shortExp: 1.08,          // Riegel exponent, ≤1.5 mi (speed-type runners)
  longExp: 1.06,           // Riegel exponent, >1.5 mi
  defaultGainPerWeek: 3.75, // s/mi CURRENT gain per week until 2 weeks of data (1 step / 2 weeks × half)
};

type Config = typeof RUN_CONFIG;
type RunType = Extract<StandardType, "run800" | "run1_5" | "run3" | "run5">;
type Wk = [number, number, number];

const MILE = 1609.344;

interface RunPlan {
  meters: number;
  distLabel: string;
  ladder: "speed" | "threshold";
  speed: { m: number; reps: Wk; rest: string };
  threshold: { min: Wk; reps: Wk };
  zone2: [number, number, number, number];
}

export const RUN_PLANS: Record<RunType, RunPlan> = {
  run800: { meters: 800,      distLabel: "800m",   ladder: "speed",
    speed: { m: 200, reps: [6, 7, 8], rest: "1:00" }, threshold: { min: [3, 3, 5], reps: [2, 3, 2] }, zone2: [25, 30, 35, 20] },
  run1_5: { meters: 1.5 * MILE, distLabel: "1.5 mi", ladder: "speed",
    speed: { m: 400, reps: [5, 6, 7], rest: "1:30" }, threshold: { min: [5, 5, 7], reps: [2, 3, 2] }, zone2: [30, 35, 40, 25] },
  run3:   { meters: 3 * MILE,   distLabel: "3 mi",   ladder: "threshold",
    speed: { m: 400, reps: [2, 3, 4], rest: "1:30" }, threshold: { min: [5, 5, 7], reps: [4, 5, 4] }, zone2: [40, 45, 50, 35] },
  run5:   { meters: 5 * MILE,   distLabel: "5 mi",   ladder: "threshold",
    speed: { m: 400, reps: [2, 3, 4], rest: "1:30" }, threshold: { min: [7, 7, 7], reps: [3, 4, 5] }, zone2: [45, 55, 60, 40] },
};

const plan = (s: Standard) => RUN_PLANS[s.type as RunType];
const miles = (s: Standard) => plan(s).meters / MILE;
const thresholdRest = (min: number) => (min >= 7 ? "1:30" : "1:00");

// "M:SS", or "H:MM:SS" from an hour up
export function fmtTime(sec: number): string {
  const t = Math.round(sec);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const ss = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export const fmtPace = (secPerMile: number) => `${fmtTime(secPerMile)}/mi`;

// Speed rep: "200m @ 6:02/mi in 0:45secs" (pace from the split when not given)
export const speedRepText = (m: number, time: number, pace = time / (m / MILE)) =>
  `${fmtDistance(m)} @ ${fmtPace(pace)} in ${fmtTime(time)}secs`;

// "200m", "1.5 mi"
export const fmtDistance = (m: number) => (m < MILE ? `${m}m` : `${Math.round((m / MILE) * 10) / 10} mi`);

// Typed digits → time while typing ("245" → "2:45", "10230" → "1:02:30")
export function fmtTimeDigits(raw: string): string {
  const d = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 6);
  if (d.length <= 2) return d;
  const ss = d.slice(-2);
  const rest = d.slice(0, -2);
  return rest.length <= 2 ? `${rest}:${ss}` : `${rest.slice(0, -2)}:${rest.slice(-2)}:${ss}`;
}

// "2:45" → 165 s; null when empty, or minutes / seconds ≥ 60
export function parseTime(text: string): number | null {
  if (!text) return null;
  const parts = text.split(":").map(Number);
  if (parts.some((p) => isNaN(p)) || parts.slice(1).some((p) => p >= 60)) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0) || null;
}

// Session titles by card position (W1–W3: A · B · A; W4: Time Trial · B · deload A)
export function runSessionTitle(s: Standard, week: number, sessionIndex: number): string {
  if (sessionIndex === 1) return "Session B — Zone 2";
  if (week === 4 && sessionIndex === 0) return "Session A — Time Trial";
  return plan(s).ladder === "speed" ? "Session A — Speed + Threshold" : "Session A — Threshold + Speed";
}

// Riegel: predicted time over toM from a time over fromM, as a pace (s/mi)
function riegelPace(time: number, fromM: number, toM: number, exp: number): number {
  return (time * Math.pow(toM / fromM, exp)) / (toM / MILE);
}

export function initRunState(s: Standard): RunState {
  return {
    ladder: Math.round(s.start / miles(s)),
    streak: 0,
    current: s.start,
    adjust: {},
    trials: [],
    points: [{ date: s.createdAt, current: s.start }],
  };
}

// Formula paces from CURRENT (before personal adjustments)
export function thresholdFormula(s: Standard, current: number, cfg: Config = RUN_CONFIG): number {
  const exp = plan(s).ladder === "speed" ? cfg.shortExp : cfg.longExp;
  return Math.round(riegelPace(current, plan(s).meters, 10000, exp) + cfg.thresholdAdd);
}

export function speedFormula(s: Standard, current: number, cfg: Config = RUN_CONFIG): number {
  return Math.round(riegelPace(current, plan(s).meters, MILE, cfg.longExp));
}

// Paces this week's cards use (s/mi)
export function runPaces(s: Standard, r: RunState, cfg: Config = RUN_CONFIG) {
  const p = plan(s);
  const thrFormula = thresholdFormula(s, r.current, cfg);
  return {
    speed: p.ladder === "speed" ? r.ladder : speedFormula(s, r.current, cfg) + (r.adjust.speed ?? 0),
    threshold: p.ladder === "threshold" ? r.ladder : thrFormula + (r.adjust.threshold ?? 0),
    zone2: thrFormula + cfg.zone2Add,
  };
}

const split = (pace: number, m: number) => Math.round((pace * m) / MILE);

function speedPart(s: Standard, pace: number, n: number) {
  const p = plan(s);
  const time = split(pace, p.speed.m);
  const sets: PlannedSet[] = Array.from({ length: n }, () => ({
    reps: 1, part: "speed", distance: p.speed.m, time, pace, ladder: p.ladder === "speed",
  }));
  return { sets, line: `${n} × ${speedRepText(p.speed.m, time, pace)} · ${p.speed.rest} jog` };
}

function thresholdPart(s: Standard, pace: number, n: number, min: number) {
  const sets: PlannedSet[] = Array.from({ length: n }, () => ({
    reps: 1, part: "threshold", minutes: min, pace, ladder: plan(s).ladder === "threshold",
  }));
  return { sets, line: `${n} × ${min} min @ ${fmtPace(pace)} · ${thresholdRest(min)} jog` };
}

const WARMUP = "10 min easy warm-up + cool-down";

// Cards: W1–W3 A · B · A; W4 Time Trial · B · deload A
export function runWeek(s: Standard, t: TrainingState, cfg: Config = RUN_CONFIG): Session[] {
  const p = plan(s);
  const r = t.run!;
  const pace = runPaces(s, r, cfg);
  const deload = t.week === 4;
  const w = deload ? 2 : t.week - 1;
  const n = (reps: Wk) => (deload ? Math.ceil(reps[2] / 2) : reps[w]);
  const thrMin = deload ? p.threshold.min[0] : p.threshold.min[w];

  const speed = speedPart(s, pace.speed, n(p.speed.reps));
  const thr = thresholdPart(s, pace.threshold, n(p.threshold.reps), thrMin);
  const parts = p.ladder === "speed" ? [speed, thr] : [thr, speed];
  const intervals: Session = {
    title: runSessionTitle(s, 1, 0),
    lines: [...parts.map((x) => x.line), WARMUP],
    sets: parts.flatMap((x) => x.sets),
    kind: "intervals",
    optional: true, // every run card can be SKIPPED (no RECOMMENDED / OPTIONAL tag)
  };

  const z2min = p.zone2[deload ? 3 : w];
  const zone2: Session = {
    title: "Session B — Zone 2",
    lines: [`${z2min} min · ${fmtPace(pace.zone2)} or slower · conversational`],
    sets: [{ reps: 1, part: "zone2", minutes: z2min, pace: pace.zone2 }],
    kind: "zone2",
    optional: true, // every run card can be SKIPPED (no RECOMMENDED / OPTIONAL tag)
  };

  if (!deload) return [intervals, zone2, { ...intervals }];

  const trial: Session = {
    title: "Session A — Time Trial",
    lines: [`${p.distLabel} all-out · CURRENT ${fmtTime(r.current)}`, WARMUP],
    sets: [{ reps: 1, part: "trial", distance: p.meters }],
    kind: "trial",
    optional: true, // every run card can be SKIPPED (no RECOMMENDED / OPTIONAL tag)
  };
  return [trial, zone2, intervals];
}

// Actual pace (s/mi) of a logged rep: distance reps log a split, timed reps log a pace
function actualPace(planned: PlannedSet, actual: SetActual | undefined): number | undefined {
  if (!actual) return undefined;
  if (planned.distance != null) return actual.time != null ? actual.time / (planned.distance / MILE) : undefined;
  return actual.pace;
}

function hit(planned: PlannedSet, actual: SetActual | undefined): boolean {
  if (planned.distance != null) return actual?.time != null && actual.time <= planned.time!;
  return actual?.pace != null && actual.pace <= planned.pace!;
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

// Apply one logged (or skipped) card to the run state. Pure — the caller saves the result.
export function applyRunResult(
  s: Standard,
  t: TrainingState,
  session: Session,
  sets: SetActual[] | undefined,
  skipped = false,
  today = new Date(),
  cfg: Config = RUN_CONFIG
): RunState {
  const r: RunState = { ...t.run!, adjust: { ...t.run!.adjust }, trials: [...t.run!.trials], points: [...t.run!.points] };
  if (skipped || !sets) return r;
  const date = today.toISOString().slice(0, 10);
  const step = (k: number, moveCurrent: boolean) => {
    r.ladder -= k * cfg.step;
    r.streak = 0;
    if (moveCurrent) {
      r.current -= k * cfg.step * cfg.currentShare * miles(s);
      r.points.push({ date, current: r.current });
    }
  };

  if (session.kind === "trial") {
    const time = sets[0]?.time;
    if (time == null) return r;
    r.trials.push({ date, time, cycle: t.cycle });                 // every trial time is saved
    if (time < r.current) {                                        // R6-R2: faster → sets CURRENT
      r.streak += 1;
      if (r.streak >= cfg.sessionsPerStep) step(1, false);
      r.current = time;
      r.points.push({ date, current: time });
    } else {
      r.streak = 0;                                                // R6-R3: equal or slower → CURRENT holds
    }
    return r;
  }

  if (session.kind !== "intervals") return r; // Zone 2: logged for the record only

  const planned = session.sets ?? [];
  const idx = planned.map((_, i) => i);

  // Non-step part: every rep logged and the average beats the plan → adjust future prescriptions
  const other = idx.filter((i) => !planned[i].ladder);
  const otherPaces = other.map((i) => actualPace(planned[i], sets[i]));
  if (other.length && otherPaces.every((x) => x != null)) {
    const part = planned[other[0]].part as "speed" | "threshold";
    const a = avg(otherPaces as number[]);
    if (a < planned[other[0]].pace!) {
      const formula = part === "speed" ? speedFormula(s, r.current, cfg) : thresholdFormula(s, r.current, cfg);
      r.adjust[part] = Math.round(a - formula);
    }
  }

  if (t.week === 4) return r; // deload Session A doesn't count toward the ladder

  const lad = idx.filter((i) => planned[i].ladder);
  if (!lad.every((i) => hit(planned[i], sets[i]))) {
    r.streak = 0; // a miss restarts the counter — no penalty
    return r;
  }
  const a = avg(lad.map((i) => actualPace(planned[i], sets[i])!));
  const jump = Math.floor((r.ladder - a) / cfg.step + 1e-9);
  if (jump >= 1) {
    step(jump, true); // ran past the next step → fastest step run, counter restarts
  } else {
    r.streak += 1;
    if (r.streak >= cfg.sessionsPerStep) step(1, true);
  }
  return r;
}

// CURRENT shown in the UI (whole seconds)
export function runCurrent(s: Standard, t: TrainingState): number {
  return Math.round(t.run?.current ?? s.start);
}

// Weeks until CURRENT reaches target (0 = reached): observed weekly gain once 2+ weeks of data,
// otherwise (or if not improving) the default gain per week.
export function runWeeksToTarget(
  s: Standard, t: TrainingState, current = runCurrent(s, t), now = new Date(), cfg: Config = RUN_CONFIG
): number {
  if (current <= s.target) return 0;
  const pts = t.run?.points ?? [];
  let perWeek = cfg.defaultGainPerWeek * miles(s);
  if (pts.length >= 2) {
    const weeks = (now.getTime() - new Date(pts[0].date).getTime()) / (7 * 86400000);
    const gain = pts[0].current - pts[pts.length - 1].current;
    if (weeks >= 2 && gain > 0) perWeek = gain / weeks;
  }
  return Math.max(1, Math.ceil((current - s.target) / perWeek - 1e-9));
}

export const runEngine: StandardEngine = {
  buildWeek(s, t) { return runWeek(s, t); },
  // Barbell training-max hooks don't apply; progression runs per card via applyRunResult.
  initTrainingMax() { return 0; },
  progressTrainingMax(s, current) { return current; },
  nextTM(s, currentTM) { return currentTM; },
  wavesToTarget() { return 0; },
  currentValue(s, t) { return runCurrent(s, t); },
  estWeeksToTarget(s, t, current) { return runWeeksToTarget(s, t, current); },
};
