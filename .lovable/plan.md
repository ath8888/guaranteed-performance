
# Guaranteed Standards — MVP Completion Plan

The repo already has a working MVP: 5 routes (Home, Setup, Plan, Check-in, Guarantee), IndexedDB storage, Wendler 5/3/1 + BBB engine, bottom nav, clinical design tokens. This plan focuses on the **gaps between what's built and the spec**, ships it as an installable Android PWA (Capacitor deferred), and creates `/docs/tasks.md` as the living source of truth.

## Audit: what's already done

- [x] 5-screen architecture (Home, Setup, Plan, Check-in, Guarantee) + bottom nav
- [x] IndexedDB persistence behind service abstraction (`standardService`, `trainingService`, `checkinService`, `sessionService`)
- [x] Wendler 5/3/1 wave math + BBB 5×10 @ 50% TM for lifts
- [x] Pushup adapted rep-based wave
- [x] Setup flow (pick → values → save), per-Standard baseline + target + deadline
- [x] Check-in logging + history list
- [x] Guarantee screen with refund stub copy ("payment processing isn't wired up — known next step")
- [x] Design tokens: single blue accent, clinical type, safe-area aware

## Gaps to close (MVP-blocking)

### 1. Running engine — formulas don't match the spec
`src/lib/plan.ts` currently uses `tempo = pace+20`, `interval = pace-20`, `easy = pace+60`, ignoring `standardPaceSec` entirely. The spec requires:

```ts
// inputs per wave
const standardPaceSec = Math.round(s.target / 3);     // required pace
const currentPaceSec  = t.trainingMax;                // latest 3mi ÷ 3

function paceTargets(standardPaceSec: number, currentPaceSec: number) {
  if (currentPaceSec <= standardPaceSec) {
    // standard already beaten — small fixed stretch
    return {
      easy:     currentPaceSec + 50,
      tempo:    currentPaceSec - 5,
      interval: currentPaceSec - 10,
    };
  }
  return {
    easy:     currentPaceSec + 50,
    tempo:    currentPaceSec - (currentPaceSec - standardPaceSec) * 0.5,
    interval: standardPaceSec - 18,
  };
}
```

Sessions per spec:
- Weeks 1–3: `1× Easy 20–25min @ easy`, `1× Tempo 15–20min @ tempo` + WU/CD, `1× Intervals 6×400m @ interval, 400m easy jog recovery`
- Week 4 (deload/test): drop intervals, run `Timed 3-mile test` → result becomes next wave's `currentPaceSec`

`buildWeek` signature must take `standardTarget` so the run branch can compute `standardPaceSec`.

### 2. Wave progression isn't wired
There's `progressTrainingMax()` in `plan.ts` but nothing calls it. After a Week 4 deload + AMRAP/test, the app needs to:
- Advance `training.week` 1 → 2 → 3 → 4 → 1, and `training.cycle` += 1 when wrapping
- For runs: set `trainingMax = parseTime(lastTimedTest)`
- For lifts: `trainingMax = progressTrainingMax(s, trainingMax)`
- For pushups: same

Trigger: a check-in submission during Week 4 advances the wave. Plain UI affordance on the Plan screen: "Complete wave →" button visible only when all Week-4 sessions are marked done.

### 3. "Current" semantics
Baseline stays locked (already correct). Add a small helper `currentService.get(standardId)` returning `latest CheckIn ?? baseline`, used in Home and Guarantee so the rule lives in one place.

### 4. PWA install support (replaces Capacitor for now)
Manifest-only — no service worker, no offline. Per the PWA skill:
- `public/manifest.webmanifest` with `name`, `short_name: "Standards"`, `display: "standalone"`, `theme_color: "#ffffff"`, `background_color: "#ffffff"`, `start_url: "/"`, icon entries
- Generate `public/icon-192.png` and `public/icon-512.png` (clinical mark — blue square w/ white "GS" or single bar)
- Add `<link rel="manifest">` + `<link rel="apple-touch-icon">` in `__root.tsx` head
- No `vite-plugin-pwa`, no `sw.js`

User installs via Chrome on Android: open the published URL → menu → "Install app". Launches with own icon, no browser chrome.

### 5. `/docs/` folder + `tasks.md`
- Copy the 4 uploaded docs into `/docs/`
- Create `/docs/tasks.md` as the living checklist (Phase-1 MVP only, per your decision). Sections: Completed (audit results), In progress, Upcoming. Subtasks include the code snippets above so they're discoverable inside the repo.

### 6. Minor polish (cheap, fits MVP scope)
- Setup: ensure deadline is in the future (today + ≥4 weeks); warn quietly if not
- Plan: show "Complete wave →" button when Week-4 sessions are all done (drives item 2)
- Empty states: confirm copy matches design-guidelines exactly ("No standard set yet. Choose the test you need to pass.")
- Remove Google Fonts `<link>` in `__root.tsx`, switch to `@fontsource/inter` per the platform's font-loading rule

## Out of scope (deferred to Phase 2/3 per spec)
Supabase, Stripe payments, Certainty Score, reminders, multi-device sync, data export, additional Standards (sit-ups, swim, ruck), Capacitor Android packaging.

## Execution order (when build mode opens)

1. Create `/docs/` folder, copy 4 source docs into it, write `/docs/tasks.md`
2. Fix running engine (formulas + signature change) — file: `src/lib/plan.ts`
3. Add wave progression on Week-4 completion — files: `src/lib/db.ts` (helper), `src/routes/plan.tsx` (button + handler), `src/routes/checkin.tsx` (auto-advance on Week-4 run test)
4. Add `currentService` helper, use in Home + Guarantee
5. Add PWA manifest + icons + head tags
6. Swap Google Fonts CDN → `@fontsource/inter`
7. Verify in preview (Plan screen run sessions show correct pace math; Week-4 advance works; manifest validates)

## Open assumption
For wave progression on **lifts/pushups**, the trigger is "all sessions marked done in Week 4." No AMRAP-reps input field added in MVP — the next wave's TM uses the fixed +5/+10/+2 progression. If you want AMRAP reps captured and used to adjust TM more intelligently, say so and I'll add that input to the Plan screen.
