# Guaranteed Standards — Design System

> Based on RawBlock, electric blue variant
> Last updated: 2026-10-17

---

## Overview

RawBlock is a brutalist design system: thick borders, sharp edges, system-level aesthetics, raw black-on-white. No rounded corners, no shadows, no polish. Visual hierarchy through border weight and scale contrast only. This is the design language for Guaranteed Standards.

The electric blue variant uses `#0000FF` as the single accent color — for key numbers (current value), "today" indicators, and active states.

---

## Colors

| Token | Value | Use |
|---|---|---|
| Background | `#FFFFFF` | App background |
| Primary text | `#000000` | All body text, borders, fills |
| **Accent (electric blue)** | `#0000FF` | Current value numbers, "Today" indicators ONLY |
| Success | `#008000` | Completed sessions, active status chip |
| Warning | `#FFA500` | At-risk pace warnings |
| Error | `#FF0000` | Validation errors |
| Surface sunken | `#F0F0F0` | Input backgrounds |
| Muted text | `#555555` | Secondary labels |

**Rule**: Blue is used for exactly two things — the "current" number on the Home screen and "Today →" indicators on the Plan screen. Nothing else.

---

## Typography

| Style | Font | Size | Weight | Case |
|---|---|---|---|---|
| H1 | Archivo Black | 20–22px | 400 (font is inherently heavy) | UPPERCASE |
| H2 | Archivo Black | 14–16px | 400 | UPPERCASE |
| Label | Archivo Black | 9–10px | 400 | UPPERCASE + letter-spacing |
| Body | Work Sans | 13–16px | 400 | Sentence case |
| Mono / numbers | Space Mono | 12–15px | 400 | As-is |
| Big stat | Archivo Black | 48–52px | 400 | Numeric |

**Loading fonts in React Native** (Expo):
```
npx expo install expo-font @expo-google-fonts/archivo-black @expo-google-fonts/work-sans @expo-google-fonts/space-mono
```

---

## Spacing

Base unit: 8px. Use intentionally — some irregularity creates tension.

| Token | Value |
|---|---|
| xs | 4px |
| sm | 8px |
| md | 16px |
| lg | 24px |
| xl | 40px |
| xxl | 64px |

---

## Border Radius

**0px on everything. No exceptions.**

In React Native: `borderRadius: 0` on all components.

---

## Borders

| Token | Value | Use |
|---|---|---|
| Default | 3px solid #000 | Cards, inputs, buttons, most elements |
| Heavy | 5px solid #000 | Focus state on inputs |
| Hairline | 1px solid #000 | Internal dividers within a card |
| Muted | 2px solid #CCCCCC | Disabled states |
| Accent | 2px solid #0000FF | "Today" session highlight |
| Success | 2px solid #008000 | Active status chip |

---

## Components

### Buttons

**Primary** — black fill, white text, 3px black border
```
backgroundColor: '#000'
color: '#FFF'
borderWidth: 3
borderColor: '#000'
paddingVertical: 14
fontFamily: 'ArchivoBlack'
fontSize: 12
textTransform: 'uppercase'
letterSpacing: 2
```
Press state: inverts (white fill, black text)

**Secondary** — white fill, black text, 3px black border
```
backgroundColor: '#FFF'
color: '#000'
borderWidth: 3
borderColor: '#000'
```
Press state: inverts

**Disabled** — gray fill, gray border
```
backgroundColor: '#888'
borderColor: '#888'
```

---

### Inputs

Surface sunken fill, 3px black border, Space Mono font.
```
backgroundColor: '#F0F0F0'
borderWidth: 3
borderColor: '#000'
fontFamily: 'SpaceMono'
fontSize: 14
padding: 10 12
```
Focus: borderWidth 5

---

### Cards / Session items

White fill, 3px black border, no radius.
```
backgroundColor: '#FFF'
borderWidth: 3
borderColor: '#000'
padding: 12
marginBottom: 8
```

"Today" variant: `borderColor: '#0000FF'`
"Done" variant: keep black border, show `✓ Done` in green mono

---

### Chips (standard selector)

```
borderWidth: 2
borderColor: '#000'
padding: 4 8
fontFamily: 'ArchivoBlack'
fontSize: 8
textTransform: 'uppercase'
letterSpacing: 0.5
```
Selected: `backgroundColor: '#000', color: '#FFF'`
Unselected: `backgroundColor: '#FFF', color: '#000'`

---

### Status chips

```
borderWidth: 2
padding: 2 8
fontFamily: 'WorkSans'
fontSize: 9
textTransform: 'uppercase'
letterSpacing: 1
```
Active: `borderColor: '#008000', color: '#008000'`

---

### Progress bar

```
height: 7
backgroundColor: '#F0F0F0'
borderWidth: 2
borderColor: '#000'
```
Fill: `backgroundColor: '#000'`

---

### Checkboxes

```
width: 20
height: 20
borderWidth: 3
borderColor: '#000'
```
Checked: `backgroundColor: '#000'` + white checkmark (`color: '#FFF'`)

---

## Week indicator (Plan screen)

Four equal boxes in a row, current week filled black.
```
flex: 1
padding: 5 0
borderWidth: 2
borderColor: '#000'
textAlign: 'center'
fontFamily: 'ArchivoBlack'
fontSize: 9
```
Current: `backgroundColor: '#000', color: '#FFF'`
Other: `backgroundColor: '#FFF', color: '#000'`

---

## Do's and Don'ts

1. **Do** use thick borders (3–5px) as the primary visual organizer — they replace shadows entirely
2. **Don't** round any corners — ever
3. **Do** use full color inversions (black → white, white → black) for press/active states
4. **Don't** use the blue (#0000FF) for anything other than the current-value accent
5. **Do** use Archivo Black at large sizes (48px+) for maximum visual impact
6. **Don't** add decorative images, icons, or illustrations — content and typography do the work
7. **Do** use uppercase + letter-spacing for buttons and labels
8. **Don't** polish or refine — if something looks too designed, strip it back further

---

## Future: MAGNIFICENT phase

When MVP is stable, the design evolves with:
- WebGL backgrounds and particle effects
- Animated progress transitions
- Depth through layered typography, not gradients
- Motion design for session completion

This is deferred. MVP ships raw.
