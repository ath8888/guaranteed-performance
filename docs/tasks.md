# tasks.md — Guaranteed Standards MVP

Source of truth for Phase 1 (MVP). Update this file as work completes.
Reference docs: `docs/masterplan.md`, `docs/implementation-plan.md`,
`docs/design-guidelines.md`, `docs/app-flow-pages-and-roles.md`.

---

## ✅ Completed

### 1. Data layer & schema
- [x] `Standard`, `TrainingState`, `CheckIn`, `SessionLog` types — `src/lib/types.ts`
- [x] IndexedDB storage behind service abstraction — `src/lib/db.ts`
- [x] `currentValue(standard)` helper
- [x] `advanceWave(standard, amrapValue?)` helper
- [x] `draftService` for partial Setup persistence

### 2. Routing & shell
- [x] TanStack Router file-based routes for 5 screens + hidden `/settings`
- [x] Fixed bottom nav (Home / Plan / Check-in / Guarantee)
- [x] Safe-area aware; single-column 480px max

### 3. Plan engine — `src/lib/plan/`
- [x] Wendler 5/3/1 + BBB for lifts (`strength.ts`)
- [x] Calisthenics hybrid for pushups (`calisthenics.ts`): Day A (5/3/1 + FSL) + Day B (adaptive density + 2-min test)
- [x] Running pace formulas per spec (`run.ts`, `paceTargets()`) incl. edge case
- [x] Week 4 deload + timed test; cycle progression on wave complete
- [x] Wendler AMRAP-driven TM progression (`progression.ts`, `wendlerNextTM`)
- [x] Editable per-set actuals; Day B 2-min test auto-logs as Check-in

### 4. Screens
- [x] Setup — pick → values, with auto-saved draft and <4-week deadline note
- [x] Home — per-standard cards, gear icon → Settings
- [x] Plan — week sessions, "Advance to week N" / "Complete wave" buttons
- [x] Check-in — log attempt, auto-advance on Week-4 run test
- [x] Guarantee — recap + refund stub copy
- [x] Settings — version, "Reset all data" with confirm step

### 5. Design system
- [x] Single cobalt blue accent, `@fontsource/inter` + `inter-tight`
- [x] No badges/streaks/confetti; tabular numerals on every figure
- [x] Empty-state copy matches `design-guidelines.md` verbatim

### 6. PWA install (replaces Capacitor for MVP)
- [x] `public/manifest.webmanifest` (standalone, portrait)
- [x] 192/512 icons + apple-touch-icon + iOS meta
- [x] No service worker (manifest-only, per PWA skill)

### 7. Pre-test bug fixes (June 18, 2026)
- [x] BUG 1 — `Standard.desiredCompletionDate` is the real test date (immutable); calculated ETA stored separately as `estCompletionDate`. Displayed on Home (secondary line) and Guarantee.
- [x] BUG 2 — Circle checkbox disabled for lift/pushup sessions with sets; "Save & complete" is the only completion path so AMRAP is captured.
- [x] BUG 3 — Directional validation on Setup (target must be heavier/faster/more reps than baseline) with inline error.
- [x] ISSUE 4 — Check-in shows "Wave complete. New paces calculated." after auto-advance.
- [x] ISSUE 5 — All check-in dates standardized to full ISO timestamps.
- [x] Minor — `prefers-reduced-motion` global rule added; `package.json` name renamed to `guaranteed-standards`; clarifying comment on `wendlerNextTM`.
- [x] Setup now accepts an optional Test date input.
- [x] Settings — Archive a Standard (hides it from all four tabs; data preserved for future History tab).

---

## 🧪 Self-test (week of June 18, 2026)

Install on Android:
1. Publish, open the printed `.lovable.app` URL in Chrome on the phone
2. Menu (⋮) → **Install app** → confirm
3. Launch from home screen (no browser chrome)

What to watch for during the week:
- [ ] Run Setup with at least one **load lift** + the **3-mile run**
- [ ] Verify pace math on Plan: intervals should equal `(target÷3 − 18) sec/mi`
- [ ] Complete a full week, tap "Advance to week N", repeat to Week 4
- [ ] Log a Week-4 test on Check-in → wave auto-advances and TM/pace update
- [ ] Log 2–3 ordinary check-ins; confirm "current" updates on Home and Guarantee
- [ ] Note any copy that feels off-tone (hype, apology, exclamation points)
- [ ] Confirm app still works after closing/reopening (IndexedDB persistence)
- [ ] Try **Settings → Reset all data**; confirm it returns to the empty Home state
- [ ] On Plan: edit weight/reps per set, tap "Save & complete"; reopen, verify values persisted
- [ ] On Week 3 main lift, log AMRAP reps; after completing Week 4, verify next cycle's TM follows Wendler (≥prescribed+1 → bump, ==prescribed → hold, < → 0.9× reset)

---

## 🚫 Out of scope for Phase 1 (do not implement)

Per `docs/masterplan.md` and `docs/implementation-plan.md`:

- Supabase / cloud backup / accounts
- Stripe / live refund processing
- Certainty Score formula
- Reminders / notifications
- Additional Standards (sit-ups, swim, ruck)
- Multi-device sync, data export, social features
- Capacitor Android packaging (PWA install covers this for MVP)

---

## 📎 Key snippets

### Running pace targets — `src/lib/plan.ts`
```ts
export function paceTargets(standardPaceSec: number, currentPaceSec: number) {
  if (currentPaceSec <= standardPaceSec) {
    return { easy: currentPaceSec + 50, tempo: currentPaceSec - 5, interval: currentPaceSec - 10 };
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
