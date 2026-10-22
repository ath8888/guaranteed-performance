# Guaranteed Standards — Claude Code Instructions

## What this project is
Minimal Android fitness test prep app for military/police/fire professionals.
Built with Expo (React Native) + TypeScript. Tested on a physical Android device via Expo Go.

---

## Workflow (Ralphy loop — mandatory)
1. **Plan first.** Before writing any code, confirm the approach with the user.
2. **One feature at a time.** Never start F(n+1) until F(n) is tested and marked done in `progress.md`.
3. **Test on device.** Each feature must run on the physical Android phone via Expo Go before marking done.
4. **Write and run a test.** After finishing a feature, write a test (Jest unit test for logic, device smoke test for UI) and run it before marking done.
5. **Track in `progress.md`.** Mark features `in progress` before touching code, `done` after device test + passing tests.

---

## Do not do without explicit permission
- Make design changes beyond what was asked
- Refactor or clean up code adjacent to the task
- Add features, error handling, or abstractions not requested
- Change navigation structure, colors, fonts, or layout unprompted

When in doubt, ask before touching it.

---

## Tech stack (decided — do not change)
| Layer | Choice |
|---|---|
| Framework | Expo SDK 57 (React Native 0.86.3) + TypeScript |
| Runtime | React 19.2.3, Node 20 (via fnm) |
| Navigation | React Navigation v6 — **3 bottom tabs: Home / Plan / Execute** |
| Storage | AsyncStorage (local, no backend) |
| Plan engine | Wendler 5/3/1 + BBB — `strength.ts`, `shared.ts`, `registry.ts`, `progression.ts` |

## Dev environment (confirmed working)
- **Phone:** Samsung SM-S911U, Expo Go SDK 57, connected via USB + WiFi LAN
- **Start Metro:** `PowerShell -ExecutionPolicy Bypass -File start-expo.ps1` (uses Node 20 path)
- **Metro URL:** `exp://192.168.1.83:8081` (LAN — phone and computer on same WiFi)
- **Node path:** `C:\Users\athol\AppData\Roaming\fnm\node-versions\v20.20.2\installation`
- **Reinstall deps:** `PowerShell -ExecutionPolicy Bypass -File setup-node20.ps1`
- Do NOT use `--host localhost` — LAN works, localhost/ADB tunnel does not reliably open Expo Go
- RN 0.86 uses edge-to-edge by default — wrap app in `SafeAreaProvider`, do NOT set fixed `height` on `tabBarStyle`

---

## MVP scope (decided — do not expand)
- **Standards: Bench, OHP, Squat, Deadlift only.** Run/pushups/pullups are excluded from MVP.
- **3 screens:** Home, Plan, Execute. No Setup tab.
- **Add Standard:** "+" button centered at bottom of Home screen → opens a bottom sheet.
- **Data:** local AsyncStorage only, no auth, no backend.

---

## Design system (RawBlock — do not deviate)
- `borderRadius: 0` everywhere — no exceptions
- Borders: 2–3px solid `#000000`
- Accent color `#0000FF` (electric blue) — used **only** on current-value numbers and "Today" indicators
- No shadows, no gradients
- Fonts: Archivo Black (headlines), Work Sans (body), Space Mono (numbers/mono)
- Labels: ALL CAPS, tight letter-spacing
- Full black/white inversion on press states

Full spec in `design.md`.

---

## Key files
| File | Purpose |
|---|---|
| `progress.md` | Feature tracker — source of truth for what's done |
| `android-mvp-plan.md` | Full technical spec (screens, data models, services) |
| `master-plan.md` | Product vision and roadmap |
| `design.md` | RawBlock design system reference |
| `CLAUDE.md` | This file |

---

## Feature build order
- **F1** — Project setup + React Navigation (3 bottom tabs wired, blank screens)
- **F2** — Port plan engine (strength.ts + shared.ts + registry.ts + progression.ts only)
- **F3** — AsyncStorage service layer (StandardService, TrainingService, SessionService)
- **F4** — Home screen + Add Standard sheet
- **F5** — Plan screen
- **F6** — Execute screen
