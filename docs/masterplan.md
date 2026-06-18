## 📘 `masterplan.md`

### 🚀 Elevator Pitch

**Guaranteed Standards** is a minimal, clinical performance-assurance app for people with a mandatory fitness test coming up — military, police, fire, or similar — who need the least amount of training time required to be certain of passing, backed by a money-back guarantee.

---

### 🧩 Problem & Mission

**Problem:**
General fitness apps optimize for engagement, variety, and breadth of workouts. People with a job-mandated standard and a deadline don't need more options — they need one fixed, minimum-effective path to a specific number, and confidence it will work.

**Mission:**
Give people facing a required physical standard the smallest possible training commitment that gets them there, with a real guarantee behind it — not motivation, not gamification, just a plan and a promise.

---

### 🎯 Target Audience

- Busy professionals (~30s) with a job and a family, facing a mandatory fitness test
- Military, police, fire, and similar applicants/incumbents with a hard external standard (not a personal goal)
- People who want minimum time investment, not maximum results
- People who are skeptical of generic fitness apps and want something closer to insurance than entertainment

---

### 🧰 Core Features

- 🎯 **Set Your Standard:** Choose one or more required Standards, enter baseline, set the deadline
- 🏋️ **Plan:** A fixed, short weekly session list — no menu, no substitutions, no decisions
- ✅ **Check-in:** Log a real attempt at the Standard; updates history immediately
- 🏠 **Home:** Plain facts — baseline, current, target, days remaining, today's session
- 🤝 **Guarantee:** Plain-language terms and a refund request flow (payment processing deferred to Phase 2)

---

### 🛠 High-Level Tech Stack

|Layer|Tool / Framework|Why It Fits|
|---|---|---|
|Frontend|React + Vite + TypeScript|Matches existing Capacitor/Android packaging workflow|
|Packaging|Capacitor|Wraps the web app as a native Android app|
|Storage (MVP)|Local-only (IndexedDB)|No login required, no backend needed for MVP|
|Storage (later)|Supabase|Natural next step if cloud backup or accounts are added|
|Payments (later)|Stripe|Required before the refund guarantee can be functionally real|

---

### 🗃 Conceptual Data Model (ERD Sketch in Words)

- **Standard**
  - id
  - type (3-mile run / pushups / bench / OHP / squat / deadlift)
  - baseline value
  - deadline date
  - status

- **TrainingState** (per Standard)
  - trainingMax (load-based lifts) or repTrainingMax (pushups)
  - currentWaveWeek (1–4)
  - currentCycleNumber

- **CheckIn**
  - standardId
  - value
  - date

- **SessionLog**
  - week
  - completedSessions

---

### 🎨 UI Design Principles

- **Simplicity is the differentiator** — not a feature among others, the main one
- **Confident, clinical, minimal** — plain numbers, no hype, no gamification
- **No badges, streaks, or motivational copy** — the plan and the guarantee carry the weight
- **One strong accent color** against black/white/gray — never a "fitness app" palette
- **Every screen should survive losing half its elements** — when in doubt, cut

---

### 🔐 Privacy & Trust Notes

- No login or account creation required for MVP
- All data stored locally, on-device only
- No data leaves the device until a future sync feature is explicitly added
- Guarantee terms are plain language, not legal/insurance jargon

---

### 🛣 Phased Roadmap

#### ✅ **MVP**

- Set Your Standard (5 supported Standards: run, pushups, bench, OHP, squat, deadlift)
- Wendler 5/3/1 + Boring But Big plan engine, with adapted versions for pushups and running
- Check-in logging + simple history
- Home screen with plain progress facts (no derived score)
- Guarantee screen with refund request flow (stubbed — no live payment processing)
- Local-only storage, no auth
- Android packaging via Capacitor

#### 🚀 **V1**

- Real payment processing for the refund guarantee (Stripe)
- Certainty Score — a real, defined formula (deliberately deferred out of MVP)
- Optional cloud backup
- Notifications/reminders for check-ins and sessions

#### 🌐 **V2**

- Additional Standards (sit-ups, swim, ruck march, etc.)
- Multi-device sync
- Human coach escalation tier for at-risk users
- Data export

---

### ⚠️ Risks & Mitigations

|Risk|Mitigation|
|---|---|
|Refund requests with no payment backend|Clearly labeled in-app as pending, not broken — set expectations honestly|
|Wendler 5/3/1 doesn't natively fit running|Keep the outer 4-week wave/test rhythm consistent; adapt the inner content to real run training|
|Local-only data lost on uninstall|Roadmap a manual export feature for V1/V2|
|Users expect a single "score" and don't get one in MVP|Be explicit in copy that progress is shown as plain facts by design, not an omission|
|Plan feels "too simple" to justify trust|Lean into it as the explicit differentiator in copy and onboarding|

---

### 🌱 Future Expansion Ideas

- A real, defined Certainty Score formula (baseline gap, time remaining, check-in trend)
- Human coach escalation when a user falls behind pace
- Wearable/health app import for run data
- Employer or department group plans (multiple users training to the same standard)

---

✅ `masterplan.md` is done.
