import type { SetActual, Standard, TrainingState } from "../engine/types";
import { currentAfterTopSet, currentAtCycleEnd, liftCurrent, liftTM } from "../engine/strength";
import { olympicCurrentAtCycleEnd } from "../engine/olympic";
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
    skipped = false
  ): Promise<TrainingState> {
    await SessionService.log(standard.id, state.cycle, state.week, sessionIndex, sets, skipped);
    let current = liftCurrent(state);
    const olympic = standard.category === "olympic";
    // L4: the main lift's + set moves CURRENT right away (Olympic: no AMRAP, never mid-cycle)
    const top = sets?.[sets.length - 1];
    if (!olympic && !skipped && sessionIndex === 0 && top?.weight != null && top.reps != null) {
      current = currentAfterTopSet(current, state.week, top.weight, top.reps);
    }
    const logs = await SessionService.getAll(standard.id);
    // L5 / O3: cycle end
    if (state.week === 4 && isWeekComplete(standard, state, logs)) {
      current = olympic
        ? olympicCurrentAtCycleEnd(current, logs, state.cycle)
        : currentAtCycleEnd(standard, current, logs, state.cycle);
    }
    const next: TrainingState = { ...state, current, trainingMax: liftTM(current) };
    await TrainingService.save(next);
    if (isWeekComplete(standard, state, logs)) {
      return TrainingService.advanceWeek(standard.id, next.trainingMax);
    }
    return next;
  },
};
