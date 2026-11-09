# GuaranteedStandards — Run Category Decision Tables

**Status:** v0.3 — Run engine built to this file (2026-11-09).
**Owner:** A.D.
**Engine:** Run engine (`run.ts`, `RunService.ts`). Claude Code updates this engine when this file changes.

## Standing orders for Claude Code

1. This file is the source of truth for the Run engine.
2. Store rules as data, not as if-statements, where practical.
3. Write one test per row and one test per example.
4. Flag any gap (no row matches) or overlap (two rows match) before writing code.
5. Never change a rule without a matching entry in the change log.
6. Do not implement any row marked `[?]`.
7. Shared rules (CURRENT, weeks, skips, est. completion, delete) live in `shared.md`. Do not repeat them here.

## Source tags

- `[App]` Existing app rule (F22/F23), adopted by A.D.
- `[AD]` A.D.'s rule.
- `[?]` Open decision.

## Shared rules

See `shared.md`: CURRENT is the source of truth (S1-R1), weeks (S3), skips (S4), est. completion (S5).
For Run, CURRENT is the race time over the standard's distance, in seconds. Lower is better. It starts at START (R1), drops by half of each ladder step (R5), and is set by a faster Time Trial (R6). It never gets worse. Run has no TM and no 5 lb rounding.

## Definitions

| Term | Meaning |
|---|---|
| Run types | 800m, 1.5 mile, 3 mile, 5 mile. |
| Short / long | Short = 800m and 1.5 mi. Long = 3 mi and 5 mi. |
| Pace | Seconds per mile (s/mi). |
| Session A | Interval session: a speed part and a threshold part. Short: speed first. Long: threshold first. |
| Session B | Zone 2: easy, conversational run for a set number of minutes. |
| Speed rep | A short fast rep over a set distance. The user logs the split. |
| Threshold rep | A timed rep (minutes). The user logs the pace. |
| Ladder part | The race-pace part of Session A. Short: speed reps. Long: threshold reps. |
| Ladder pace | Target pace for the ladder part. Moves in 15 s/mi steps. |
| Counter | Qualifying sessions in a row toward the next ladder step. |
| Adjustment | Personal offset (s/mi) on the non-ladder part, learned from logged reps. |
| Rounding | Paces and splits round to the nearest whole second. CURRENT is shown in whole seconds. |

---

## R1 — Starting state

**Question:** What does a new run standard start with?
**Hit policy:** Unique

| ID | Input | → CURRENT | → Ladder pace | → Counter | → Adjustments | Source |
|---|---|---|---|---|---|---|
| R1-R1 | START race time | START | START ÷ distance in miles, rounded (race pace) | 0 | None | `[App]` |

---

## R2 — Distance plans

**Question:** What does each run type prescribe?
**Hit policy:** Unique (one row per type)

| ID | Type | Ladder part | Speed rep (rest) | Speed reps W1/W2/W3 | Threshold length W1/W2/W3 | Threshold reps W1/W2/W3 | Zone 2 min W1/W2/W3/W4 | Source |
|---|---|---|---|---|---|---|---|---|
| R2-R1 | 800m | Speed | 200m (1:00 jog) | 6 / 7 / 8 | 3 / 3 / 5 min | 2 / 3 / 2 | 25 / 30 / 35 / 20 | `[App]` |
| R2-R2 | 1.5 mi | Speed | 400m (1:30 jog) | 5 / 6 / 7 | 5 / 5 / 7 min | 2 / 3 / 2 | 30 / 35 / 40 / 25 | `[App]` |
| R2-R3 | 3 mi | Threshold | 400m (1:30 jog) | 2 / 3 / 4 | 5 / 5 / 7 min | 4 / 5 / 4 | 40 / 45 / 50 / 35 | `[App]` |
| R2-R4 | 5 mi | Threshold | 400m (1:30 jog) | 2 / 3 / 4 | 7 / 7 / 7 min | 3 / 4 / 5 | 45 / 55 / 60 / 40 | `[App]` |

Threshold rest: 1:00 jog for 3 and 5 min reps, 1:30 for 7 min reps. Every Session A adds a 10 min easy warm-up and cool-down.

---

## R3 — Weekly cards

**Question:** What cards does the user get each week?
**Hit policy:** Unique (one row per week group)

| ID | Week | Card 1 | Card 2 | Card 3 | Source |
|---|---|---|---|---|---|
| R3-R1 | 1–3 | Session A (that week's reps, R2) | Session B — Zone 2 | Session A (same as card 1) | `[App]` |
| R3-R2 | 4 | Session A — Time Trial (race distance, all-out) | Session B — Zone 2 (W4 minutes) | Session A deload: reps = half of W3, rounded up; threshold length = W1 | `[App]` |

Cards can be done in any order. Every card can be skipped. Cards have no Recommended / Optional tag.

---

## R4 — Paces

**Question:** What pace does each part get?
**Hit policy:** Collect (one row per part)

| ID | Part | → Pace | Source |
|---|---|---|---|
| R4-R1 | Ladder part (short: speed; long: threshold) | Ladder pace | `[App]` |
| R4-R2 | Threshold, short types | CURRENT → Riegel 10K pace (exponent 1.08) + 10 s/mi + adjustment | `[App]` |
| R4-R3 | Speed, long types | CURRENT → Riegel mile pace (exponent 1.06) + adjustment | `[App]` |
| R4-R4 | Zone 2 (all types) | Ceiling: threshold formula pace (no adjustment) + 75 s/mi. Run at that pace or slower. | `[App]` |

Speed rep split = pace × rep distance, rounded. Riegel: time over a new distance = time × (new ÷ old)^exponent. The threshold formula for long types uses exponent 1.06.

---

## R5 — Ladder after Session A (weeks 1–3)

**Question:** When a Session A in weeks 1–3 is logged, what happens to the ladder and CURRENT?
**Hit policy:** First (checked top to bottom)

| ID | Condition | → Ladder pace | → CURRENT | → Counter | Source |
|---|---|---|---|---|---|
| R5-R1 | Session A skipped | Unchanged | Unchanged | Unchanged | `[App]` |
| R5-R2 | Any ladder rep slower than target, or not done | Unchanged | Unchanged | 0 (no penalty) | `[App]` |
| R5-R3 | Every ladder rep hit, and the average is at least one full step faster than the ladder pace | − 15 s/mi per full step | − half of each step, as race time | 0 | `[App]` |
| R5-R4 | Every ladder rep hit, counter reaches 2 | − 15 s/mi | − half a step, as race time | 0 | `[App]` |
| R5-R5 | Every ladder rep hit (otherwise) | Unchanged | Unchanged | + 1 | `[App]` |

"Half a step, as race time" = 7.5 s/mi × distance in miles (800m: 3.7 s; 1.5 mi: 11.3 s; 3 mi: 22.5 s; 5 mi: 37.5 s).
The week 4 deload Session A never counts toward the ladder.

---

## R6 — Time Trial (week 4)

**Question:** When the Time Trial is logged, what happens?
**Hit policy:** First (checked top to bottom)

| ID | Condition | → CURRENT | → Counter | → Ladder pace | Source |
|---|---|---|---|---|---|
| R6-R1 | Skipped, or no time logged | Unchanged | Unchanged | Unchanged | `[App]` |
| R6-R2 | Faster than CURRENT | Trial time | + 1 (at 2: ladder − 15 s/mi, counter 0) | See counter | `[App]` |
| R6-R3 | Equal or slower than CURRENT | Unchanged | 0 | Unchanged | `[AD]` |

Every trial time is saved (History, chart). Only a faster one changes CURRENT.

---

## R7 — Personal adjustment (non-ladder part)

**Question:** When any Session A is logged (weeks 1–4), what happens to the non-ladder part's adjustment?
**Hit policy:** First (checked top to bottom)

| ID | Condition | → Adjustment | Source |
|---|---|---|---|
| R7-R1 | Any non-ladder rep not logged | Unchanged | `[App]` |
| R7-R2 | Average pace faster than planned | Average pace − formula pace (future reps use it) | `[App]` |
| R7-R3 | Otherwise (equal or slower) | Unchanged | `[App]` |

Zone 2 is never adjusted. Session B (Zone 2) is logged for the record only and never changes anything.

---

## R8 — Weeks to target (for est. completion, shared S5)

**Question:** How many weeks until CURRENT reaches the target time?
**Hit policy:** First (checked top to bottom)

| ID | Condition | → Weeks | Source |
|---|---|---|---|
| R8-R1 | CURRENT at or below target | 0 (REACHED) | `[App]` |
| R8-R2 | 2+ weeks since the standard was added, and CURRENT has improved | (CURRENT − target) ÷ observed gain per week, rounded up | `[App]` |
| R8-R3 | Otherwise | (CURRENT − target) ÷ (3.75 s/mi × distance in miles) per week, rounded up (at least 1) | `[App]` |

3.75 s/mi per week = one ladder step every 2 weeks, half of it to CURRENT. Observed gain = (START − latest CURRENT) ÷ weeks since added.

---

## Examples (Given / When / Then)

**E1 — Starting paces (R1, R4-R1)**
Given an 800m standard with START 2:40
When the user opens week 1
Then the ladder pace is 5:22/mi and each speed rep reads "200m @ 5:22/mi in 0:40secs"

**E2 — Two qualifying sessions (R5-R4)**
Given an 800m ladder pace of 5:22/mi, CURRENT 2:40, counter 1
When the user hits every speed rep in Session A
Then the ladder pace becomes 5:07/mi, CURRENT becomes 2:36 (160 − 3.7), counter 0

**E3 — Jump (R5-R3)**
Given an 800m ladder pace of 5:22/mi, CURRENT 2:40
When the user hits every speed rep at an average of 4:50/mi (32 s faster)
Then the ladder pace drops 2 steps to 4:52/mi and CURRENT becomes 2:33

**E4 — A miss (R5-R2)**
Given counter 1
When one ladder rep is slower than target
Then the counter becomes 0; ladder pace and CURRENT stay the same

**E5 — Slower Time Trial (R6-R3)**
Given CURRENT 2:36 and counter 1
When the user runs the Time Trial in 2:40
Then CURRENT stays 2:36 and the counter becomes 0

**E7 — Faster Time Trial (R6-R2)**
Given CURRENT 2:36 and counter 0
When the user runs the Time Trial in 2:31
Then CURRENT becomes 2:31 and the counter becomes 1

**E6 — Week 4 deload (R3-R2)**
Given an 800m standard in week 4
When the user opens the deload Session A
Then it has 4 speed reps (half of 8) and 1 × 3 min threshold rep (half of 2, W1 length)

---

## Not yet covered

- Nothing yet.

## Change log

| Date | Rule ID | Change | Reason |
|---|---|---|---|
| 2026-11-09 | All | Draft v0.1 created from the app (F22/F23 rules) | Initial conversion |
| 2026-11-09 | R5-R3, R5-R4 | Kept: each ladder step also takes half a step off CURRENT between trials. | A.D. decision |
| 2026-11-09 | R6-R3 | A Time Trial equal to or slower than CURRENT no longer sets CURRENT; it holds. The time is still saved. CURRENT never gets worse. | A.D. decision |
| 2026-11-09 | R6-R3 | Engine built to v0.2 rules; status v0.3. Only a faster trial adds a chart point. | Build |
