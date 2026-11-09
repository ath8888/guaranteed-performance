import type { Standard, TrainingState } from "../engine/types";
import { isWeekComplete } from "../engine/progression";
import { currentAtCycleEnd, liftCurrent, liftTM } from "../engine/strength";
import { olympicCurrentAtCycleEnd } from "../engine/olympic";
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
        if (t.week === 4) {
          current = standard.category === "olympic"
            ? olympicCurrentAtCycleEnd(current, logs, t.cycle)        // O3
            : currentAtCycleEnd(standard, current, logs, t.cycle);    // L5
        }
        await TrainingService.save({ ...t, current, trainingMax: liftTM(current) });
        t = await TrainingService.advanceWeek(standard.id, liftTM(current));
      } else {
        // Push-ups and Run apply their rules per card; nothing extra at cycle end.
        t = await TrainingService.advanceWeek(standard.id, t.trainingMax);
      }
    }
    return t;
  },
};
