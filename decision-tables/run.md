# GuaranteedStandards — Run Category Decision Tables

**Status:** v1.0 — rules rebuilt and approved by A.D. (2026-11-12). Engine built to v1.0 (F32, 2026-11-12).
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
For Run, CURRENT is the race time over the standard's distance, in seconds. Lower is better. It starts at START (R1), can drop when the user moves up a ladder rung (R7), and is set by a faster Time Trial (R8). It never gets worse. Run has no TM and no 5 lb rounding. Run has no cycle-end rule: at the end of week 4 (S3-R3) nothing changes except the week.

## Definitions

| Term | Meaning |
|---|---|
| Run types | 800m, 1.5 mile, 3 mile, 5 mile. |
| Short / long | Short = 800m and 1.5 mi. Long = 3 mi and 5 mi. |
| Pace | Seconds per mile (s/mi). |
| Session A | Interval session, in this order: speed reps, then race-pace intervals, then (short types only) one optional threshold rep. |
| Session B | Zone 2: easy, conversational run for a set number of minutes. |
| Speed rep | A short fast rep over a set distance. The user logs the split and the rest after it. |
| Race-pace interval | A timed rep at the current rung's pace. The user logs its length, its pace and the rest after it. This is the ladder part. |
| Threshold rep | Short types only. One optional rep at the end of Session A. Any cardio (run, row, bike, treadmill…). No pace is given. |
| Base pace | The pace every rung is measured from. New standards: the ladder pace from R1 (START race pace). |
| Rung | One step of the ladder: a rep length and a pace (base pace minus an offset). |
| Ladder | The list of rungs for a run type (R3). The user is always on one rung. |
| Rest | Until heart rate is under 120 bpm or the user can talk normally again (talk test). Goal: 2:00 or less. |
| Counter | Qualifying sessions in a row on the current rung. |
| Run calculator | Riegel: time over a new distance = time × (new distance ÷ old distance)^1.06. |
| Rounding | Paces and splits round to the nearest whole second. CURRENT is shown in whole seconds. |

---

## R1 — Starting state

**Question:** What does a new run standard start with?
**Hit policy:** Unique

| ID | Input | → CURRENT | → Ladder pace | → Counter | → Adjustments | Source |
|---|---|---|---|---|---|---|
| R1-R1 | START race time | START | START ÷ distance in miles, rounded (race pace) | 0 | None | `[App]` |

A new standard starts on rung 1 (R3). Its base pace is R1's ladder pace. Zone 2 starts at the start length (R9).

---

## R2 — Session A

**Question:** What does Session A prescribe?
**Hit policy:** Unique (one row per type)

| ID | Type | 1. Speed reps | 2. Race-pace intervals | 3. Threshold rep (OPTIONAL) | Source |
|---|---|---|---|---|---|
| R2-R1 | 800m | 2 × 100m | 4 reps at the current rung | 1 × 3 min, any cardio | `[AD]` |
| R2-R2 | 1.5 mi | 2 × 200m | 4 reps at the current rung | 1 × 7 min, any cardio | `[AD]` |
| R2-R3 | 3 mi | 2 × 400m | 4 reps at the current rung | None | `[AD]` |
| R2-R4 | 5 mi | 2 × 400m | 4 reps at the current rung | None | `[AD]` |

Rest after every speed rep and race-pace interval follows the Rest definition. The threshold rep is logged for the record only and never changes anything. Skipping it does not affect the rest of Session A.

---

## R3 — Ladders

**Question:** What rep length and pace does each rung prescribe?
**Hit policy:** Unique (one row per type)

Pace is base pace minus the offset. Always 4 reps.

| ID | Type | Rungs 1–6 (length @ offset) | After that (k = 1, 2, 3…) | Source |
|---|---|---|---|---|
| R3-R1 | 800m | 45s @ 0 → 60s @ 0 → 75s @ 0 → 60s @ −15 → 75s @ −15 → 60s @ −30 | Rung 2k+2 = 60s @ −15k s/mi; rung 2k+3 = 75s @ −15k s/mi | `[AD]` |
| R3-R2 | 1.5 mi | 90s @ 0 → 3 min @ 0 → 90s @ −15 → 3 min @ −15 → 90s @ −30 → 3 min @ −30 | Rung 2k+1 = 90s @ −15k s/mi; rung 2k+2 = 3 min @ −15k s/mi | `[AD]` |
| R3-R3 | 3 mi | 3 min @ 0 → 5 min @ 0 → 7 min @ 0 → 5 min @ −30 → 7 min @ −30 → 5 min @ −60 | Rung 2k+2 = 5 min @ −30k s/mi; rung 2k+3 = 7 min @ −30k s/mi | `[AD]` |
| R3-R4 | 5 mi | Same as 3 mi | Same as 3 mi | `[AD]` |

A.D. wrote rungs 1–6 (1–5 for 1.5 mi). The pattern after them is "for now" while A.D. tests it.

---

## R4 — Weekly cards

**Question:** What cards does the user get each week?
**Hit policy:** Unique (one row per week group)

| ID | Week | Card 1 | Card 2 | Card 3 | Source |
|---|---|---|---|---|---|
| R4-R1 | 1–3 | Session A | Session B — Zone 2 | Session A | `[AD]` |
| R4-R2 | 4 | Session A | Session B — Zone 2 | Time Trial — OPTIONAL (race distance, all-out) | `[AD]` |

Cards can be done in any order. Every card can be skipped (S4). The Time Trial and the threshold rep are tagged OPTIONAL. No other card or part is tagged.

---

## R5 — Targets shown

**Question:** What target does each part show?
**Hit policy:** Collect (one row per part)

| ID | Part | → Target | Source |
|---|---|---|---|
| R5-R1 | Speed rep | Split = CURRENT converted to the rep distance (run calculator), rounded | `[AD]` |
| R5-R2 | Race-pace interval | Current rung's length and pace (R3) | `[AD]` |
| R5-R3 | Threshold rep | Length only (R2). No pace. | `[AD]` |
| R5-R4 | Zone 2 | Length only (R9). No pace. Effort: talk test (full sentences), or heart rate at or under 180 − age. The user logs minutes and pace afterwards. | `[AD]` |
| R5-R5 | Time Trial | Race distance, all-out. No target. | `[AD]` |

Speed reps, threshold reps and Zone 2 pace are logged for the record only and never change anything.

---

## R6 — Ladder after Session A

**Question:** When a Session A is logged, what happens to the rung and counter?
**Hit policy:** First (checked top to bottom)

A rung is **met** when all 4 race-pace intervals are logged, every one is at least the rung's length and at or faster than its pace, and all 3 rests between them are 2:00 or less. Any rung on the ladder can be met, including ones above the current rung.

| ID | Condition | → Rung | → Counter | → CURRENT | Source |
|---|---|---|---|---|---|
| R6-R1 | Session A skipped | Unchanged | Unchanged | Unchanged | `[App]` |
| R6-R2 | A rung above the current rung is met | The highest rung met | 1 | R7 | `[AD]` |
| R6-R3 | The current rung is met, and the counter reaches 2 | Next rung | 0 | R7 | `[AD]` |
| R6-R4 | The current rung is met (otherwise) | Unchanged | + 1 | Unchanged | `[AD]` |
| R6-R5 | Otherwise (current rung not met: slower, shorter, a rest over 2:00, or not all logged) | Unchanged | 0 (no penalty) | Unchanged | `[AD]` |

R6-R2 lets the user skip rungs: one session that meets a higher rung puts them on it, already counting as their first qualifying session there.
The rest after the last (4th) interval does not count. Rests after speed reps do not count.
Every Session A counts, including week 4's.

---

## R7 — CURRENT on a rung move

**Question:** When the user moves up (R6-R2 or R6-R3), what happens to CURRENT?
**Hit policy:** First (checked top to bottom)

Converted time = one rep (average logged length, at average logged pace, of the session that caused the move) converted to the race distance with the run calculator, rounded.

| ID | Condition | → CURRENT | Source |
|---|---|---|---|
| R7-R1 | Converted time faster than CURRENT | Converted time | `[AD]` |
| R7-R2 | Otherwise | Unchanged | `[AD]` |

Note: one rep is much shorter than the race, so the converted time is usually slower than CURRENT on the early rungs. CURRENT then holds, and the Time Trial (R8) is what moves it. A.D. chose this over counting all 4 reps as one run, which was too generous.

---

## R8 — Time Trial (week 4, optional)

**Question:** When the Time Trial is logged, what happens?
**Hit policy:** First (checked top to bottom)

| ID | Condition | → CURRENT | → Rung and counter | Source |
|---|---|---|---|---|
| R8-R1 | Skipped, or no time logged | Unchanged | Unchanged | `[App]` |
| R8-R2 | Faster than CURRENT | Trial time | Unchanged | `[App]` |
| R8-R3 | Equal or slower than CURRENT | Unchanged | Unchanged | `[AD]` |

Every trial time is saved (History). Only a faster one adds a chart point. The trial neither counts toward nor breaks the counter.

---

## R9 — Zone 2 length

**Question:** How long is Session B?
**Hit policy:** Unique (one row per type)

| ID | Type | Start | Cap | Source |
|---|---|---|---|---|
| R9-R1 | 800m | 20 min | 45 min | `[AD]` |
| R9-R2 | 1.5 mi | 25 min | 50 min | `[AD]` |
| R9-R3 | 3 mi | 30 min | 60 min | `[AD]` |
| R9-R4 | 5 mi | 40 min | 75 min | `[AD]` |

After every 2 Zone 2 runs logged at full length (logged minutes ≥ prescribed), the length goes up 5 min, up to the cap. A Zone 2 run that is skipped or short does not count and does not reset the count.

---

## R10 — Weeks to target (for est. completion, shared S5)

**Question:** How many weeks until CURRENT reaches the target time?
**Hit policy:** First (checked top to bottom)

| ID | Condition | → Weeks | Source |
|---|---|---|---|
| R10-R1 | CURRENT at or below target | 0 (REACHED) | `[App]` |
| R10-R2 | 2+ weeks since the standard was added, and CURRENT has improved | (CURRENT − target) ÷ observed gain per week, rounded up | `[App]` |
| R10-R3 | Otherwise | (CURRENT − target) ÷ default gain per week, rounded up (at least 1) | `[AD]` |

Observed gain = (START − latest CURRENT) ÷ weeks since added.
Default gain = one rung every 2 weeks, so one pace step every 4 weeks: long types 7.5 s/mi × distance per week (3 mi: 22.5 s; 5 mi: 37.5 s); short types 3.75 s/mi × distance per week (800m: 1.9 s; 1.5 mi: 5.6 s).

---

## R11 — Standards saved before v1.0

**Question:** What happens to a run standard saved under the old rules (v0.3)?
**Hit policy:** Unique

| ID | Input | → Result | Source |
|---|---|---|---|
| R11-R1 | Run state with an old ladder pace / adjustments and no rung | Rung 1, counter 0, base pace = CURRENT ÷ distance in miles (rounded). CURRENT unchanged. Zone 2 at the start length (R9). Old ladder pace and adjustments dropped. Old logs stay in History. | `[AD]` |

---

## Examples (Given / When / Then)

**E1 — New long standard (R1, R2-R3, R3-R3, R5-R1)**
Given a 3 mi standard with START 24:00
When the user opens week 1
Then Session A is 2 × 400m in 1:43, then 4 × 3 min @ 8:00/mi, with no threshold rep

**E2 — New short standard (R1, R2-R1, R3-R1, R5-R1)**
Given an 800m standard with START 2:40
When the user opens week 1
Then Session A is 2 × 100m in 0:18, then 4 × 45s @ 5:22/mi, then 1 × 3 min threshold (OPTIONAL, any cardio)

**E3 — Two in a row, CURRENT holds (R6-R3, R7-R2)**
Given a 3 mi standard on rung 5 (7 min @ 7:30), CURRENT 24:00, counter 1
When the user logs 4 × 7:00 at 7:30/mi, every rest 2:00 or less
Then the rung becomes 6 (5 min @ 7:00), counter 0, and CURRENT stays 24:00 (one rep converts to 24:08)

**E4 — Two in a row, CURRENT drops (R6-R3, R7-R1)**
Given a 3 mi standard on rung 6 (5 min @ 7:00), CURRENT 24:00, counter 1
When the user logs 4 × 5:00 at 7:00/mi, every rest 2:00 or less
Then the rung becomes 7 (7 min @ 7:00), counter 0, and CURRENT becomes 22:53

**E5 — Skipping a rung (R6-R2)**
Given a 3 mi standard on rung 1 (3 min @ 8:00), counter 0
When the user logs 4 × 5:00 at 7:58/mi, every rest 2:00 or less
Then the rung becomes 2 (the highest met; rung 3 needs 7 min, rung 4 needs 7:30/mi), counter 1, and CURRENT stays 24:00 (converts to 26:15)

**E6 — Rest too long (R6-R5)**
Given counter 1
When every interval hits the rung but one rest is 2:30
Then the counter becomes 0; rung and CURRENT stay the same

**E7 — Faster Time Trial (R8-R2)**
Given week 4, CURRENT 24:00, rung 5, counter 1
When the user runs the Time Trial in 23:30
Then CURRENT becomes 23:30; rung 5 and counter 1 are unchanged

**E8 — Slower Time Trial (R8-R3)**
Given CURRENT 23:30
When the user runs the Time Trial in 23:45
Then CURRENT stays 23:30 and the time is saved in History

**E9 — Zone 2 grows (R9-R3)**
Given a 3 mi standard with Zone 2 at 30 min
When the user logs two Zone 2 runs of 30 min or more
Then Zone 2 becomes 35 min

**E10 — Old standard (R11-R1)**
Given a 3 mi standard saved under v0.3 with CURRENT 23:00
When the app reads it
Then it is on rung 1: 4 × 3 min @ 7:40/mi, counter 0, CURRENT 23:00

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
| 2026-11-12 | R2–R11 | v1.0 draft: every rule after R1 rebuilt. Ladder is now rungs of rep length and pace (R3), with 4 race-pace intervals per session. A rung is met only with every rest ≤ 2:00; 2 in a row moves up, and a higher rung can be met to skip ahead (R6). CURRENT on a move = one rep converted with the run calculator, only if faster (R7). Speed reps: 2 per session, split from CURRENT. Short types add an optional threshold rep, any cardio. Weeks: A / B / A; week 4: A / B / optional Time Trial (deload removed). Zone 2 length grows +5 min per 2 full runs to a cap; no pace given, user logs it (R9). Personal adjustment (old R7) removed. Old standards restart on rung 1 from CURRENT pace (R11). | A.D. rebuild before Play Store release |
| 2026-11-12 | Definitions | Session A, speed rep, threshold rep updated; ladder part renamed race-pace interval; ladder pace replaced by base pace and rung; adjustment removed; rest and run calculator added. | Broken by the v1.0 rules |
| 2026-11-12 | All | v1.0 approved. | A.D. approval |
| 2026-11-12 | All | Engine built to v1.0 (F32). No rule changed. | Build |
