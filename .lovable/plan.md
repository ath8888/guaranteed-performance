
# Split Plan engines: Strength / Calisthenics / Run

## Goal

Separate the Plan engine by Standard type so each follows a discipline-appropriate method:

- **Strength** (bench, OHP, squat, deadlift): unchanged — Wendler 5/3/1 + Boring But Big.
- **Calisthenics** (pushups): new 2-day hybrid — Day A (5/3/1 strength anchor + FSL accessory), Day B (adaptive density + test specificity).
- **Run** (3-mile): unchanged.

## Calisthenics hybrid — what the user sees

Two sessions per week instead of today's main + BBB. Both render with editable weight/reps rows (weight hidden for pushups).

### Day A — 5/3/1 Strength Anchor
Mirrors today's pushup main session: % of Rep TM treated as prescribed rep counts, last set AMRAP (weeks 1–3 only).

| Week | Sets (% of Rep TM × prescribed reps) |
|------|---------------------------------------|
| 1    | 65% × 5, 75% × 5, 85% × 5+           |
| 2    | 70% × 3, 80% × 3, 90% × 3+           |
| 3    | 75% × 5, 85% × 3, 95% × 1+           |
| 4    | 40% × 5, 50% × 5, 60% × 5 (deload, no AMRAP) |

**FSL accessory** (replaces current "Volume 5×N"): 3 sets × `round(0.55 × Rep TM)` reps, relaxed pace. Weeks 1–3 only; week 4 skips FSL.

### Day B — Adaptive Density + Test
Density volume scales off Rep TM each cycle (the user's "adaptive (coach)" choice). Let `TM` be the current Rep TM.

| Week | Density block                                                         | Then                                       |
|------|------------------------------------------------------------------------|--------------------------------------------|
| 1    | 10 sets × `round(0.22 × TM)` reps, 30–45 s rest                        | —                                          |
| 2    | 8 sets × `round(0.26 × TM)` reps, 30 s rest                            | 1 × 2-min effort @ ~80% pace               |
| 3    | 6 sets × `round(0.32 × TM)` reps, 30 s rest                            | 1 × full 2-min test (AMRAP, logs Check-in) |
| 4    | 5 sets × `round(0.20 × TM)` reps, easy                                 | 1 × relaxed 2-min @ ~85% (AMRAP, optional) |

Coefficients chosen so a TM of ~47 reproduces the doc's printed numbers (10, 12, 15, 10) within ±1 rep and scales naturally as TM grows.

### Test-effort → Check-in auto-log
The 2-minute test sets on Day B weeks 2/3/4 are flagged `kind: "test"`. Saving a Day B session with a value in that set's reps input:
- writes the SessionLog as today, AND
- creates a `CheckIn { value: reps, date: today }` for that standard.

This makes "current" and ETA update immediately without a separate Check-in trip. Existing duplicate-checkin behavior unchanged (latest wins).

### Wendler progression (unchanged rule)
Next-cycle Rep TM still decided by Day A Week 3 AMRAP only via the existing `wendlerNextTM()` — density work doesn't drive TM. If user logged a Week 3 full 2-min test that exceeds current target, the Check-in side handles "Ready now" status.

## Code structure

Today `src/lib/plan.ts` has `liftWeek`, `pushupWeek`, `runWeek` already co-located. Split into per-discipline modules for clarity (per project rule: "each Standard type's logic swappable independently"):

```
src/lib/plan/
  index.ts          // re-exports + buildWeek dispatcher, shared helpers
  shared.ts         // roundLb, fmtTime/parseTime/fmtValue, PlannedSet, Session types, WAVE/REP_SCHEME constants
  strength.ts       // liftWeek (unchanged Wendler+BBB)
  calisthenics.ts   // pushupDayA + pushupDayB (new hybrid)
  run.ts            // runWeek + paceTargets (unchanged)
  progression.ts    // wendlerNextTM, progressTrainingMax, initTrainingMax, wavesToTarget, etaDate
```

`src/lib/plan.ts` becomes a thin re-export shim so existing imports (`@/lib/plan`) keep working — no consumer churn.

### Session type extension

```ts
// src/lib/plan/shared.ts
export interface PlannedSet {
  weight?: number;
  reps: number;
  amrap?: boolean;
  note?: string;          // e.g. "30–45s rest", "2-min effort @80%"
}
export interface Session {
  title: string;
  lines: string[];
  sets?: PlannedSet[];
  amrap?: boolean;
  kind?: "main" | "bbb" | "fsl" | "density" | "test";
}
```

`kind: "test"` is the new signal Plan.tsx uses to fire the Check-in auto-log on save.

## Plan tab changes (`src/routes/plan.tsx`)

- Render whatever sessions `buildWeek` returns (already does this) — no per-type branching in the route.
- On Save, if any saved set belongs to a session with `kind === "test"` and has `reps > 0`, also call `checkinService.add({ standardId, value: reps, date: today })`.
- Add a subtle line under test sessions: "Logs as Check-in on save."

No styling changes, no new screens. Touch targets, no badges, clinical tone preserved.

## Out of scope

- No new screens or charts.
- Run engine untouched.
- No changes to lift sessions (warmups/main/BBB stay as today).
- Density coefficients are fixed constants in this pass; no UI to tune them.

## Files touched

- **New:** `src/lib/plan/shared.ts`, `src/lib/plan/strength.ts`, `src/lib/plan/calisthenics.ts`, `src/lib/plan/run.ts`, `src/lib/plan/progression.ts`, `src/lib/plan/index.ts`
- **Edit:** `src/lib/plan.ts` (reduce to re-export shim), `src/routes/plan.tsx` (test → Check-in auto-log), `src/lib/types.ts` (no schema change expected; verify `Session.kind` union)
- **Docs:** `.lovable/plan.md`, `docs/tasks.md`
