import type { Standard, TrainingState } from "../types";
import type { Session } from "./shared";
import { liftWeek } from "./strength";
import { pushupWeek } from "./calisthenics";
import { runWeek } from "./run";

export * from "./shared";
export * from "./progression";
export { liftWeek } from "./strength";
export { pushupWeek } from "./calisthenics";
export { runWeek, paceTargets } from "./run";

export function buildWeek(s: Standard, t: TrainingState): Session[] {
  const week = t.week;
  if (s.type === "run3mi") {
    const standardPaceSec = Math.round(s.target / 3);
    return runWeek(week, t.trainingMax, standardPaceSec);
  }
  if (s.type === "pushups") return pushupWeek(week, t.trainingMax);
  return liftWeek(week, t.trainingMax);
}
