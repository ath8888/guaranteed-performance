import { STANDARD_META, type Standard } from "../types";
import { ENGINES } from "./registry";

export function initTrainingMax(s: Standard): number {
  return ENGINES[s.type].initTrainingMax(s);
}

export function progressTrainingMax(s: Standard, current: number, amrapValue?: number): number {
  return ENGINES[s.type].progressTrainingMax(s, current, amrapValue);
}

export function wendlerNextTM(s: Standard, currentTM: number, amrapReps?: number): number {
  return ENGINES[s.type].nextTM(s, currentTM, amrapReps);
}

export function wavesToTarget(s: Standard, currentValue: number): number {
  const meta = STANDARD_META[s.type];
  const met = meta.lower ? currentValue <= s.target : currentValue >= s.target;
  if (met) return 0;
  return ENGINES[s.type].wavesToTarget(s, currentValue);
}

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
