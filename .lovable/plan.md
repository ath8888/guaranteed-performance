## Goal

Confirm the registry refactor + pull-ups standard from the recent GitHub commits work end-to-end, record them in the task tracker, and clean up the leftover compatibility shim.

## Steps

### 1. Manual smoke test (Playwright, headless)

Drive `http://localhost:8080` to exercise the new Pull-ups path:

1. Open `/setup`, select **Pull-ups**, enter a baseline (e.g. 8 reps), a deadline (~8 weeks out), and a target (e.g. 20). Submit.
2. Land on `/` (Home) — verify baseline, current, target, days remaining render with no console errors.
3. Open `/plan` — verify a week of sessions renders (Day A weighted 5/3/1 + Day B bodyweight) without runtime errors.
4. Open `/checkin` and `/guarantee` briefly to confirm no regressions for other types.

Screenshots saved under `/tmp/browser/pullups-smoke/screenshots/`. Report findings; only fix code if a real bug surfaces (otherwise stop here).

### 2. Update `docs/tasks.md`

Mark the two new commits as completed work:

- Refactor plan engine to registry pattern (commit `b90715a`) — files under `src/lib/plan/*`.
- Add Pull-ups standard with weighted 5/3/1 Day A + bodyweight Day B (commit `1086d2e`) — `src/lib/plan/pullups.ts`, type added to `StandardType`, wired into Setup/Home/Plan.

If the relevant tasks aren't already listed, add them under a "Recently completed" section so the log stays accurate.

### 3. Delete the legacy shim

`src/lib/plan.ts` is now a 3-line re-export of `./plan/index`. All app imports use `@/lib/plan`, which TypeScript resolves to either `plan.ts` or `plan/index.ts`. To remove the ambiguity:

1. Update the five route files (`setup.tsx`, `plan.tsx`, `index.tsx`, `checkin.tsx`, `guarantee.tsx`) to import from `@/lib/plan/index` instead of `@/lib/plan`.
2. `rm src/lib/plan.ts`.
3. Verify the preview is still healthy (`preview_control--get_preview_health`).

No other files reference the shim.

## Out of scope

- No changes to engine logic (pace formulas, 5/3/1 waves, BBB) — the GitHub commits are treated as the source of truth.
- No UI/design changes.
- No new screens or features.

## Deliverable

A short report with: smoke-test screenshots/observations, the tasks.md diff summary, and confirmation that `src/lib/plan.ts` is gone and the preview is healthy.