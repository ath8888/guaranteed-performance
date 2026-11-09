# GuaranteedStandards — Lifts Category Decision Tables

**Status:** v1.0 — Lifts engine built to this file (2026-11-08).
**Owner:** A.D.
**Engine:** Lifts engine (`strength.ts`, `LiftService.ts`). Claude Code updates this engine when this file changes.

## Standing orders for Claude Code

1. This file is the source of truth for the Lifts engine.
2. Store rules as data, not as if-statements, where practical.
3. Write one test per row and one test per example.
4. Flag any gap (no row matches) or overlap (two rows match) before writing code.
5. Never change a rule without a matching entry in the change log.
6. Do not implement any row marked `[?]`.

## Source tags

- `[W]` Wendler's published 5/3/1 prescription.
- `[AD]` A.D.'s rule. Not canonical 5/3/1.
- `[?]` Open decision.

## The core rule

**CURRENT is the source of truth.** It is the lifter's estimated 1RM, in lb.
**TM = 90% of CURRENT, rounded.** It is recalculated every time CURRENT changes. There is no other TM rule. `[AD]`

## Shared definitions

| Term | Meaning |
|---|---|
| Main lifts | Squat, deadlift, bench press, overhead press |
| Cycle | Weeks 1–4. Week 4 is the deload. |
| + set | Last main set of weeks 1–3. Done for as many reps as possible. |
| Minimum reps | Week 1: 5. Week 2: 3. Week 3: 1. |
| Estimate | weight × (1 + reps ÷ 30), rounded. Reps above 10 count as 10. |
| Rounding | Every computed load, CURRENT and TM rounds to the nearest 5 lb. Exact halves round up. |

---

## L1 — Starting CURRENT

**Question:** What CURRENT does a lift start with?
**Hit policy:** Unique

| ID | Input | → CURRENT | → TM | Source |
|---|---|---|---|---|
| L1-R1 | START (the max the user enters) | START | 90% of START, rounded | `[W]` 90% |

No tested 1RM: the user enters a best guess as START. The + sets correct it.

---

## L2 — Main-lift weekly prescription

**Question:** What sets, reps and loads does a main lift get this week?
**Inputs:** Week of cycle (1–4), TM
**Hit policy:** Unique (one row per week)

| ID | Week | Set 1 | Set 2 | Set 3 | Source |
|---|---|---|---|---|---|
| L2-R1 | 1 | 65% × 5 | 75% × 5 | 85% × 5+ | `[W]` |
| L2-R2 | 2 | 70% × 3 | 80% × 3 | 90% × 3+ | `[W]` |
| L2-R3 | 3 | 75% × 5 | 85% × 3 | 95% × 1+ | `[W]` |
| L2-R4 | 4 (deload) | 40% × 5 | 50% × 5 | 60% × 5 | `[W]` |

All percentages are of the TM at the moment the session opens.

---

## L3 — Supplemental work (Boring But Big)

**Question:** What supplemental sets follow the main lift?
**Inputs:** Lift, week of cycle
**Hit policy:** Unique

| ID | Lift | Week | → Sets × reps | → Load | Source |
|---|---|---|---|---|---|
| L3-R1 | Any main lift | 1–3 | 5 × 10 | 50% of TM | `[W]` |
| L3-R2 | Any main lift | 4 | None | — | `[AD]` |

BBB is optional. The user may SKIP it. BBB never changes CURRENT.

---

## L4 — CURRENT after a + set

**Question:** When the user logs a + set (weeks 1–3), what happens to CURRENT?
**Timing:** At once. The TM, and every later load, changes right away — including later weeks of the same cycle.
**Hit policy:** First (checked top to bottom)

| ID | Condition | → CURRENT | Source |
|---|---|---|---|
| L4-R1 | Reps below the week's minimum | CURRENT × 0.90, rounded | `[AD]` |
| L4-R2 | Estimate above CURRENT | Estimate | `[AD]` |
| L4-R3 | Otherwise | Unchanged | `[AD]` |

---

## L5 — CURRENT at cycle end

**Question:** When week 4 is finished, what happens to CURRENT?
**Hit policy:** First (checked top to bottom)

| ID | Lift | Condition | → CURRENT | Source |
|---|---|---|---|---|
| L5-R1 | Any | Week 3 + set not logged (or skipped) | Unchanged | `[AD]` |
| L5-R2 | Squat | Week 3 + set logged | + 10 lb | `[W]` amount |
| L5-R3 | Deadlift | Week 3 + set logged | + 10 lb | `[W]` amount |
| L5-R4 | Bench press | Week 3 + set logged | + 5 lb | `[W]` amount |
| L5-R5 | Overhead press | Week 3 + set logged | + 5 lb | `[W]` amount |

The increase applies even when the week 3 + set was a miss. L4-R1 already cut CURRENT for that miss.

---

## Examples (Given / When / Then)

**E1 — Week 3 squat (L2-R3)**
Given squat TM is 300 lb
When the user opens week 3
Then the sets are 225 × 5, 255 × 3, 285 × 1+

**E2 — Big + set (L4-R2)**
Given squat CURRENT is 335 lb (TM 300)
When the user logs 285 × 8 on week 3
Then CURRENT becomes 360 lb (285 × 1.267 = 361) and TM becomes 325 lb at once

**E3 — Miss (L4-R1)**
Given squat CURRENT is 335 lb
When the user logs 285 × 0 on week 3
Then CURRENT becomes 300 lb and TM becomes 270 lb at once

**E4 — Rounding**
Given deadlift TM is 287 lb
When the user opens week 1
Then Set 1 is 185 lb (186.55 rounds to 185)

**E5 — Rounding tie**
Given overhead press TM is 135 lb
When the user opens week 4
Then Set 2 is 70 lb (67.5 rounds up)

**E6 — Cycle end (L5-R4)**
Given bench CURRENT is 225 lb
And the week 3 + set was logged
When week 4 is finished
Then CURRENT becomes 230 lb and TM becomes 205 lb

**E7 — Deload has no BBB (L3-R2)**
Given any main lift
When the user opens week 4
Then no supplemental sets are prescribed

---

## Not yet covered

- Accessories (chins, carries, sandbag work). No rules yet.
- Unit setting (lb vs kg).

## Change log

| Date | Rule ID | Change | Reason |
|---|---|---|---|
| 2026-11-08 | All | Draft v0.1 created | Initial conversion |
| 2026-11-08 | L1-R1 | TM set at 90% of 1RM | A.D. decision; Wendler original |
| 2026-11-08 | L3 | BBB only; widowmaker + FSL rows removed | A.D. decision |
| 2026-11-08 | Shared | Rounding: nearest 5 lb, halves round up | A.D. decision |
| 2026-11-08 | L4-R3 (now L4-R5) | Reset on any missed minimum: TM × 0.90 | Wendler's rule |
| 2026-11-08 | L1-R2 | No 1RM: rep-max estimate, then 90% | A.D. decision |
| 2026-11-08 | L3 | BBB at 50% of TM; none in deload | A.D. decision |
| 2026-11-08 | L4 | Upper/lower groups replaced by one row per lift; reset renumbered L4-R5 | Simpler; no group definitions |
| 2026-11-08 | L4-R6 | Added: no week 3 + set → hold | Matches app; closes a gap |
| 2026-11-08 | L4 | App changed to match: all three + sets judged; 1 rep on week 3 now progresses (was hold) | A.D.: table wins |
| 2026-11-08 | Shared | App rounding fixed: float error rounded 4 halves down | Bug |
| 2026-11-08 | L3 | Documented existing SKIP on BBB | Matches app |
| 2026-11-08 | L5 | Power clean table moved to olympic-lifts.md | A.D. decision |
| 2026-11-08 | L1-R2 | Removed rep-max start; START is the only input | A.D.: simpler |
| 2026-11-08 | L1, L4, L5 | CURRENT becomes the source of truth. TM = 90% of CURRENT, always. + sets move CURRENT at once (miss −10%, higher estimate replaces it, reps capped at 10). Cycle end adds +10 / +5 to CURRENT if week 3 was logged. Old L4 (TM progression and reset) replaced. | A.D.: simpler |

