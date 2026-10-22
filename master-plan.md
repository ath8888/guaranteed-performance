# Guaranteed Standards — Master Plan

> Source of truth: `C:\Users\athol\guaranteed-performance`
> Last updated: 2026-10-17
> Platform: Android (Expo / React Native)

---

## Elevator Pitch

**Guaranteed Standards** is a minimal, clinical performance-assurance app for people with a mandatory fitness test coming up — military, police, fire, or similar — who need the least possible training time to be certain of passing, backed by a money-back guarantee.

**Core USP**: "We don't sell workouts. We sell results. Guaranteed, or your money back."

---

## Problem & Mission

**Problem**: General fitness apps optimize for engagement, variety, and breadth. People with a job-mandated standard and a hard deadline don't need options — they need one fixed, minimum-effective path to a specific number, and confidence it will work.

**Mission**: Give people facing a required physical standard the smallest possible training commitment that gets them there — not motivation, not gamification, just a plan and a promise.

---

## Target Audience

- Military, LEO, fire, and selection candidates with a hard external standard
- Busy professionals (~30s) with a job and a family, not hobbyist fitness seekers
- People who want minimum time investment, not maximum results
- Skeptics of generic fitness apps — want something closer to insurance than entertainment

---

## Screens (MVP — Android)

| Screen | Purpose |
|---|---|
| **Home** | Standard cards (current→target, days remaining, ETA). "+" button to add a new standard via bottom sheet. |
| **Plan** | 4-week wave view, this week's session list |
| **Execute** | Set-by-set completion with checkboxes, mark session done |

Navigation: 3-tab bottom nav (Home / Plan / Execute). No Setup tab — standard is added via "+" on Home.

Future screens (V1+): Check-in, Assess (history), Guarantee

---

## Data Model

```typescript
type StandardType = "bench" | "ohp" | "squat" | "deadlift" // MVP: barbell lifts only

interface Standard {
  id: string
  type: StandardType
  baseline: number          // starting value (the day they set up)
  target: number            // required standard to pass
  deadline?: string         // ISO date — test date
  status: "active" | "archived"
  createdAt: string
}

interface TrainingState {
  standardId: string
  trainingMax: number       // lb for lifts, reps for calisthenics
  week: 1 | 2 | 3 | 4
  cycle: number
}

interface CheckIn {
  id: string
  standardId: string
  value: number             // actual tested result
  date: string
}

interface SessionLog {
  standardId: string
  cycle: number
  week: number
  sessionIndex: number
  completedAt: string
  actuals?: { weight?: number; reps: number }[]
}
```

---

## Plan Engine

The training plan logic lives in `src/lib/plan/` (pure TypeScript, zero DOM dependencies — portable directly to React Native):

| File | Handles |
|---|---|
| `registry.ts` | ENGINES map, StandardEngine interface |
| `strength.ts` | Barbell lifts (bench, OHP, squat, deadlift): 5/3/1 + BBB |
| `progression.ts` | wavesToTarget, etaDate, initTrainingMax |
| `shared.ts` | Shared types, estimate1RM, roundLb |

MVP uses `strengthEngine` only. Run, pushup, and pullup engines are excluded from MVP.

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Expo (React Native) + TypeScript | Expo Go for device testing — no build step for MVP |
| Navigation | React Navigation | Stack + Tab navigator |
| Storage (MVP) | AsyncStorage | Local-only, JSON |
| Storage (V1) | Supabase | Cloud backup |
| Payments (V1) | RevenueCat | Required before guarantee is real |
| Paywall | Superwall | |
| Analytics | PostHog | |
| CI/CD | EAS Build | For production APK |
| Design system | RawBlock (electric blue) | See `design.md` |

---

## Design Principles

- **Simplicity is the differentiator** — not a feature, the point
- **Confident, clinical, minimal** — plain numbers, no hype, no gamification
- **No badges, streaks, or motivational copy** — the plan and the guarantee carry the weight
- **Electric blue** as the single accent against black/white/gray
- **Every screen should survive losing half its elements** — when in doubt, cut

See `design.md` for the full RawBlock spec.

---

## Privacy & Trust

- No login or account creation required for MVP
- All data stored locally, on-device only
- No data leaves the device until a future sync feature is explicitly added
- Guarantee terms in plain language, not legal jargon

---

## Phased Roadmap

### ✅ MVP (current)
- 3 screens with bottom tab nav: Home, Plan, Execute
- "+" button on Home to add standards via bottom sheet (no Setup tab)
- 4 supported standards: Bench, OHP, Squat, Deadlift (barbell lifts only)
- Wendler 5/3/1 + BBB plan engine (ported from web prototype)
- AsyncStorage, no auth
- Tested on physical Android device via Expo Go

### 🚀 V1
- EAS Build → production APK on Play Store
- Check-in logging + history (Assess screen)
- Guarantee screen + refund flow (RevenueCat)
- Certainty Score formula
- Push notifications for sessions and check-ins
- Easy data sync with Notion / Obsidian

### 🌐 V2
- Supabase cloud backup + multi-device sync
- Additional standards (sit-ups, swim, ruck)
- Human coach escalation for at-risk users
- Onboarding flow
- Employer / department group plans

---

## Build Workflow (Ralphy methodology)

1. Pick one feature from `progress.md`
2. Claude codes it
3. Test on Expo Go (physical device) — must work before marking done
4. Mark done in `progress.md`
5. Move to the next feature

**Source of truth files in this repo:**
- `master-plan.md` — this file
- `android-mvp-plan.md` — full technical spec (screens, data models, services)
- `progress.md` — Ralphy feature tracker
- `design.md` — RawBlock design system reference
- `AGENTS.md` — Claude Code project instructions

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Expo Go limitations (some native APIs) | EAS Build for V1 if needed |
| Plan engine TypeScript incompatibilities with RN | Port and verify (F2) before building any screen |
| 2-hour window tight | If behind: combine Home+Plan as one screen; defer Execute to next session |
| Local data lost on uninstall | Roadmap manual export + Supabase sync for V1 |
| Wendler doesn't natively fit running | Keep 4-week wave rhythm; adapt inner content — already done in engine |
