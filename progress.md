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
- [ ] **F9** — Swipe left/right on Plan screen to switch between standards — **IN PROGRESS**
- [x] **F10** — Keyboard no longer covers Add Standard sheet — DONE ✓ (tested on device 2026-10-21)
- [x] **F11** — Remove goal date; show Estimated Completion Date on Home card, chart, and export — DONE ✓ (43/43 tests pass, tested on device 2026-10-21)
- [x] **F12** (v1) — Olympic Lift category + type + engine (65/75/85, 70/80/90, 75/85/95 × 3; deload 40/50/60 × 3; optional FSL 3×3); SKIP on optional BBB/FSL; SKIP on Plan cards; set 3 reps logged weeks 1–3, week 3 decides TM — DONE ✓ (65/65 tests pass, tested on device 2026-10-21)
- [x] **F13** (v1) — Calisthenics category + Push-ups engine (strength block: vest 5–8 reps double progression; endurance block: 3 × 50% max, +2 reps after 2 clean sessions; never both in one session; week 4 retest; stall levers; tiers <30 / >60 configurable) — engine + tests only — DONE ✓ (108/108 tests pass 2026-10-21; no UI yet)
- [x] **F14** (v1) — Push-ups screens: Push-ups chip (vest load starts at 0, set on first strength session), editable load per strength session, per-set endurance reps, retest, Recommended/Optional + SKIP, reps units on Home/chart; workout spacing (B opens after 2 rest days, 1 at 3×/week); Plan remembers last standard — DONE ✓ (115/115 tests pass, tested on device 2026-10-22)
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
