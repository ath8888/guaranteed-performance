import type { Standard, StandardType, TrainingState } from "./types";

// 5/3/1 wave percentages
const WAVE = {
  1: [0.65, 0.75, 0.85],
  2: [0.70, 0.80, 0.90],
  3: [0.75, 0.85, 0.95],
  4: [0.40, 0.50, 0.60], // deload
} as const;
const REP_SCHEME = { 1: [5, 5, 5], 2: [3, 3, 3], 3: [5, 3, 1], 4: [5, 5, 5] } as const;

export function roundLb(x: number) { return Math.round(x / 5) * 5; }

export function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function parseTime(input: string): number {
  const t = input.trim();
  if (t.includes(":")) {
    const [m, s] = t.split(":").map(Number);
    return (m || 0) * 60 + (s || 0);
  }
  return Number(t) || 0;
}

export function fmtValue(type: StandardType, v: number): string {
  if (type === "run3mi") return fmtTime(v);
  if (type === "pushups") return `${v}`;
  return `${v} lb`;
}

export interface Session {
  title: string;
  lines: string[];
  amrap?: boolean;
}

export function initTrainingMax(s: Standard): number {
  if (s.type === "run3mi") {
    // target pace seconds/mile based on baseline
    return Math.round(s.baseline / 3);
  }
  if (s.type === "pushups") return Math.round(s.baseline * 0.9);
  return roundLb(s.baseline * 0.9);
}

export function progressTrainingMax(s: Standard, current: number): number {
  if (s.type === "run3mi") return Math.max(current - 3, Math.round(s.target / 3));
  if (s.type === "pushups") return current + 2;
  if (s.type === "bench" || s.type === "ohp") return current + 5;
  return current + 10; // squat / dl
}

export function buildWeek(s: Standard, t: TrainingState): Session[] {
  const week = t.week;
  if (s.type === "run3mi") return runWeek(week, t.trainingMax);
  if (s.type === "pushups") return pushupWeek(week, t.trainingMax);
  return liftWeek(s.type, week, t.trainingMax);
}

function liftWeek(_type: StandardType, week: 1 | 2 | 3 | 4, tm: number): Session[] {
  const pcts = WAVE[week];
  const reps = REP_SCHEME[week];
  const main: Session = {
    title: week === 4 ? "Main lift — Deload" : "Main lift",
    lines: pcts.map((p, i) => {
      const lbs = roundLb(tm * p);
      const r = reps[i];
      const last = i === pcts.length - 1 && week !== 4;
      return `${lbs} lb × ${r}${last ? "+" : ""}`;
    }),
    amrap: week !== 4,
  };
  if (week === 4) return [main];
  const bbb: Session = {
    title: "Boring But Big",
    lines: [`5 × 10 @ ${roundLb(tm * 0.5)} lb`],
  };
  return [main, bbb];
}

function pushupWeek(week: 1 | 2 | 3 | 4, repTM: number): Session[] {
  const pcts = WAVE[week];
  const reps = REP_SCHEME[week];
  const main: Session = {
    title: week === 4 ? "Main set — Deload" : "Main set",
    lines: pcts.map((p, i) => {
      const r = Math.max(1, Math.round(repTM * p));
      const last = i === pcts.length - 1 && week !== 4;
      return `${r} reps${week !== 4 ? ` (target ${reps[i]}${last ? "+" : ""})` : ""}`;
    }),
    amrap: week !== 4,
  };
  if (week === 4) return [main];
  const bbb: Session = {
    title: "Volume",
    lines: [`5 × ${Math.max(1, Math.round(repTM * 0.5))} reps`],
  };
  return [main, bbb];
}

function runWeek(week: 1 | 2 | 3 | 4, paceSecPerMile: number): Session[] {
  const tempo = paceSecPerMile + 20;
  const easy = paceSecPerMile + 60;
  const interval = Math.max(paceSecPerMile - 20, 240);
  if (week === 4) return [
    { title: "Easy run", lines: [`2 miles @ ${fmtTime(easy)}/mi`] },
    { title: "Timed test — 3 miles", lines: ["All-out effort. Record your time."], amrap: true },
  ];
  return [
    { title: "Intervals", lines: [`6 × 400m @ ${fmtTime(interval)}/mi pace`, "Rest 90s between"] },
    { title: "Tempo", lines: [`2 miles @ ${fmtTime(tempo)}/mi`] },
    { title: "Easy run", lines: [`3 miles @ ${fmtTime(easy)}/mi`] },
  ];
}
