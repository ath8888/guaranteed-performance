import { fmtTime, fmtTimeDigits, parseTime } from "../engine/run";

// F31: typed number entry. "int" = whole numbers (reps, lb, minutes); "time" = M:SS typed as digits.
export type EntryKind = "int" | "time";

// What the field shows while typing: digits only for int, auto M:SS for time.
export function cleanEntry(kind: EntryKind, text: string): string {
  if (kind === "time") return fmtTimeDigits(text);
  return text.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 4);
}

// Typed text → number, or null when empty / not a valid value.
export function parseEntry(kind: EntryKind, text: string): number | null {
  if (kind === "time") return parseTime(text);
  if (text === "") return null;
  const n = parseInt(text, 10);
  return isNaN(n) ? null : n;
}

// The text a field starts with when tapped: the current value, ready to overwrite.
export function editText(kind: EntryKind, value: number | null): string {
  if (value == null) return "";
  return kind === "time" ? fmtTimeDigits(fmtTime(value)) : String(value);
}

// Same limits as the −/+ buttons.
export const clampMin = (min: number) => (n: number) => Math.max(min, n);
export const clampReps = (cap: number | undefined) => (n: number) => Math.min(cap ?? Infinity, Math.max(0, n));
