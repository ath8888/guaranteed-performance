import type { StandardType } from "../types";

// 5/3/1 wave percentages
export const WAVE = {
  1: [0.65, 0.75, 0.85],
  2: [0.70, 0.80, 0.90],
  3: [0.75, 0.85, 0.95],
  4: [0.40, 0.50, 0.60], // deload
} as const;

export const REP_SCHEME = {
  1: [5, 5, 5],
  2: [3, 3, 3],
  3: [5, 3, 1],
  4: [5, 5, 5],
} as const;

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

export interface PlannedSet {
  weight?: number;
  reps: number;
  amrap?: boolean;
  note?: string;
}

export interface Session {
  title: string;
  lines: string[];
  sets?: PlannedSet[];
  amrap?: boolean;
  kind?: "main" | "bbb" | "fsl" | "density" | "test";
}
