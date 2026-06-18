# Editable Plan sets + Wendler AMRAP progression

## Goal

On the Plan tab, every set (warmups/main/BBB) becomes editable for weight and reps. Actuals are saved per set. When the wave advances from Week 4 to a new cycle, the next Training Max is computed from the **Week 3 AMRAP set actuals** using standard Wendler rules.

## Data model

Extend `SessionLog` with optional per-set actuals; keep the existing toggle semantics (presence of a log = "complete").

```ts
// src/lib/types.ts
export interface SetActual { weight?: number; reps?: number }  // weight in lb, omit for pushups
export interface SessionLog {
  id: string;
  standardId: string;
  cycle: number;
  week: number;
  sessionIndex: number;
  completedAt: string;
  sets?: SetActual[];   // index matches Session.lines order
}
```

The plan engine returns structured set data alongside display strings so the UI can render inputs prefilled with the prescribed numbers.

```ts
// src/lib/plan.ts
export interface PlannedSet { weight?: number; reps: number; amrap?: boolean }
export interface Session {
  title: string;
  lines: string[];        // kept for fallback / run sessions
  sets?: PlannedSet[];    // present for lifts, pushups, BBB
  amrap?: boolean;
  kind?: "main" | "bbb";  // so progression can find the AMRAP set
}
```

Run sessions stay text-only (no editable sets) — running progression already uses the timed 3-mile check-in.

## UI changes (`src/routes/plan.tsx`)

For each session card:
- Render a small row per `PlannedSet`: `[weight input] lb × [reps input]` (pushups: reps only). Inputs are prefilled with the planned values and the AMRAP set's reps input is highlighted with a "+" hint.
- Add a "Save" affordance per session (or autosave on blur) that writes the `sets[]` into the SessionLog and marks the session complete. Tapping the check circle still toggles complete without edits (uses planned values as actuals).
- Editing a saved session updates its `sets[]` in place.
- Keep the existing "Advance to week N" / "Complete wave" buttons.

Touch targets stay ≥44px; numeric inputs use `inputMode="numeric"`, no spinners. Clinical styling — no badges.

## Progression logic (Wendler, AMRAP-only)

New helper in `src/lib/plan.ts`:

```ts
// Standard Wendler decision from the Week 3 top-set AMRAP:
// reps >= prescribed + 1  → bump TM (+5 upper, +10 lower, +2 pushups)
// reps == prescribed      → hold TM
// reps <  prescribed      → reset: TM * 0.9 (rounded)
export function wendlerNextTM(s: Standard, currentTM: number, amrapReps: number): number
```

`advanceWave` in `src/lib/db.ts`:
- When moving from Week 4 → next cycle for lifts/pushups, read the most recent Week 3 SessionLog for that standard, find its `main` session's last set actuals, and pass `amrapReps` to `wendlerNextTM`.
- If no AMRAP actual was logged, hold the current TM (no change) rather than guessing.
- Run progression is unchanged (still uses the 3-mile check-in).
- ETA recomputation continues to fire on wave advance as today.

## Out of scope

- No new screens, no charts, no per-set history view.
- No changes to Check-in, Guarantee, or Home.
- Running sessions remain non-editable in this pass.

## Files touched

- `src/lib/types.ts` — add `SetActual`, extend `SessionLog`.
- `src/lib/plan.ts` — add `PlannedSet`, populate `Session.sets`, add `wendlerNextTM`.
- `src/lib/db.ts` — extend `sessionService` to save/read `sets[]`; update `advanceWave` to use Week 3 AMRAP actuals.
- `src/routes/plan.tsx` — editable set rows, save/complete flow.
- `docs/tasks.md` — mark new tasks and completion.
