import type { PlannedSet, Session } from "./shared";
import type { StandardEngine } from "./registry";
import type { RunState, SetActual, Standard, StandardType, TrainingState } from "./types";

// Decision table: decision-tables/run.md v1.0 (rules stored as data in RUN_RULES / RUN_PLANS).
//   Weeks 1–3: Session A · Session B — Zone 2 · Session A. Week 4: A · B · Time Trial (OPTIONAL).
//   Session A  — 2 speed reps (split from CURRENT), 4 race-pace intervals at the current rung,
//                then (800m / 1.5 mi) 1 optional threshold rep, any cardio, no pace.
//   Ladder     — rung = rep length + pace (base pace − offset). Met = 4 intervals at or past length and pace,
//                3 rests ≤ 2:00. Higher rung met → jump there (counter 1); current met twice in a row → next rung.
//   CURRENT    — rung move: one rep converted to the race distance (run calculator), only if faster;
//                a faster Time Trial sets it. Never gets worse.
//   Zone 2     — +5 min per 2 full-length runs, up to a cap.
export const RUN_RULES = {
  calcExp: 1.06,          // run calculator (Riegel) exponent
  intervals: 4,           // race-pace intervals per Session A (R2, R3)
  speedReps: 2,           // speed reps per Session A (R2)
  maxRest: 120,           // s — a rest over this breaks the rung (R6)
  sessionsPerRung: 2,     // qualifying sessions in a row to move up (R6-R3)
  z2Step: 5,              // min added to Zone 2 (R9)
  z2FullRuns: 2,          // full-length Zone 2 runs per step (R9)
  defaultGain: { short: 3.75, long: 7.5 }, // s/mi per week, × distance (R10-R3)
};

type RunType = Extract<StandardType, "run800" | "run1_5" | "run3" | "run5">;

const MILE = 1609.344;

// Ladder (R3): the lead rungs (offset 0), then pairs of lengths (s), each pair `step` s/mi faster than the last.
interface Ladder { lead: number[]; pair: [number, number]; step: number }

interface RunPlan {
  meters: number;
  distLabel: string;
  short: boolean;           // 800m / 1.5 mi
  speedM: number;           // speed rep distance (R2)
  thresholdMin?: number;    // optional threshold rep (R2, short types only)
  ladder: Ladder;           // R3
  zone2: { start: number; cap: number }; // R9
}

const LONG_LADDER: Ladder = { lead: [180], pair: [300, 420], step: 30 };

export const RUN_PLANS: Record<RunType, RunPlan> = {
  run800: { meters: 800, distLabel: "800m", short: true, speedM: 100, thresholdMin: 3,
    ladder: { lead: [45], pair: [60, 75], step: 15 }, zone2: { start: 20, cap: 45 } },
  run1_5: { meters: 1.5 * MILE, distLabel: "1.5 mi", short: true, speedM: 200, thresholdMin: 7,
    ladder: { lead: [], pair: [90, 180], step: 15 }, zone2: { start: 25, cap: 50 } },
  run3: { meters: 3 * MILE, distLabel: "3 mi", short: false, speedM: 400,
    ladder: LONG_LADDER, zone2: { start: 30, cap: 60 } },
  run5: { meters: 5 * MILE, distLabel: "5 mi", short: false, speedM: 400,
    ladder: LONG_LADDER, zone2: { start: 40, cap: 75 } },
};

const plan = (s: Standard) => RUN_PLANS[s.type as RunType];
const miles = (s: Standard) => plan(s).meters / MILE;

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

// Interval length: "45s", "90s", "3 min", or M:SS otherwise
export const fmtLength = (sec: number) =>
  sec < 120 ? `${sec}s` : sec % 60 === 0 ? `${sec / 60} min` : fmtTime(sec);

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

// Card titles by position (R4). Logged sets, when given, decide it (old v0.3 week-4 logs had the trial first).
export function runSessionTitle(s: Standard, week: number, sessionIndex: number, sets?: SetActual[]): string {
  if (sessionIndex === 1) return "Session B — Zone 2";
  const trial = sets?.length ? sets.some((x) => x.part === "trial") : week === 4 && sessionIndex === 2;
  return trial ? "Time Trial" : "Session A — Intervals";
}

// Run calculator (Riegel): time over toM from a time over fromM
export function runCalc(time: number, fromM: number, toM: number, exp = RUN_RULES.calcExp): number {
  return time * Math.pow(toM / fromM, exp);
}

// Rung n (1-based) → rep length (s) and pace (s/mi) from base pace (R3)
export function rungAt(s: Standard, base: number, n: number): { length: number; pace: number } {
  const { lead, pair, step } = plan(s).ladder;
  if (n <= lead.length) return { length: lead[n - 1], pace: base };
  const i = n - lead.length - 1;
  return { length: pair[i % 2], pace: base - step * Math.floor(i / 2) };
}

// R1
export function initRunState(s: Standard): RunState {
  return {
    rung: 1,
    counter: 0,
    base: Math.round(s.start / miles(s)),
    current: s.start,
    z2Min: plan(s).zone2.start,
    z2Full: 0,
    trials: [],
    points: [{ date: s.createdAt, current: s.start }],
  };
}

// R11: a state saved under v0.3 (no rung) restarts on rung 1 from CURRENT pace; old ladder / adjustments dropped.
export function normalizeRunState(s: Standard, r: RunState | undefined): RunState {
  if (!r) return initRunState(s);
  if (r.rung != null) return r;
  return {
    rung: 1,
    counter: 0,
    base: Math.round(r.current / miles(s)),
    current: r.current,
    z2Min: plan(s).zone2.start,
    z2Full: 0,
    trials: r.trials ?? [],
    points: r.points ?? [{ date: s.createdAt, current: r.current }],
  };
}

const WARMUP = "10 min easy warm-up + cool-down";
const REST = "rest ≤ 2:00";

// Cards: weeks 1–3 A · B · A; week 4 A · B · Time Trial (OPTIONAL). Every card can be skipped (R4).
export function runWeek(s: Standard, t: TrainingState): Session[] {
  const p = plan(s);
  const r = normalizeRunState(s, t.run);
  const split = Math.round(runCalc(r.current, p.meters, p.speedM));      // R5-R1
  const rung = rungAt(s, r.base, r.rung);                                // R5-R2

  const sets: PlannedSet[] = [
    ...Array.from({ length: RUN_RULES.speedReps }, (): PlannedSet => ({ reps: 1, part: "speed", distance: p.speedM, time: split })),
    ...Array.from({ length: RUN_RULES.intervals }, (): PlannedSet => ({ reps: 1, part: "interval", length: rung.length, pace: rung.pace })),
    ...(p.thresholdMin ? [{ reps: 1, part: "threshold", minutes: p.thresholdMin } as PlannedSet] : []), // R5-R3
  ];
  const lines = [
    `${RUN_RULES.speedReps} × ${speedRepText(p.speedM, split)} · ${REST}`,
    `${RUN_RULES.intervals} × ${fmtLength(rung.length)} @ ${fmtPace(rung.pace)} · ${REST}`,
    ...(p.thresholdMin ? [`1 × ${p.thresholdMin} min threshold · any cardio · OPTIONAL`] : []),
    WARMUP,
  ];
  // Every run card can be SKIPPED; only the Time Trial carries the OPTIONAL tag.
  const sessionA: Session = { title: "Session A — Intervals", lines, sets, kind: "intervals", optional: true };

  const zone2: Session = {                                               // R5-R4: length only, no pace
    title: "Session B — Zone 2",
    lines: [`${r.z2Min} min · talk test or heart rate ≤ 180 − age`],
    sets: [{ reps: 1, part: "zone2", minutes: r.z2Min }],
    kind: "zone2",
    optional: true,
  };

  if (t.week !== 4) return [sessionA, zone2, { ...sessionA }];

  const trial: Session = {                                               // R5-R5
    title: "Time Trial",
    lines: [`${p.distLabel} all-out · CURRENT ${fmtTime(r.current)}`, WARMUP],
    sets: [{ reps: 1, part: "trial", distance: p.meters }],
    kind: "trial",
    optional: true,
    optionalTag: true,
  };
  return [sessionA, zone2, trial];
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

// R6: the 4 logged race-pace intervals meet a rung (length, pace, and the 3 rests between them)
type Rep = { length: number; pace: number; rest?: number };
function meets(reps: Rep[], rung: { length: number; pace: number }): boolean {
  return reps.every((x, i) =>
    x.length >= rung.length && x.pace <= rung.pace &&
    (i === reps.length - 1 || (x.rest != null && x.rest <= RUN_RULES.maxRest)));
}

// Apply one logged (or skipped) card to the run state. Pure — the caller saves the result.
export function applyRunResult(
  s: Standard,
  t: TrainingState,
  session: Session,
  sets: SetActual[] | undefined,
  skipped = false,
  today = new Date()
): RunState {
  const prev = normalizeRunState(s, t.run);
  const r: RunState = { ...prev, trials: [...prev.trials], points: [...prev.points] };
  if (skipped || !sets) return r;                     // R6-R1, R8-R1
  const date = today.toISOString().slice(0, 10);

  if (session.kind === "trial") {
    const time = sets[0]?.time;
    if (time == null) return r;                       // R8-R1
    r.trials.push({ date, time, cycle: t.cycle });    // every trial time is saved
    if (time < r.current) {                           // R8-R2
      r.current = time;
      r.points.push({ date, current: time });
    }                                                 // R8-R3: holds
    return r;
  }

  if (session.kind === "zone2") {                     // R9: full-length runs grow the length
    const min = sets[0]?.minutes;
    if (min != null && min >= r.z2Min) {
      r.z2Full += 1;
      if (r.z2Full >= RUN_RULES.z2FullRuns) {
        r.z2Min = Math.min(plan(s).zone2.cap, r.z2Min + RUN_RULES.z2Step);
        r.z2Full = 0;
      }
    }
    return r;
  }

  if (session.kind !== "intervals") return r;

  const planned = session.sets ?? [];
  const reps = planned.flatMap((p, i) => (p.part === "interval" ? [sets[i]] : []));
  const all = reps.length === RUN_RULES.intervals && reps.every((x) => x?.length != null && x.pace != null);
  if (!all) { r.counter = 0; return r; }              // R6-R5: not all logged
  const logged = reps as Rep[];

  // R6-R2: highest rung above the current one that was met (paces only get faster up the ladder)
  const slowest = Math.max(...logged.map((x) => x.pace));
  let highest = 0;
  for (let n = r.rung + 1; n < r.rung + 1000; n++) {
    const rung = rungAt(s, r.base, n);
    if (rung.pace < slowest) break;
    if (meets(logged, rung)) highest = n;
  }

  let moved = false;
  if (highest > r.rung) {                             // R6-R2
    r.rung = highest; r.counter = 1; moved = true;
  } else if (meets(logged, rungAt(s, r.base, r.rung))) {
    r.counter += 1;                                   // R6-R4
    if (r.counter >= RUN_RULES.sessionsPerRung) { r.rung += 1; r.counter = 0; moved = true; } // R6-R3
  } else {
    r.counter = 0;                                    // R6-R5
  }

  if (moved) {                                        // R7: one average rep converted to the race distance
    const len = avg(logged.map((x) => x.length));
    const pace = avg(logged.map((x) => x.pace));
    const converted = Math.round(runCalc(len, (len / pace) * MILE, plan(s).meters));
    if (converted < r.current) {                      // R7-R1
      r.current = converted;
      r.points.push({ date, current: converted });
    }                                                 // R7-R2: holds
  }
  return r;
}

// CURRENT shown in the UI (whole seconds)
export function runCurrent(s: Standard, t: TrainingState): number {
  return Math.round(t.run?.current ?? s.start);
}

// R10: weeks until CURRENT reaches target (0 = reached)
export function runWeeksToTarget(s: Standard, t: TrainingState, current = runCurrent(s, t), now = new Date()): number {
  if (current <= s.target) return 0;                                      // R10-R1
  const weeks = (now.getTime() - new Date(s.createdAt).getTime()) / (7 * 86400000);
  const observed = (s.start - current) / weeks;
  const perWeek = weeks >= 2 && observed > 0
    ? observed                                                            // R10-R2
    : (plan(s).short ? RUN_RULES.defaultGain.short : RUN_RULES.defaultGain.long) * miles(s); // R10-R3
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
