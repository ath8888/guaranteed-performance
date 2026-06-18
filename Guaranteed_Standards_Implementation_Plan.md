## 🛠️ `implementation-plan.md`

### ✅ Step-by-Step Build Sequence

#### 🏗️ Phase 1: Core App (Local Only, MVP)

1. **Design base schema** for Standard, TrainingState, CheckIn, and SessionLog
2. **Set up local storage layer** (IndexedDB, behind a clean service abstraction so it can be swapped later)
3. **Build "Set Your Standard" onboarding flow**
   - Pick one or more Standards: 3-mile run, pushups, bench press, OHP, squat, deadlift
   - Enter baseline for each, enter deadline date
   - Confirm Guarantee terms (plain language, one screen)
4. **Build the Plan engine**
   - Wendler 5/3/1 + Boring But Big for bench, OHP, squat, deadlift
   - Rep-based adapted wave for pushups (Rep Training Max) — baseline protocol still open, not needed for MVP
   - Adapted 4-week rhythm for running, using the defined pace math below — this one needs to be implemented exactly, not approximated
5. **Build Home screen**
   - Plain facts only: baseline, current, target, days remaining, today's session
6. **Build Check-in flow**
   - Log a real attempt, update history immediately
   - Simple history view, no animation flourish
7. **Build Guarantee screen**
   - Plain terms recap, refund request action
   - Stub confirmation: "Refund processing requires payment integration not yet built"
8. **Wrap as Android app via Capacitor**, reusing the existing build/deploy SOP

---

### 🏃 Addendum: Running Pace Calculations

Unlike the lifts, running has no native percentage-of-max math — these formulas define exactly how the running Plan generates its numbers, so nothing is left to guesswork.

**Inputs:**
- `standardPaceSec` = required test time (seconds) ÷ 3 — the pace needed to meet the Standard
- `currentPaceSec` = most recent timed 3-mile result ÷ 3 — starts as baseline, recalculated every wave

**Target pace formulas, recalculated at the start of each 4-week wave:**
- Easy pace = `currentPaceSec + 50 sec/mile`
- Tempo pace = `currentPaceSec − ((currentPaceSec − standardPaceSec) × 0.5)`
- Interval pace = `standardPaceSec − 18 sec/mile`

**Edge case:** if `currentPaceSec` is already faster than `standardPaceSec` (standard already met), do not use the standard-relative interval formula — use small fixed stretch targets off current pace instead (e.g. `currentPaceSec − 10 sec/mile` for intervals, `currentPaceSec − 5 sec/mile` for tempo) so the plan doesn't keep chasing a number already beaten.

**Fixed weekly sessions (weeks 1–3 of each wave):**
- 1× Easy run — 20–25 min continuous at easy pace
- 1× Tempo run — 15–20 min at tempo pace, plus warm-up/cool-down
- 1× Interval session — 6 × 400m at interval pace, with 400m easy jog recovery between reps

**Week 4 (deload/test):**
- Drop or shorten the interval session
- Run the full timed 3-mile test — this is the running equivalent of the AMRAP set, and its result becomes the new `currentPaceSec` for the next wave

---

9. **Set up Supabase project** (only if/when cloud backup or accounts are added)
10. **Integrate Stripe** to make the refund guarantee functionally real
11. **Define and implement the real Certainty Score formula**
    - Inputs: baseline-to-standard gap, weeks remaining, check-in/AMRAP trend
    - Decide this deliberately — it's the number the product's credibility rests on
12. **Tie session compliance to refund eligibility** once payment is live

---

#### 🌟 Phase 3: Polish & Expansion

13. **Add more Standards** (sit-ups, swim, ruck march, etc.)
14. **Add check-in/session reminders**
15. **Add manual data export** (local-only data has no other backup path)
16. **Usability testing and refinement** of onboarding and Plan clarity

---

### ⏳ Timeline with Checkpoints

|Week|Milestone|
|---|---|
|1–2|Schema, local storage, Set Your Standard flow|
|3–4|Plan engine (5/3/1 + BBB, pushup and running adaptations)|
|5|Home screen, Check-in flow + history|
|6|Guarantee screen + refund stub|
|7|Android packaging via Capacitor, internal testing|
|8|Usability pass on onboarding + Plan clarity|
|9|Buffer / fixes|
|10|MVP release 🚀|

---

### 👥 Team Roles & Rituals

|Role|Responsibilities|
|---|---|
|**Product Owner**|Feature priorities, MVP scope discipline, copy review for tone|
|**Frontend Dev**|React/Vite UI, local storage layer, Capacitor packaging|
|**Programming Consultant**|Validates the 5/3/1 logic and the pushup/running adaptations are sound|
|**Designer**|Minimal UI system, single-accent palette, content style enforcement|

**Rituals:**

- Weekly check-in: what's blocked, what's done
- Pre-release review: re-confirm nothing has crept past the MVP scope line
- Tone pass before ship: every screen re-read for hype/jargon creep

---

### 🧩 Optional Integrations & Stretch Goals

- Apple Health / Google Fit import for run data
- Wearable integration for live pace/heart rate during runs
- Human coach chat escalation for at-risk users
- Department/employer group plans

---

✅ `implementation-plan.md` complete.
