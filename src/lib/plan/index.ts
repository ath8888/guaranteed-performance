import type { Standard, TrainingState } from "../types";
import type { Session } from "./shared";
import { ENGINES } from "./registry";

export * from "./shared";
export * from "./progression";
export type { StandardEngine } from "./registry";
export { ENGINES } from "./registry";
export { liftWeek, strengthEngine } from "./strength";
export { pushupWeek, calisthenicsEngine } from "./calisthenics";
export { runWeek, paceTargets, runEngine } from "./run";
export { pullupWeek, pullupsEngine } from "./pullups";

export function buildWeek(s: Standard, t: TrainingState, currentValue?: number): Session[] {
  return ENGINES[s.type].buildWeek(s, t, currentValue);
}
