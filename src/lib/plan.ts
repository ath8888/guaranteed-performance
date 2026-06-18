import { STANDARD_META, type Standard, type StandardType, type TrainingState } from "./types";

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
    // current pace = baseline time / 3 (seconds per mile)
    return Math.round(s.baseline / 3);
  }
  if (s.type === "pushups") return Math.round(s.baseline * 0.9);
  return roundLb(s.baseline * 0.9);
}

export function progressTrainingMax(s: Standard, current: number, amrapValue?: number): number {
  if (s.type === "run3mi") {
    // amrapValue here = latest 3-mile test time in seconds; convert to pace/mile.
    if (amrapValue && amrapValue > 0) return Math.round(amrapValue / 3);
    return current;
  }
  if (s.type === "pushups") return current + 2;
  if (s.type === "bench" || s.type === "ohp") return current + 5;
  return current + 10; // squat / deadlift
}

export function buildWeek(s: Standard, t: TrainingState): Session[] {
  const week = t.week;
  if (s.type === "run3mi") {
    const standardPaceSec = Math.round(s.target / 3);
    return runWeek(week, t.trainingMax, standardPaceSec);
  }
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

/**
 * Running pace targets per spec — recalculated at the start of each wave.
 * - currentPaceSec: seconds per mile, from latest 3-mile test ÷ 3.
 * - standardPaceSec: seconds per mile required to pass (target time ÷ 3).
 *
 * Edge case: if current pace already meets the standard, use small fixed
 * stretch targets off current pace instead of standard-relative math.
 */
export function paceTargets(standardPaceSec: number, currentPaceSec: number) {
  if (currentPaceSec <= standardPaceSec) {
    return {
      easy: currentPaceSec + 50,
      tempo: currentPaceSec - 5,
      interval: currentPaceSec - 10,
    };
  }
  return {
    easy: currentPaceSec + 50,
    tempo: Math.round(currentPaceSec - (currentPaceSec - standardPaceSec) * 0.5),
    interval: standardPaceSec - 18,
  };
}

function runWeek(week: 1 | 2 | 3 | 4, currentPaceSec: number, standardPaceSec: number): Session[] {
  const { easy, tempo, interval } = paceTargets(standardPaceSec, currentPaceSec);
  if (week === 4) {
    return [
      { title: "Easy run", lines: [`20 min @ ${fmtTime(easy)}/mi`] },
      {
        title: "Timed test — 3 miles",
        lines: ["All-out effort.", "Log the time on Check-in to advance the wave."],
        amrap: true,
      },
    ];
  }
  return [
    {
      title: "Intervals",
      lines: [
        `6 × 400m @ ${fmtTime(interval)}/mi pace`,
        "400m easy jog between reps",
      ],
    },
    {
      title: "Tempo",
      lines: [
        `15–20 min @ ${fmtTime(tempo)}/mi`,
        "+ 5 min warm-up & cool-down easy",
      ],
    },
    { title: "Easy run", lines: [`20–25 min @ ${fmtTime(easy)}/mi`] },
  ];
}

/**
 * Minimum number of 4-week waves needed to reach `s.target` from a given
 * current value, using the same progression the Plan engine actually
 * applies (lifts +5/+10, pushups +2, run ~5 sec/mile per wave).
 * Returns 0 when the target is already met.
 */
export function wavesToTarget(s: Standard, currentValue: number): number {
  const meta = STANDARD_META[s.type];
  const met = meta.lower ? currentValue <= s.target : currentValue >= s.target;
  if (met) return 0;
  switch (s.type) {
    case "bench":
    case "ohp":      return Math.ceil((s.target - currentValue) / 5);
    case "squat":
    case "deadlift": return Math.ceil((s.target - currentValue) / 10);
    case "pushups":  return Math.ceil((s.target - currentValue) / 2);
    case "run3mi": {
      const curPace = currentValue / 3;
      const tgtPace = s.target / 3;
      return Math.max(1, Math.ceil((curPace - tgtPace) / 5));
    }
  }
}

/** Date the standard is estimated to be met. Null if already met. */
export function etaDate(s: Standard, currentValue: number, from = new Date()): Date | null {
  const waves = wavesToTarget(s, currentValue);
  if (waves === 0) return null;
  const d = new Date(from);
  d.setDate(d.getDate() + waves * 28);
  return d;
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
