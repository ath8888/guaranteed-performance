# GuaranteedStandards — Olympic Lifts Category Decision Tables

**Status:** v0.8 — CURRENT moves at the end of week 3 (2026-11-12).
**Owner:** A.D.
**Engine:** Olympic Lifts engine. Claude Code updates this engine when this file changes.

## Standing orders for Claude Code

1. This file is the source of truth for the Olympic Lifts engine.
2. Store rules as data, not as if-statements, where practical.
3. Write one test per row and one test per example.
4. Flag any gap (no row matches) or overlap (two rows match) before writing code.
5. Never change a rule without a matching entry in the change log.
6. Do not implement any row marked `[?]`.
7. Shared rules (CURRENT and TM, rounding, weeks, skips, est. completion, delete) live in `shared.md`. Do not repeat them here.

## Source tags

- `[W]` Wendler's published 5/3/1 prescription.
- `[App]` Existing app rule, adopted by A.D. Not canonical 5/3/1.
- `[AD]` A.D.'s rule. Not canonical 5/3/1.
- `[?]` Open decision.

## Shared rules

See `shared.md`: CURRENT is the source of truth and TM = 90% of it (S1), rounding (S2), weeks (S3), skips (S4).
For Olympic, CURRENT is the lifter's estimated 1RM in lb. It starts at START (O1). Olympic sets are never all-out (no AMRAP), so CURRENT changes only once per cycle, when week 3 is finished (O3).

## Definitions

| Term | Meaning |
|---|---|
| Olympic lift | One generic lift. The user names it (e.g. power clean). Every Olympic lift uses these tables. |
| Minimum reps | Every top set: 3. |
| Week 4 | The deload |
| Sessions | One Olympic session per week. Main lift only. No supplemental work. |
| Top set | Set 3 of weeks 1–3. The user logs reps done, capped at 3. Never an all-out (AMRAP) set. |

---

## O1 — Starting CURRENT

**Question:** What CURRENT does the lift start with?
**Hit policy:** Unique

| ID | Input | → CURRENT | Source |
|---|---|---|---|
| O1-R1 | START (the max the user enters) | START | `[AD]` |

No tested 1RM: the user enters a best guess as START. The week 3 progression (O3) corrects it.

---

## O2 — Weekly prescription

**Question:** What sets, reps and loads does the Olympic lift get this week?
**Inputs:** Week of cycle (1–4), TM
**Hit policy:** Unique (one row per week)

| ID | Week | Set 1 | Set 2 | Set 3 | Source |
|---|---|---|---|---|---|
| O2-R1 | 1 | 65% × 3 | 75% × 3 | 85% × 3, reps logged | `[App]` waves `[W]`, triples |
| O2-R2 | 2 | 70% × 3 | 80% × 3 | 90% × 3, reps logged | `[App]` |
| O2-R3 | 3 | 75% × 3 | 85% × 3 | 95% × 3, reps logged | `[App]` |
| O2-R4 | 4 (deload) | 40% × 3 | 50% × 3 | 60% × 3 | `[App]` |

All percentages are of TM. Logged reps on set 3 can never exceed 3.

---

## O3 — CURRENT at the end of week 3

**Question:** When week 3 is finished (every card logged or skipped, so the plan moves to week 4), what happens to CURRENT?
**Inputs:** Reps logged on the top set of weeks 1, 2 and 3
**Hit policy:** First (checked top to bottom)

| ID | Condition | → CURRENT | Source |
|---|---|---|---|
| O3-R1 | Week 3 top set not logged | Unchanged | `[App]` |
| O3-R2 | Any logged top set (weeks 1–3) under 3 reps, including 0 | Unchanged | `[AD]` |
| O3-R3 | Every logged top set: 3 reps | + 5 lb | `[App]` |

A missing week 1 or week 2 log is not a miss. Only logged top sets are judged. There is no reset: a failed cycle holds CURRENT.

The week 4 deload uses the new TM. Nothing happens to CURRENT when week 4 is finished (Olympic has no cycle-end rule for shared S3-R3).
O3 runs once per cycle. A lift that was already in week 4 when v0.8 arrived, so it missed the week 3 check, gets O3 when week 4 is finished instead.
Est. completion (shared S5): the first increase lands at the end of week 3 of this cycle (from week 4: of the next cycle), then one every 4 weeks.

---

## Examples (Given / When / Then)

**E1 — Week 3 at TM 135 (O2-R3)**
Given the TM is 135 lb
When the user opens week 3
Then the sets are 100 × 3, 115 × 3, 130 × 3 (reps logged, max 3)

**E2 — Progress (O3-R3)**
Given CURRENT is 150 lb (TM 135)
And the user logged 3 reps on the week 3 top set
When week 3 is finished
Then CURRENT becomes 155 lb and TM becomes 140 lb, and the week 4 deload is built from TM 140 (55 / 70 / 85 × 3)

**E3 — A week 2 miss blocks progress (O3-R2)**
Given CURRENT is 150 lb
And the user logged 2 reps on the week 2 top set
And 3 reps on the week 3 top set
When week 3 is finished
Then CURRENT stays 150 lb

**E4 — Partial set holds (O3-R2)**
Given CURRENT is 150 lb
And the user logged 2 reps on the week 3 top set
When week 3 is finished
Then CURRENT stays 150 lb

**E5 — No reset on 0 reps (O3-R2)**
Given CURRENT is 150 lb
And the user logged 0 reps on the week 3 top set
When week 3 is finished
Then CURRENT stays 150 lb

**E7 — TM can hold after a raise (rounding)**
Given CURRENT is 175 lb (TM 160, from 157.5)
And every logged top set was 3 reps
When week 3 is finished
Then CURRENT becomes 180 lb and TM stays 160 lb (162 rounds to 160)

**E6 — No all-out sets (O2)**
Given any week
When the engine builds the Olympic session
Then no set allows more than 3 reps

---

## Change log

| Date | Rule ID | Change | Reason |
|---|---|---|---|
| 2026-11-08 | O1 | Moved from lifts.md (was L5) | A.D. decision: own category |
| 2026-11-08 | O1 | Wave 70 / 75 / 80%; deload keeps cleans, reduced | A.D. decision |
| 2026-11-08 | O1-R1 to R3 | Back-off changed from 80% to working load − 10 points (60 / 65 / 70%) | A.D.: back-off must be lighter |
| 2026-11-08 | All | Power clean draft replaced by the app's current Olympic program, split into O1 (TM), O2 (weekly sets), O3 (progression) | A.D.: table must match the app |
| 2026-11-08 | O3-R3 | Weeks 1–2 now judged: any top set under 3 holds (week 3 only before) | A.D. decision |
| 2026-11-08 | O1-R2 | Added no-1RM start, same formula as Lifts | A.D. decision |
| 2026-11-08 | — | Power clean draft dropped for good | A.D. decision |
| 2026-11-08 | O1-R2 | Removed rep-max start; START is the only input | A.D.: simpler |
| 2026-11-09 | O1, O3 | CURRENT becomes the source of truth (starts at START). TM = 90% of CURRENT, always. CURRENT changes only at cycle end: all triples → +5; anything else holds. O3-R2 reset (−10%) removed; rows renumbered R1–R3. | A.D.: same model as Lifts, simpler |
| 2026-11-09 | Core rule, Shared definitions, O1, O3-R1 | Core rule, CURRENT/TM, rounding, cycle and skip wording moved to shared.md. O1 lists CURRENT only (TM comes from S1-R2). Skips and missed weeks now covered by shared S3/S4. No rule changed. | A.D.: one shared table |
| 2026-11-12 | O3 | CURRENT moves when week 3 is finished, not week 4. Week 4 deload uses the new TM. Runs once per cycle; a lift already in week 4 at the update gets O3 at the end of week 4. Est. completion counts from the end of week 3. | A.D.: F27 device test |
