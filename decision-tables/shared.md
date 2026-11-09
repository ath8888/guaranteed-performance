# GuaranteedStandards — Shared Decision Tables

**Status:** v1.0 — matches the app (2026-11-09).
**Owner:** A.D.
**Engines:** Every engine (Lifts, Olympic, Calisthenics, Run). Code: `shared.ts`, `progression.ts`, `TrainingService.ts`, `SessionService.ts`, `HistoryService.ts`.

## Standing orders for Claude Code

1. This file is the source of truth for rules every engine shares. Engine tables point here; they do not repeat these rules.
2. A rule belongs here only if every engine it names follows it the same way. If an engine differs, the rule goes in that engine's table.
3. A row may name the engines it applies to (e.g. "Lifts, Olympic"). It must still be one rule, the same everywhere it applies.
4. Store rules as data, not as if-statements, where practical.
5. Write one test per row and one test per example.
6. Flag any gap (no row matches) or overlap (two rows match) before writing code.
7. Never change a rule without a matching entry in the change log.
8. Do not implement any row marked `[?]`.

## Source tags

- `[W]` Wendler's published 5/3/1 prescription.
- `[AD]` A.D.'s rule.
- `[App]` Existing app rule, adopted by A.D.
- `[?]` Open decision.

## Engine tables

| Engine | Table |
|---|---|
| Lifts | `lifts.md` |
| Olympic | `olympic-lifts.md` |
| Calisthenics (push-ups) | `calisthenics.md` |
| Run | not written yet |

---

## S1 — CURRENT and TM

**Question:** What is the source of truth, and how is TM found?
**Hit policy:** Collect (every matching row applies)

| ID | Engines | Rule | Source |
|---|---|---|---|
| S1-R1 | All | Each standard has one CURRENT. It is the source of truth. It changes only per cycle or per AMRAP/test, as the engine's table says. | `[AD]` |
| S1-R2 | Lifts, Olympic | CURRENT is stored and starts at START. TM = 90% of CURRENT, rounded (S2). TM is calculated from CURRENT whenever it is needed. It has no rules of its own. | `[AD]` |
| S1-R3 | Lifts, Olympic | Saved before CURRENT was stored: CURRENT = TM ÷ 0.9, rounded. | `[App]` |

Calisthenics and Run: how CURRENT starts and moves goes in their own tables.

---

## S2 — Rounding

**Question:** How are computed values rounded?
**Hit policy:** Unique

| ID | Engines | Rule | Source |
|---|---|---|---|
| S2-R1 | Lifts, Olympic | Every computed load, CURRENT and TM rounds to the nearest 5 lb. Exact halves round up. | `[AD]` |

Calisthenics and Run round in their own ways (reps, seconds). Those rules go in their tables.

---

## S3 — Cycle and week

**Question:** How does the plan move from week to week?
**Hit policy:** First (checked top to bottom)

| ID | Engines | Condition | → Result | Source |
|---|---|---|---|---|
| S3-R1 | All | A card in the current week is not logged yet | Week stays the same | `[App]` |
| S3-R2 | All | Every card in weeks 1–3 is logged (done or skipped) | Next week, same cycle | `[App]` |
| S3-R3 | All | Every card in week 4 is logged (done or skipped) | The engine's cycle-end rule runs, then week 1 of the next cycle | `[App]` |

A cycle is always weeks 1–4. What happens in each week, including week 4, is in the engine's table. The plan never moves on time alone; a week the user does not train waits.

---

## S4 — Skips

**Question:** What does a skipped card do?
**Hit policy:** Collect (every row applies)

| ID | Engines | Rule | Source |
|---|---|---|---|
| S4-R1 | All | A skipped card is saved as "skipped". It counts toward finishing the week (S3). | `[App]` |
| S4-R2 | All | A skip never changes CURRENT. | `[App]` |
| S4-R3 | All | Engine rules treat a skipped card as not logged. | `[App]` |
| S4-R4 | All | Skipped cards are not shown in History. | `[App]` |

---

## S5 — Estimated completion date

**Question:** What date does Home show?
**Hit policy:** First (checked top to bottom)

| ID | Engines | Condition | → Shown | Source |
|---|---|---|---|---|
| S5-R1 | All | CURRENT has reached the target | REACHED | `[App]` |
| S5-R2 | All | Otherwise | End of the current plan week + the weeks still needed (from the engine's table) | `[App]` |

The current plan week starts at the latest log from an earlier week (or the day the standard was added). An overdue week counts as ending today. So the date stays the same all week and moves only when the user gets ahead or falls behind.

---

## S6 — Deleting a standard

**Question:** What happens to a deleted standard's logs?
**Hit policy:** Unique

| ID | Engines | Rule | Source |
|---|---|---|---|
| S6-R1 | All | The standard leaves Home and Execute. Its logs and its name are kept, so History stays complete. | `[AD]` |

---

## Examples (Given / When / Then)

**E1 — TM follows CURRENT (S1-R2, S2-R1)**
Given a bench CURRENT of 225 lb
When the plan needs the TM
Then the TM is 205 lb (202.5 rounds up)

**E2 — Old saved state (S1-R3)**
Given an Olympic lift saved with TM 135 and no CURRENT
When the app reads it
Then CURRENT is 150 lb

**E3 — Week waits (S3-R1)**
Given a lift in week 2 with the main lift logged and BBB not logged
When a week of time passes
Then the plan is still on week 2

**E4 — Skip finishes the week (S3-R2, S4-R1, S4-R2)**
Given a lift in week 1 with the main lift logged
When the user skips BBB
Then the plan moves to week 2 and CURRENT is unchanged

---

## Not yet covered

- Unit setting (lb vs kg).

## Change log

| Date | Rule ID | Change | Reason |
|---|---|---|---|
| 2026-11-09 | All | v1.0 created from the app's shared code. Core CURRENT rule, rounding, cycle/week, skips, est. completion, delete moved here from lifts.md and olympic-lifts.md or written down for the first time. | A.D.: one shared table, engine tables point to it |
