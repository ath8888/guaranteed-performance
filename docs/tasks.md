# tasks.md — Guaranteed Standards MVP

Source of truth for Phase 1 (MVP). Update this file as work completes.
Reference docs: `docs/masterplan.md`, `docs/implementation-plan.md`,
`docs/design-guidelines.md`, `docs/app-flow-pages-and-roles.md`.

---

## ✅ Completed

### 1. Data layer & schema
- [x] `Standard`, `TrainingState`, `CheckIn`, `SessionLog` types — `src/lib/types.ts`
- [x] IndexedDB storage behind service abstraction — `src/lib/db.ts`
  - `standardService`, `trainingService`, `checkinService`, `sessionService`
- [x] `currentValue(standard)` helper: returns latest check-in or baseline
- [x] `advanceWave(standard, amrapValue?)` helper: bumps week 1→2→3→4→1
      and applies `progressTrainingMax` at cycle wrap

### 2. Routing & shell
- [x] TanStack Router file-based routes for 5 screens
- [x] Fixed bottom nav (Home / Plan / Check-in / Guarantee), hidden on Setup
- [x] Safe-area aware (`env(safe-area-inset-bottom)`)
- [x] Single-column, max-width 480px

### 3. Plan engine — `src/lib/plan.ts`
- [x] Wendler 5/3/1 wave % + AMRAP on last set weeks 1–3
- [x] Boring But Big assistance: 5×10 @ 50% TM (lifts)
- [x] Deload week 4 (no AMRAP for lifts/pushups)
- [x] Pushup rep-based wave (Rep Training Max)
- [x] **Running pace formulas per spec** (`paceTargets()`):
  - `easy = currentPaceSec + 50`
  - `tempo = currentPaceSec − (currentPaceSec − standardPaceSec) × 0.5`
  - `interval = standardPaceSec − 18`
  - Edge case: if `currentPaceSec ≤ standardPaceSec`, use small fixed
    stretch (`-10` interval, `-5` tempo) off current pace
- [x] Week 4 running = easy run + timed 3-mile test
- [x] Progression: +5 lb (bench/OHP), +10 lb (squat/dl), +2 reps (pushups),
      pace re-derived from logged test time (run)

### 4. Screens
- [x] **Setup**: pick standards → enter baseline + target + deadline
- [x] **Home**: per-standard card with baseline / current / target / days
      remaining / cycle+week / sessions complete
- [x] **Plan**: this week's sessions, tap to complete, "Advance to week N"
      button when all sessions done; week-4 wave completion handler
- [x] **Check-in**: log a real attempt; per-standard history; week-4 run
      test auto-advances the wave using logged time
- [x] **Guarantee**: baseline / current / target recap; plain refund terms;
      refund button enabled only after deadline if standard not met;
      submission shows "payment processing not wired up — known next step"

### 5. Design system
- [x] Single blue accent (`oklch(0.52 0.24 264)` ≈ `#2563EB`)
- [x] Inter (400/500/600) + Inter Tight (700/800) via `@fontsource`
      (no CDN, no Google Fonts `<link>`)
- [x] No badges, streaks, confetti; subtle fades only
- [x] Tabular numerals on every measured value (`.num`)

### 6. PWA install (replaces Capacitor for MVP)
- [x] `public/manifest.webmanifest` (standalone, portrait, white theme)
- [x] `public/icon-192.png`, `public/icon-512.png`
- [x] `<link rel="manifest">` + `apple-touch-icon` + iOS meta in
      `src/routes/__root.tsx`
- [x] **No service worker** — manifest-only home-screen install per the
      Lovable PWA skill (no offline behavior)

---

## ▶️ How to install on Android (no Capacitor required)

1. Publish the app (Publish button in Lovable).
2. Open the `.lovable.app` URL in Chrome on the Android phone.
3. Menu (⋮) → **Install app** → confirm.
4. App launches from the home screen with its own icon and no browser
   chrome (`display: standalone`).

Data lives in the phone's IndexedDB. No login, no cloud.

---

## ⏭ Upcoming (still Phase 1, polish)

- [ ] Setup: validate deadline ≥ 4 weeks out; show calm inline note if not
- [ ] Setup: persist a partial draft if user backs out mid-flow
- [ ] Settings sheet: "Reset all data" (calls `resetAll()`), version string
- [ ] Confirm every empty-state string matches `design-guidelines.md`
      verbatim (Home, Plan, Check-in, Guarantee)
- [ ] Smoke pass on a real Android device after publish + install

---

## 🚫 Out of scope for Phase 1 (do not implement yet)

Per `docs/masterplan.md` and `docs/implementation-plan.md`:

- Supabase / cloud backup / accounts
- Stripe / live refund processing
- Certainty Score formula
- Reminders / notifications
- Additional Standards (sit-ups, swim, ruck)
- Multi-device sync, data export, social features
- Capacitor Android packaging (PWA install covers this for MVP)

---

## 📎 Key snippets (for future contributors)

### Running pace targets — `src/lib/plan.ts`
```ts
export function paceTargets(standardPaceSec: number, currentPaceSec: number) {
  if (currentPaceSec <= standardPaceSec) {
    return {
      easy: currentPaceSec + 50,
      tempo: currentPaceSec - 5,
      interval: currentPaceSec - 10,
    };
  }
  return {
    easy: currentPaceSec + 50,
    tempo: Math.round(currentPaceSec - (currentPaceSec - standardPaceSec) * 0.5),
    interval: standardPaceSec - 18,
  };
}
```

### Wave progression — `src/lib/db.ts`
```ts
export async function advanceWave(s: Standard, amrapValue?: number) {
  const t = await trainingService.get(s.id);
  if (!t) return;
  if (t.week < 4) {
    await trainingService.save({ ...t, week: (t.week + 1) as 1|2|3|4 });
    return;
  }
  const nextTM = progressTrainingMax(s, t.trainingMax, amrapValue);
  await trainingService.save({
    standardId: s.id, trainingMax: nextTM, cycle: t.cycle + 1, week: 1,
  });
}
```
