import type { Standard, TrainingState } from "../engine/types";
import { isWeekComplete } from "../engine/progression";
import { currentAtCycleEnd, liftCurrent, liftTM } from "../engine/strength";
import { olympicCurrentAtCycleEnd, olympicDueForProgress } from "../engine/olympic";
import { SessionService } from "./SessionService";
import { TrainingService } from "./TrainingService";

// Shared S3 (decision-tables/shared.md), checked when the plan opens: a week whose cards are all
// logged but that never moved on catches up — next week, or (after week 4) the cycle-end rule then
// week 1. Returns the saved state (unchanged when nothing was stuck).
export const WeekService = {
  async catchUp(standard: Standard, state: TrainingState): Promise<TrainingState> {
    const logs = await SessionService.getAll(standard.id);
    let t = state;
    for (let guard = 0; guard < 4 && isWeekComplete(standard, t, logs); guard++) {
      if (standard.category === "lifts" || standard.category === "olympic") {
        let current = liftCurrent(t);
        let olyProgressCycle = t.olyProgressCycle;
        if (standard.category === "olympic" && olympicDueForProgress(t)) {
          current = olympicCurrentAtCycleEnd(current, logs, t.cycle);   // O3: end of week 3, once per cycle
          olyProgressCycle = t.cycle;
        } else if (standard.category === "lifts" && t.week === 4) {
          current = currentAtCycleEnd(standard, current, logs, t.cycle); // L5
        }
        await TrainingService.save({
          ...t, current, trainingMax: liftTM(current),
          ...(olyProgressCycle !== undefined ? { olyProgressCycle } : {}),
        });
        t = await TrainingService.advanceWeek(standard.id, liftTM(current));
      } else {
        // Push-ups and Run apply their rules per card; nothing extra at cycle end.
        t = await TrainingService.advanceWeek(standard.id, t.trainingMax);
      }
    }
    return t;
  },
};
