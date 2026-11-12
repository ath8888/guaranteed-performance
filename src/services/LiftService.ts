import type { LogExtras, SetActual, Standard, TrainingState } from "../engine/types";
import { currentAfterTopSet, currentAtCycleEnd, liftCurrent, liftTM } from "../engine/strength";
import { olympicCurrentAtCycleEnd, olympicDueForProgress } from "../engine/olympic";
import { isWeekComplete } from "../engine/progression";
import { SessionService } from "./SessionService";
import { TrainingService } from "./TrainingService";

// Lifts (decision-tables/lifts.md) and Olympic lifts (olympic-lifts.md): log a card, move CURRENT
// (TM = 90% of it), advance the week once every card is logged. Returns the saved state.
export const LiftService = {
  async record(
    standard: Standard,
    state: TrainingState,
    sessionIndex: number,
    sets: SetActual[] | undefined,
    skipped = false,
    extras: LogExtras = {}
  ): Promise<TrainingState> {
    await SessionService.log(standard.id, state.cycle, state.week, sessionIndex, sets, skipped, extras);
    let current = liftCurrent(state);
    const olympic = standard.category === "olympic";
    // L4: the main lift's + set moves CURRENT right away (Olympic: no AMRAP, never mid-cycle)
    const top = sets?.[sets.length - 1];
    if (!olympic && !skipped && sessionIndex === 0 && top?.weight != null && top.reps != null) {
      current = currentAfterTopSet(current, state.week, top.weight, top.reps);
    }
    const logs = await SessionService.getAll(standard.id);
    const weekDone = isWeekComplete(standard, state, logs);
    let olyProgressCycle = state.olyProgressCycle;
    if (olympic && weekDone && olympicDueForProgress(state)) {
      // O3: end of week 3 (once per cycle)
      current = olympicCurrentAtCycleEnd(current, logs, state.cycle);
      olyProgressCycle = state.cycle;
    } else if (!olympic && state.week === 4 && weekDone) {
      // L5: cycle end
      current = currentAtCycleEnd(standard, current, logs, state.cycle);
    }
    const next: TrainingState = {
      ...state, current, trainingMax: liftTM(current),
      ...(olyProgressCycle !== undefined ? { olyProgressCycle } : {}),
    };
    await TrainingService.save(next);
    if (isWeekComplete(standard, state, logs)) {
      return TrainingService.advanceWeek(standard.id, next.trainingMax);
    }
    return next;
  },
};
