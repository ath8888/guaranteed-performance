# GuaranteedStandards — Calisthenics Category Decision Tables

**Status:** v0.3 — Calisthenics engine built to this file (2026-11-09).
**Owner:** A.D.
**Engine:** Calisthenics engine (`calisthenics.ts`, `CalisthenicsService.ts`). Claude Code updates this engine when this file changes.

## Standing orders for Claude Code

1. This file is the source of truth for the Calisthenics engine.
2. Store rules as data, not as if-statements, where practical.
3. Write one test per row and one test per example.
4. Flag any gap (no row matches) or overlap (two rows match) before writing code.
5. Never change a rule without a matching entry in the change log.
6. Do not implement any row marked `[?]`.
7. Shared rules (CURRENT, weeks, skips, est. completion, delete) live in `shared.md`. Do not repeat them here.

## Source tags

- `[App]` Existing app rule (F15), adopted by A.D.
- `[AD]` A.D.'s rule.
- `[?]` Open decision.

## Shared rules

See `shared.md`: CURRENT is the source of truth (S1-R1), weeks (S3), skips (S4), est. completion (S5).
For push-ups, CURRENT is the highest Day B AMRAP ever logged. It starts at START (C1), only a Day B AMRAP can raise it (C4), and nothing lowers it. The Day A vest set is logged but never changes CURRENT. Calisthenics has no TM and no 5 lb rounding.

## Definitions

| Term | Meaning |
|---|---|
| Calisthenics type | Push-ups (the only one in v1). Pull-ups are out of scope. |
| Day A | Strength day. One card: Session A — Strength (weighted-vest set to failure, reps logged). |
| Day B | Endurance day. Two cards: Session B — Endurance (the AMRAP), then Session B — Endurance (back-off sets). |
| AMRAP | One bodyweight set to failure on Day B. Reps logged. In this file "AMRAP" always means the Day B AMRAP. |
| CURRENT | Highest Day B AMRAP ever logged. Starts at START. Stored. |
| Max | Latest AMRAP logged. Starts at START. Back-off sets are built from it. |
| Stall count | AMRAPs in a row that did not beat CURRENT. |
| Vest load | Weighted-vest load for day A, in lb. The user can change it on any day A. |
| Week 4 | Same as weeks 1–3. No deload, no retest. |

---

## C1 — Starting state

**Question:** What does a new push-up standard start with?
**Hit policy:** Unique

| ID | Input | → CURRENT | → Max | → Vest load | → Stall count | Source |
|---|---|---|---|---|---|---|
| C1-R1 | START (max push-ups the user enters) | START | START | 15 lb | 0 | `[App]` |

---

## C2 — Weekly cards

**Question:** What cards does the user get each week?
**Inputs:** Vest load, CURRENT, Max, stall count
**Hit policy:** Unique (one row per card, every week 1–4)

| ID | Card | Prescription | Source |
|---|---|---|---|
| C2-R1 | 1 — Day A: Strength | Vest load × max reps (to failure) | `[App]` |
| C2-R2 | 2 — Day B: Endurance AMRAP | 1 bodyweight set to failure (shows CURRENT) | `[App]` |
| C2-R3 | 3 — Day B: back-off sets | Sets from C5 × 40% of today's AMRAP (Max), rounded, at least 1. Logged reps can't exceed that number. | `[App]` |

Cards go in order. A card opens as soon as the one before it is logged (done or skipped). There are no rest days.

---

## C3 — Vest load after day A

**Question:** When day A is logged, what happens to the vest load?
**Hit policy:** First (checked top to bottom)

| ID | Condition | → Vest load | Source |
|---|---|---|---|
| C3-R1 | Day A skipped | Unchanged | `[App]` |
| C3-R2 | Reps above 8 | Load used + 5 lb | `[App]` |
| C3-R3 | Otherwise (8 or fewer) | Load used | `[App]` |

"Load used" is the load the user logged (they may change it on the card). The vest load never goes down on its own.
Day A reps are logged (History, export) but never change CURRENT, Max or the stall count.

---

## C4 — After the AMRAP

**Question:** When the day B AMRAP is logged, what changes?
**Hit policy:** First (checked top to bottom)

| ID | Condition | → CURRENT | → Stall count | → Max | Source |
|---|---|---|---|---|---|
| C4-R1 | AMRAP skipped | Unchanged | Unchanged | Unchanged | `[App]` |
| C4-R2 | Reps above CURRENT | Reps | 0 | Reps | `[AD]` |
| C4-R3 | Otherwise (equal to or below CURRENT) | Unchanged | + 1 | Reps | `[AD]` |

An AMRAP never lowers CURRENT. A low AMRAP only adds to the stall count; the stall levers (C5) respond.

---

## C5 — Back-off sets by stall count

**Question:** How many back-off sets, and are they Recommended or Optional?
**Input:** Stall count
**Hit policy:** Unique

| ID | Stall count | → Sets | → Tag | → Note | Source |
|---|---|---|---|---|---|
| C5-R1 | 0–1 | 2 | Optional | — | `[App]` |
| C5-R2 | 2–3 | 2 | Recommended | — | `[App]` |
| C5-R3 | 4–5 | 3 | Recommended | — | `[App]` |
| C5-R4 | 6 or more | 3 | Recommended | STALLED | `[App]` |

Back-off sets never change CURRENT, Max or the vest load.

---

## C6 — Rest days (removed)

Removed in v0.3. There are no mandatory rest days; the next card opens as soon as the one before it is logged (C2). IDs C6-R1 and C6-R2 are retired, not reused.

---

## C7 — CURRENT

**Question:** What is push-ups CURRENT?
**Hit policy:** Unique

| ID | Condition | → CURRENT | Source |
|---|---|---|---|
| C7-R1 | Any time | The stored CURRENT (set by C1, raised only by a Day B AMRAP, C4-R2) | `[AD]` |

CURRENT does not reset at cycle end. A new cycle starts with the same CURRENT.

---

## C8 — Weeks to target (for est. completion, shared S5)

**Question:** How many weeks until CURRENT reaches the target?
**Hit policy:** First (checked top to bottom)

| ID | Condition | → Weeks | Source |
|---|---|---|---|
| C8-R1 | CURRENT at or above target | 0 (REACHED) | `[App]` |
| C8-R2 | 2+ AMRAPs logged and average gain above 0 | (target − CURRENT) ÷ average gain per AMRAP, rounded up | `[App]` |
| C8-R3 | Otherwise | Weeks for CURRENT to reach target at +5% per 4 weeks, compounding, rounded up (at least 1) | `[AD]` |

Average gain = (last AMRAP − first AMRAP) ÷ (number of AMRAPs − 1). If this week's AMRAP is already logged, add 1 week (gains start next week).

---

## Examples (Given / When / Then)

**E1 — Vest goes up (C3-R2)**
Given the vest load is 15 lb
When the user logs 9 reps on day A
Then the vest load becomes 20 lb

**E2 — Vest holds (C3-R3)**
Given the vest load is 15 lb
When the user changes the load to 20 lb and logs 6 reps
Then the vest load is 20 lb

**E3 — New CURRENT (C4-R2)**
Given CURRENT is 50 and stall count is 3
When the user logs a 52-rep AMRAP
Then CURRENT and Max become 52 and stall count becomes 0

**E4 — Stall (C4-R3, C5-R2)**
Given CURRENT is 50 and stall count is 1
When the user logs a 48-rep AMRAP
Then CURRENT stays 50, Max becomes 48, stall count becomes 2
And back-off sets are 2 × 19, Recommended (48 × 0.4 = 19.2)

**E5 — No rest days (C2)**
Given Day A is logged on Monday
When the user opens the plan the same day
Then the Day B AMRAP is open

**E7 — Vest set never moves CURRENT (C3, C7-R1)**
Given CURRENT is 50
When the user logs 60 reps on Day A
Then CURRENT stays 50 and the vest load goes up 5 lb

**E6 — No drop at a new cycle (C7-R1)**
Given CURRENT is 55 and the last AMRAP was 51
When week 4 ends and a new cycle starts
Then CURRENT is still 55

---

## Not yet covered

- Pull-ups (out of scope for v1).

## Change log

| Date | Rule ID | Change | Reason |
|---|---|---|---|
| 2026-11-09 | All | Draft v0.1 created from the app (F15 rules) | Initial conversion |
| 2026-11-09 | C1, C4, C7 | CURRENT is stored and is the highest AMRAP ever (was: best this cycle, reset each cycle). An AMRAP above CURRENT replaces it; nothing lowers it. Best merged into CURRENT. | A.D.: match shared S1, simpler |
| 2026-11-09 | C6 | Mandatory rest days removed (2 after Day A, 3 after Day B). Cards still go in order. | A.D. decision |
| 2026-11-09 | C3, C7 | Written down: only the Day B AMRAP changes CURRENT; Day A vest reps are logged but never do. | A.D.: clarity |
| 2026-11-09 | C8-R3 | Default gain before 2 AMRAPs: +5% per 4 weeks (was +10%). | A.D. decision |
