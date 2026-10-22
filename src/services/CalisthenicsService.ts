import type { SetActual, Standard, TrainingState } from "../engine/types";
import { ENGINES } from "../engine/registry";
import { applyCalisthenicsResult } from "../engine/calisthenics";
import { isWeekComplete } from "../engine/progression";
import { SessionService } from "./SessionService";
import { TrainingService } from "./TrainingService";

export const CalisthenicsService = {
  // Log a completed or skipped calisthenics card, apply its progression, and move to the next
  // week once every card in the week is logged (completed or skipped). Returns the saved state.
  async record(
    standard: Standard,
    state: TrainingState,
    sessionIndex: number,
    sets: SetActual[] | undefined,
    skipped = false
  ): Promise<TrainingState> {
    const session = ENGINES[standard.type].buildWeek(standard, state)[sessionIndex];
    await SessionService.log(standard.id, state.cycle, state.week, sessionIndex, sets, skipped);
    const next: TrainingState = { ...state, cal: applyCalisthenicsResult(state, session, sets, skipped) };
    await TrainingService.save(next);
    const logs = await SessionService.getAll(standard.id);
    if (isWeekComplete(standard, state, logs)) {
      return TrainingService.advanceWeek(standard.id, state.trainingMax);
    }
    return next;
  },
};
