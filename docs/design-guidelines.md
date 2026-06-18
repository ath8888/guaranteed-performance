## 🎨 `design-guidelines.md`

### 🗣 Brand Voice & Tone

- **Voice:** Confident, clinical, plain — speaks in facts and numbers, not encouragement
- **Tone:**
  - Calm and direct when presenting progress, even when behind schedule
  - Plain and unambiguous in the Guarantee terms — no fine print tone
  - Never "growthy," never hype, never gamified

#### ✏️ Examples

- ✅ _"Bench: 185 → 225. 6 weeks left."_
- ✅ _"Check-in logged. History updated."_
- ✅ _"No standard set yet. Choose the test you need to pass."_
- ❌ _"Great job! 🎉 You're crushing it!"_
- ❌ _"Oops! Something went wrong 😬"_
- ❌ _"You're 87% certain — keep crushing those reps!"_ (no derived score language in MVP)

---

### 🎨 Color, Typography, Spacing

#### 📐 Primary Colors

|Role|Hex|Notes|
|---|---|---|
|Primary Accent|`#2563EB`|Strong cobalt blue, used sparingly and deliberately|
|Background|`#FFFFFF`|Plain white|
|Dark Section|`#0A0A0A`|Reserved for the Guarantee screen only — gives it more weight|
|Surface|`#F5F5F5`|Low-contrast card background|
|Text|`#111`|Near-black, WCAG AA compliant|
|Borders|`#DDD`|Subtle outlines|

No secondary palette, no gradients, no neon. One accent color, used with restraint.

#### 🔠 Fonts

- **Primary:** Inter or a similar geometric grotesk
- **Weight usage:**
  - 600 for the key number on each screen (e.g. days remaining, current value)
  - 500 for headings
  - 400 for body text
  - No weight lighter than 400 — nothing should look like a hint or a whisper

#### 📏 Spacing & Layout

- 16px base spacing unit
- 24–32px padding around major sections
- 44px minimum tap targets
- Single-column layout throughout — no multi-panel dashboards, even on tablet

---

### 🧱 Layout Best Practices

- **Mobile-first:** every screen designed for one-handed thumb use
- **No persistent nav clutter:** five screens total (Set Your Standard, Home, Plan, Check-in, Guarantee) — resist adding more
- **No badges, streaks, or progress bars styled as games**
- **Empty states:** plain, calm, action-oriented — no apology, no exclamation points

#### 🔍 Examples

- Home, before any Standard is set:
  _"No standard set yet. Choose the test you need to pass."_
- Check-in history, before any entries:
  _"No check-ins yet. Log your first attempt to see where you stand."_
- Guarantee, before deadline has passed:
  _"Refund requests open after your test date if the standard wasn't met."_

---

### ♿ Accessibility Must-Dos

- Font size: 16px minimum
- Color contrast: WCAG AA (4.5:1 text to background)
- All interactive elements:
  - Focusable with clear outlines
  - Keyboard-navigable (tab order)
  - ARIA labels where icons are used without text

#### UI Motion

- Subtle fades only, no slides or bounces
- Respect `prefers-reduced-motion`
- No celebratory animation on check-in submission — a calm state update is enough

---

### ✍️ Content Style Guide

#### Headings

- Title Case for screen names (e.g. "Set Your Standard")
- Sentence case for in-screen section headers

#### Numbers

- The most important number on any screen should be the largest element on it
- Never round in a way that implies false precision — show the real check-in value, not a smoothed one

#### Links & Buttons

- **Do:** _"Log Check-in"_, _"View Plan"_, _"Request Refund"_
- **Don't:** _"Click here"_, _"Let's go"_, _"Tap to continue"_

---

✅ `design-guidelines.md` is ready.
