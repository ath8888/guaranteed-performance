# Guaranteed Standards — Android MVP Progress

> Ralphy-style: pick one feature, code it, test it, mark it done, move on.
> One feature in progress at a time.

---

## Feature Backlog

- [x] **F1** — Project setup + navigation structure (Expo + React Navigation, 3 bottom tabs: Home / Plan / Execute) — DONE ✓ (tested on device 2026-10-18)
- [x] **F2** — Port plan engine (strength.ts + shared.ts + registry.ts + progression.ts only — no run/pushup/pullup engines) — DONE ✓ (20/20 tests pass 2026-10-18)
- [x] **F3** — AsyncStorage service layer (StandardService, TrainingService, SessionService, ExportService) — DONE ✓ (40/40 tests pass 2026-10-18)
- [x] **F4** — Home screen + Add Standard sheet ("+" button → bottom sheet: 4 chips Bench/OHP/Squat/Deadlift, lb inputs) — DONE ✓ (tested on device 2026-10-18)
- [x] **F5** — Plan screen (standard selector, week indicator W1–W4, session cards: done/today/upcoming) — DONE ✓ (tested on device 2026-10-18)
- [x] **F6** — Execute screen (set-by-set checkboxes, mark complete → return to Plan) — DONE ✓ (tested on device 2026-10-18)
- [x] **F7** — Archive/Delete standard from Home (long-press → action row → confirm delete) — DONE ✓ (tested on device 2026-10-18)
- [x] **F8** — 1RM growth chart per standard (line chart from session logs, accessible from Home) — DONE ✓ (tested on device 2026-10-18)
- [x] **F9** — Swipe left/right on Plan screen to switch between standards — DONE ✓ (covered by F18 + F20; closed 2026-11-08)
- [x] **F10** — Keyboard no longer covers Add Standard sheet — DONE ✓ (tested on device 2026-10-21)
- [x] **F11** — Remove goal date; show Estimated Completion Date on Home card, chart, and export — DONE ✓ (43/43 tests pass, tested on device 2026-10-21)
- [x] **F12** (v1) — Olympic Lift category + type + engine (65/75/85, 70/80/90, 75/85/95 × 3; deload 40/50/60 × 3); SKIP on optional BBB; SKIP on Plan cards; set 3 reps logged weeks 1–3, week 3 decides TM — DONE ✓ (65/65 tests pass, tested on device 2026-10-21)
- [x] **F13** (v1) — Calisthenics category + Push-ups engine (strength block: vest 5–8 reps double progression; endurance block: 3 × 50% max, +2 reps after 2 clean sessions; never both in one session; week 4 retest; stall levers; tiers <30 / >60 configurable) — engine + tests only — DONE ✓ (108/108 tests pass 2026-10-21; no UI yet)
- [x] **F14** (v1) — Push-ups screens: Push-ups chip (vest load starts at 0, set on first strength session), editable load per strength session, per-set endurance reps, retest, Recommended/Optional + SKIP, reps units on Home/chart; workout spacing (B opens after 2 rest days, 1 at 3×/week); Plan remembers last standard — DONE ✓ (115/115 tests pass, tested on device 2026-10-22)
- [x] **F15** (v1) — Push-ups formula v2 (replaces F13 rules): weekly Strength day (1 vest AMRAP, >8 reps → +5 lb, <5 hold) + Endurance day (1 AMRAP = new max, then 2 back-off sets × 40% of today's AMRAP, Optional). Stall = no new best 2 weeks → back-offs Recommended; 4 → 3rd back-off set; improvement resets. Spacing: 2 rest days after strength, 3 after endurance. Cards: Session A — Strength, Session B — Endurance (×2); CYCLE + W1–W4 kept (no deload). New programs start at 15 lb vest. — DONE ✓ (111/111 tests pass, tested on device 2026-10-31)
- [x] **BUG-1** — Skipped BBB cards show "✓ DONE" instead of "SKIPPED" (barbell skip saved no session log). Fix: log the skip as `skipped` before advancing the week; past-week optional cards with no log also show SKIPPED (covers skips made before the fix). Uniform across lifts, Olympic, push-ups. — DONE ✓ (tests pass, tested on device 2026-10-31)
- [x] **BUG-2** — Done cards show the prescription rebuilt from the current state (e.g. push-ups' new vest load / best) instead of what was logged. Fix: done cards with logged sets show them (`35 lb × 9`, or `52 reps` bodyweight); RECOMMENDED/OPTIONAL tag hidden on done cards; skipped / unlogged cards keep the prescription. — DONE ✓ (120/120 tests pass, tested on device 2026-10-31)
- [x] **F16** (v1) — Live CURRENT: only rises within a cycle, resets at cycle end. Lifts/Olympic = max(TM/0.9, best e1RM of the main-lift top set logged in weeks 2–3 of this cycle; week 1, deload, BBB ignored). Push-ups = best endurance AMRAP this cycle. Est. completion date uses the new CURRENT (implied TM = CURRENT × 0.9) and is anchored to the start of the current plan week (no daily drift). — DONE ✓ (137/137 tests pass, tested on device 2026-10-31)
- [x] **F17** (v1) — Remove FSL from the Olympic Lift category: main lift only, every week. — DONE ✓ (136/136 tests pass, tested on device 2026-10-31)
- [x] **F18** (v1) — Merge Plan + Execute tabs: 2 bottom tabs (Home / Execute). Execute tab = stack (plan screen → GO → session screen; back returns to plan). Adds `@react-navigation/native-stack`. — DONE ✓ (136/136 tests pass, tested on device 2026-10-31)
- [x] **F19** (v1) — HISTORY tab (3rd tab): LIST | CALENDAR toggle. List = all completed workouts, newest first, grouped by date (standard, session title, logged sets). Calendar = month grid (‹ ›), workout days filled black, today marked blue, tap a day → its workouts. Skipped sessions hidden; read-only; no filter. Deleting a standard keeps its history (name/type remembered). — DONE ✓ (141/141 tests pass, tested on device 2026-10-31)
- [x] **F20** (v1) — Swipe/scroll tweaks: EXECUTE standard chips row scrolls left/right; HISTORY swipe left/right switches LIST ↔ CALENDAR. — DONE ✓ (141/141 tests pass, tested on device 2026-10-31). Swipe wraps around like EXECUTE.
- [x] **F21** (v1) — Top menu restyle: EXECUTE standard chips restyled to match HISTORY LIST | CALENDAR (boxed 2px segments, active black / white text); chip row auto-scrolls to keep the selected standard in view after a swipe. Blue tried and reverted (accent rule). — DONE ✓ (141/141 tests pass, tested on device 2026-10-31)
- [x] **F22** (v1) — Run category + engine (800M / 1.5 MI / 3 MI / 5 MI; START / TARGET race times, no target date) — engine + tests only — DONE ✓ (178/178 tests pass 2026-11-01; no UI yet — screens are F23)
  - Week: Session A ×2 + Session B — Zone 2 (A · B · A, any order, no spacing locks). ≤1.5 MI: "Speed + Threshold"; >1.5 MI: "Threshold + Speed". W4: Session A — Time Trial + Session A deload (ceil(W3 reps / 2), threshold reps at W1 length) + shorter Zone 2.
  - Reps W1/W2/W3 — 800M: 200m × 6/7/8 (1:00) + 3 min × 2/3, 5 min × 2 · 1.5 MI: 400m × 5/6/7 (1:30) + 5 min × 2/3, 7 min × 2 · 3 MI: 5 min × 4/5, 7 min × 4 + 400m × 2/3/4 · 5 MI: 7 min × 3/4/5 + 400m × 2/3/4. Threshold rest 1:00 (3/5 min), 1:30 (7 min). Zone 2 min W1/W2/W3/W4 — 800M 25/30/35/20 · 1.5 MI 30/35/40/25 · 3 MI 40/45/50/35 · 5 MI 45/55/60/40. Warm-up / cool-down note line.
  - Pace ladder: ≤1.5 MI speed reps / >1.5 MI threshold reps; starts at START race pace. 2 Session A's in a row with every ladder rep at or under target → −15 s/mi; a miss restarts the counter (no penalty); average beats the next step → jump to the fastest step run, counter restarts. W4 Time Trial counts: faster than CURRENT = +1, slower = restart. W4 deload A doesn't count.
  - CURRENT: Time Trial sets it either way; each ladder step between trials moves it by half the step.
  - Non-step paces from CURRENT — ≤1.5 MI threshold: Riegel 10K (1.08) + 10 s/mi; >1.5 MI speed: Riegel mile (1.06); Zone 2 ceiling: threshold (formula) + 75 s/mi, never adjusted. Logged faster than planned (all reps) → personal adjustment used for future prescriptions; slower → hold.
  - Est. completion date: (CURRENT − TARGET) ÷ weekly CURRENT gain (observed after 2 weeks, else 3.75 s/mi per week).
- [x] **F23** (v1) — Run screens: RUN chips + START / TARGET (MM:SS) on Add Standard; A · B · A cards, SKIP on every card, no RECOMMENDED tag; Session screen −/+ counters (split, pace, minutes; optional Zone 2 pace), typed Time Trial; Home / chart (flipped axis) / History / Export in M:SS. Device fixes: only the first open run card shows TODAY; speed reps read "200m @ 5:22/mi in 0:40secs" (cards, Session, done cards, History); MARK COMPLETE with unfinished reps (unchecked = "Not done", ladder miss) — DONE ✓ (192/192 tests pass, tested on device 2026-11-01)
- [ ] **F24** (v1) — Lifts engine matches `decision-tables/lifts.md` v0.5. L4: all three + sets judged (week 1 ≥ 5, week 2 ≥ 3, week 3 ≥ 1); any logged miss → TM × 0.90; all met → +10 squat/deadlift, +5 bench/OHP; 1 rep on week 3 now progresses (was hold); no week 3 log → hold. Rounding fix (175 × 70% now 125, was 120). (L1-R2 rep-max start later dropped — START is the only input.) Olympic engine untouched. — **TESTS PASS (220/220, tsc clean 2026-11-08) — AWAITING DEVICE TEST**
- [ ] **F25** (v1) — Olympic engine matches `decision-tables/olympic-lifts.md` v0.4. O3: all three top sets judged — any logged top set under 3 → hold (was week 3 only); week 3 = 0 → TM × 0.90; week 3 not logged → hold; all triples → +5. (O1-R2 rep-max start dropped — START is the only input.) — **TESTS PASS (234/234 after rep-max removal, tsc clean 2026-11-08) — AWAITING DEVICE TEST**
- [ ] **F26** (v1) — Lifts CURRENT-driven (`decision-tables/lifts.md` v1.0): CURRENT stored (starts at START); TM = 90% of CURRENT, always. + set moves CURRENT at once: miss → −10%; higher estimate (reps capped at 10) → replaces it. Cycle end: +10 squat/deadlift, +5 bench/OHP if week 3 logged. New `LiftService`; Execute + Plan (skip) route lifts through it; old states fall back to TM ÷ 0.9. Est. completion counts +5/+10 CURRENT per cycle. Replaces F24's L4. v1.1: a week 3 miss blocks the cycle-end increase (L5-R2). — **TESTS PASS (240/240, tsc clean 2026-11-08) — AWAITING DEVICE TEST**
- [ ] **F27** (v1) — Olympic CURRENT-driven (`decision-tables/olympic-lifts.md` v0.6): CURRENT stored (starts at START); TM = 90% of CURRENT, always. No AMRAP, so CURRENT changes only at cycle end: all logged top sets = 3 → +5; anything else holds (−10% reset removed). Olympic routed through `LiftService`; Home shows stored CURRENT (F16 live estimate dropped for Olympic); old states fall back to TM ÷ 0.9; est. completion counts +5 CURRENT per cycle. — **TESTS PASS (244/244, tsc clean 2026-11-09) — AWAITING DEVICE TEST**
- [ ] **Export** (v1 per master-plan.md "manual export") — export UI + include push-up state (max, vest load, endurance reps × sets, workouts/week, retests). On hold until requested.

---

## Completed

**PRE-F1** — Deleted all Lovable/web source files. Expo TypeScript project initialized in same repo. Plan engine backed up to scratchpad. ✓

---

## Session Log

### 2026-10-17 — Planning session
- Decided on: Expo/React Native, TypeScript, AsyncStorage
- MVP scope: 3 screens (Home, Plan, Execute) — bottom tab nav
- Home screen: standards list + "+" to open Add Standard sheet
- Standards (MVP): Bench, OHP, Squat, Deadlift only
- Design: RawBlock with electric blue accent
- Wrote: `android-mvp-plan.md`, `master-plan.md`, `design.md`, `progress.md`
- Wireframe v2 approved (bottom nav, "+" on Home, 4 barbell standards)
- Ready to code F1

---

## V2 Backlog
- **Learning predictions** — look at each user's progression over time and improve the Estimated Completion Date model (replace fixed assumptions like +10%/cycle for push-ups).

---

## Rules
1. One feature at a time. Mark `in progress` before touching code.
2. Test on Expo Go (physical device) before marking done.
3. No moving to F(n+1) until F(n) is `done` and tested.
4. If a feature reveals a blocker, note it here before pivoting.
