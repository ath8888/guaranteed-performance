# Guaranteed Standards — Android MVP Plan

> **Session date**: 2026-10-17
> **Goal**: Working APK on phone within 2 hours
> **Stack**: Expo (React Native) + TypeScript + AsyncStorage

---

## 1. App Concept

Guaranteed Standards is a minimal, clinical fitness-test prep app for military, police, fire, and similar professionals. The app gives users the smallest possible training commitment to reach a specific physical standard, backed by a money-back guarantee.

---

## 2. Tech Stack Decision

| Layer | Choice | Reason |
|---|---|---|
| Framework | Expo (React Native) | Fastest path to a real APK: install Expo Go on phone, no build step for MVP |
| Language | TypeScript | Same as existing plan engine — direct port |
| Navigation | React Navigation (Stack + Tab) | Standard, well-documented |
| Storage | AsyncStorage | Local-only, no backend needed for MVP |
| Fonts | Google Fonts (Archivo Black, Work Sans, Space Mono) | RawBlock design system |
| Plan engine | Port from `src/lib/plan/` | Pure TypeScript, zero DOM dependencies |

---

## 3. Screen Inventory (MVP)

### 3.1 Home Screen
**Purpose**: Primary daily view — plain facts, nothing motivational.

**Content** (priority order per user):
1. List of active standards — each card shows:
   - Standard name
   - Current → Target (blue accent on numbers)
   - Days remaining
   - ETA
2. "+" button (bottom-right of screen, above tab bar) — opens Add Standard sheet

**Add Standard sheet** (triggered by "+", not a separate tab):
- Standard picker: chip group (Bench / OHP / Squat / Deadlift — 4 chips only)
- Baseline input (lb)
- Target input (lb)

**Validation**: baseline > 0, target > 0, target > baseline

**On save**: creates Standard + initializes TrainingState → sheet closes, card appears in list

---

### 3.2 Plan Screen
**Purpose**: Show the 4-week wave structure and current week's sessions.

**Content**:
- Week indicator: W1 W2 W3 W4 (current highlighted)
- Session list for current week:
  - Session title + status (Done ✓ / Today → / Upcoming)
  - Session detail (sets × reps)
- Note: "Next week unlocks after all sessions complete"

---

### 3.4 Execute Screen
**Purpose**: Work through today's session set-by-set.

**Content**:
- Session name (e.g. "DAY B — BUILD (70%)")
- Set list with checkboxes (weight + reps per set)
- "MARK COMPLETE" button (disabled until all sets checked)
- On complete: saves SessionLog → returns to Home

---

## 4. Data Models

```typescript
type StandardType = "bench" | "ohp" | "squat" | "deadlift"; // MVP: barbell lifts only

interface Standard {
  id: string;                // UUID
  type: StandardType;
  baseline: number;
  target: number;
  status: "active" | "archived";
  createdAt: string;
}

interface TrainingState {
  standardId: string;
  trainingMax: number;
  week: 1 | 2 | 3 | 4;
  cycle: number;
}

interface CheckIn {
  id: string;
  standardId: string;
  value: number;
  date: string;
}

interface SessionLog {
  standardId: string;
  cycle: number;
  week: number;
  sessionIndex: number;
  completedAt: string;
  actuals?: { weight?: number; reps: number }[];
}
```

---

## 5. Services Architecture

```
AsyncStorage (key-value, JSON)
  ├── standards:all           → Standard[]
  ├── training:{standardId}   → TrainingState
  ├── checkins:{standardId}   → CheckIn[]
  └── sessions:{standardId}:{cycle}:{week} → SessionLog[]

Services (pure TypeScript):
  StandardService   — CRUD for Standards
  TrainingService   — get/set TrainingState, advance wave
  CheckInService    — add/list CheckIns, latest value
  SessionService    — log completion, get logs for week
  
Plan Engine (MVP — barbell lifts only):
  src/lib/plan/registry.ts    — ENGINES map (bench/ohp/squat/deadlift)
  src/lib/plan/strength.ts    — lift engine (5/3/1 + BBB)
  src/lib/plan/progression.ts — wavesToTarget, etaDate
  src/lib/plan/shared.ts      — shared types + helpers
```

---

## 6. Design System — RawBlock (Electric Blue variant)

| Token | Value |
|---|---|
| Background | `#FFFFFF` |
| Primary text | `#000000` |
| Accent (electric blue) | `#0000FF` |
| Success | `#008000` |
| Warning | `#FFA500` |
| Error | `#FF0000` |
| Border weight (default) | 3px solid black |
| Border weight (heavy) | 5px solid black |
| Border radius | **0px — no exceptions** |
| Headline font | Archivo Black |
| Body font | Work Sans |
| Mono font | Space Mono |
| Shadows | **None** |

**Rules**: Uppercase labels. Thick borders = hierarchy (no shadows). Full inversion on press (black → white). Blue used ONLY for accent numbers and "Today" indicators.

---

## 7. Environment Setup (one-time)

1. Install Node.js 18+ (https://nodejs.org)
2. `npm install -g expo-cli` (or `npx expo` — no global needed with Expo SDK 50+)
3. Install **Expo Go** on Android phone from Play Store
4. `npx create-expo-app guaranteed-standards-native --template blank-typescript`
5. `cd guaranteed-standards-native && npx expo start`
6. Scan QR code with Expo Go on phone — app loads instantly

---

## 8. MVP Feature Build Order (tonight)

| # | Feature | Est. time | Status |
|---|---|---|---|
| 1 | Project setup + navigation structure | 15 min | ⬜ |
| 2 | Port plan engine from web app | 20 min | ⬜ |
| 3 | AsyncStorage service layer | 15 min | ⬜ |
| 4 | Setup screen | 20 min | ⬜ |
| 5 | Home screen | 20 min | ⬜ |
| 6 | Plan screen | 15 min | ⬜ |
| 7 | Execute screen | 15 min | ⬜ |

**Total estimated**: ~2 hours

---

## 9. Out of Scope for MVP Tonight

- Check-in logging screen
- Guarantee screen + refund flow
- Wave advance flow (can be added post-MVP)
- Notifications
- Pull-ups weighted setup fields (simplified to bodyweight for MVP)
- Multiple concurrent standards
