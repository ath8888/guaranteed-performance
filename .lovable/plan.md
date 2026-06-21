## Plan: Change "test" to "goal" in app-level copy

### Scope
Only user-facing strings in route files. Session titles (e.g., "Timed test — 3 miles", "2-min test (all-out)") are intentionally excluded per your direction.

### Changes

| File | Current string | New string |
|---|---|---|
| `src/routes/index.tsx:40` | `Choose the test you need to pass.` | `Choose the goal you need to hit.` |
| `src/routes/checkin.tsx:24` | `Choose the test you need to pass.` | `Choose the goal you need to hit.` |
| `src/routes/guarantee.tsx:80` | `Refund requests open after your test date if the standard wasn't met.` | `Refund requests open after your goal date if the standard wasn't met.` |
| `src/routes/plan.tsx:98` | `Log your 3-mile test on Check-in to advance the wave.` | `Log your 3-mile goal on Check-in to advance the wave.` |

No internal variable names (`testDate`, `pullupTest`, `kind: "test"`) or plan-engine session titles will be touched.