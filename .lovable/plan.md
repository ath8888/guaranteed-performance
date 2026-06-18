
# Inverted Deadline → Computed Target Date

App computes a Target date from baseline + target using the plan engine's own per-wave progression. User never enters a date.

## 1. ETA engine — new in `src/lib/plan.ts`

```ts
/** Minimum number of 4-week waves needed to go from current → target,
 *  using the same progression the Plan engine actually applies. */
export function wavesToTarget(s: Standard, currentValue: number): number {
  const meta = STANDARD_META[s.type];
  const met = meta.lower ? currentValue <= s.target : currentValue >= s.target;
  if (met) return 0;

  switch (s.type) {
    case "bench":
    case "ohp":      return Math.ceil((s.target - currentValue) / 5);
    case "squat":
    case "deadlift": return Math.ceil((s.target - currentValue) / 10);
    case "pushups":  return Math.ceil((s.target - currentValue) / 2);
    case "run3mi": {
      // Pace is sec/mile; ~5 sec/mile gained per wave is the conservative
      // assumption until a real Week-4 test refines it.
      const curPace = currentValue / 3;
      const tgtPace = s.target / 3;
      return Math.ceil((curPace - tgtPace) / 5);
    }
  }
}

/** Days to target, rounded up to a whole week boundary. */
export function etaDate(s: Standard, currentValue: number, from = new Date()): Date | null {
  const waves = wavesToTarget(s, currentValue);
  if (waves === 0) return null;            // already met → caller shows "Ready now"
  const d = new Date(from);
  d.setDate(d.getDate() + waves * 28);
  return d;
}
```

## 2. Setup screen — remove deadline input
- Drop the date `<input>` and the <4-weeks warning entirely.
- In the values step, under each Standard's baseline/target pair, show a live preview line:
  - If both fields parse and `wavesToTarget > 0`: `Target date: {etaDate}` (mm/dd/yyyy, locale-aware) + `{waves} wave{s} (~{waves×4} weeks)`
  - If already met: `Ready now`
  - If fields incomplete: nothing
- "Lock in standards" still saves; `standard.deadline` is set to `etaDate(s, baseline)` (or `today` for the already-met case so Guarantee math still works).

## 3. Schema — keep `deadline` field, repurpose meaning
- No type change. `Standard.deadline` now stores the computed target date.
- Existing data keeps working; the value just gets overwritten on the next wave advance.

## 4. Recompute on wave advance only
- In `advanceWave()` (in `src/lib/db.ts`):
  - After bumping cycle/week and updating `trainingMax`, also recompute and save `standard.deadline = etaDate(s, newCurrentValue)` where `newCurrentValue = latest check-in or baseline`.
  - For runs, `newCurrentValue` is the just-logged test time (the `amrapValue` passed in).
  - If `wavesToTarget === 0`, set `deadline = new Date().toISOString()` so Guarantee correctly shows "Standard met."
- Mid-wave check-ins do NOT touch the date — the displayed value just shifts under "Current."

## 5. Display
- **Home card**: replace `{days}d left` with `Target {Mmm d}` (computed from `standard.deadline`). If already met, show `Ready` in primary blue.
- **Guarantee card**: replace `By {date}` with `Target {date}`. Refund eligibility logic (`past && !hit`) is unchanged — still keyed off `standard.deadline`.

## 6. Tasks.md
Add a brief "Date model" note explaining: deadline = computed, never user-entered; recomputed only on wave advance.

## Out of scope
No new screens. No retroactive recompute for Standards created before this change — next wave advance will fix them automatically (or user can reset via Settings).
