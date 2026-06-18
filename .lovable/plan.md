
# Phase 1 — Polish & Ship

Close out the `docs/tasks.md` § Upcoming list, then publish so you can install the PWA on your Android phone and live-test for a week.

## 1. Setup — deadline validation
- Compute weeks between today and the chosen deadline.
- If `< 4 weeks`: show calm inline note under the date field:
  *"Less than 4 weeks. That may not be enough time to be certain."*
  Do **not** block submit — user can override (per the "no hype, no apology" tone).
- Default deadline stays at +12 weeks.

## 2. Setup — partial draft persistence
- Add a `draftService` to `src/lib/db.ts` backed by IndexedDB key `setup-draft`.
- On every change to `picked` / `deadline` / `step`, debounce-save (200ms).
- On mount: rehydrate the draft if no Standards exist yet.
- On successful save (`Lock in standards`): clear the draft.

## 3. Settings sheet (new screen)
- New route `src/routes/settings.tsx` reached from a small gear icon top-right of Home (not in bottom nav — keeps nav at 4 items per spec).
- Contents (plain list, single column):
  - **App version** — read from `package.json` version baked at build time via Vite `define`.
  - **Reset all data** — destructive button → confirm dialog → calls existing `resetAll()` → navigates to `/`.
- Tone-compliant copy: *"Reset all data. Standards, check-ins, and plan history will be deleted from this device. This cannot be undone."*

## 4. Empty-state copy audit
Per `docs/design-guidelines.md`, normalize to the exact strings:
- Home (no standards): *"No standard set yet. Choose the test you need to pass."*
- Check-in history (no entries): *"No check-ins yet. Log your first attempt to see where you stand."*
- Guarantee (pre-deadline): *"Refund requests open after your test date if the standard wasn't met."*
- Plan (no standards): *"No standard set yet."*

## 5. Tasks.md update
Move the polish items from Upcoming → Completed; add an "🧪 Self-test (week of {date})" section with what to watch for: install on Android, run a full wave on at least one Standard, log 2–3 check-ins, verify pace math on the Plan screen matches expectations, note any copy that feels off-tone.

## 6. Publish
Use the publish tool with `website_info_status: already_relevant` (title/description/manifest/icons all set during MVP build).

## Out of scope (still deferred to Phase 2)
Supabase, Stripe, Certainty Score, reminders, Capacitor — unchanged.

After publish, install steps:
1. Open the printed `.lovable.app` URL on your Android Chrome
2. Menu → Install app
3. Launch from home screen, run through Setup, then live with it for the week
