---
name: Bellaso
version: 0.3.0
source: apps/web/app/globals.css and apps/web/app/layout.tsx, after the rebrand of 25 Nov 2026.
reference: three designs that the user selected on 25 Nov 2026. Promise by Zajno (line diagrams in boxes), X-Leap by Phenomenon Studio (one large hero object and a very large headline), Paymark by Emon (near-black with one warm glow and product cards).
colors:
  board: "oklch(0.145 0.004 60)"
  board-raised: "oklch(0.185 0.005 60)"
  board-deep: "oklch(0.115 0.004 60)"
  chalk: "oklch(0.96 0.004 90)"
  chalk-muted: "oklch(0.74 0.006 90)"
  chalk-line: "oklch(0.96 0.004 90 / 0.18)"
  accent: "oklch(0.74 0.17 50)"
  accent-hover: "oklch(0.82 0.13 55)"
  accent-tint: "oklch(0.25 0.05 50)"
  soft: "oklch(0.82 0.01 80)"
  soft-tint: "oklch(0.24 0.006 80)"
  on-chalk: "oklch(0.15 0.005 60)"
  success: "oklch(0.80 0.10 160)"
  danger: "oklch(0.72 0.14 25)"
typography:
  display: "Geist, 500, letter-spacing -0.03em to -0.045em"
  ui: "Geist, 400/500/600"
  mono: "Geist Mono, 400/500"
radius: { control: "10px", card: "14px", button: "999px", badge: "999px" }
motion:
  ui: "220ms cubic-bezier(0.22, 1, 0.36, 1)"
  state: "420-900ms cubic-bezier(0.16, 1, 0.3, 1)"
  draw: "1.1-2.6s cubic-bezier(0.65, 0, 0.35, 1)"
  ambient: "7-14s loops (lattice sweep, card drift, journey steps)"
---

# Design System: Bellaso

## 1. Overview

A near-black page with one warm accent. A very large headline says the product in two lines. One live figure for each screen shows the real mechanism. The first version of this system (a chalkboard with a serif typeface) was replaced on 25 Nov 2026.

The token names `board` and `chalk` stay from the first version. `board` is the page color and `chalk` is the text color.

## 2. Colors

Strategy: **Restrained**. Neutral surfaces and one accent.

- **Accent** `oklch(0.74 0.17 50)`: the key phrase of a headline, links, the current selection, each thing that is "yours" or "hidden". Use it for 10% of a screen or less.
- **Soft** `oklch(0.82 0.01 80)`: drawings, the points of the lattice, the label "public". It is a neutral, not a second accent.
- **Board** `oklch(0.145 0.004 60)`: the page. **Board raised** `oklch(0.185 0.005 60)`: cards and tables, with a 1px line at 18%.
- **Chalk** for text, **chalk muted** for secondary text.

### Named rules

- **One accent.** Do not add a second saturated color. "Hidden" is the accent, "public" is soft with an outline. The two also have a text label.
- **One glow.** The page has one warm radial glow in the bottom right corner (`body::before` in `globals.css`). Do not add a glow to a card, a button or a text.
- **Primary buttons are light.** A primary button has a chalk fill and dark text. The accent is not a button fill.
- **No blur.** Cards are solid. No glass, no backdrop filter.

## 3. Typography

- **Geist** for headlines and all UI. Headlines use weight 500 and tight letter spacing. The hero uses `clamp(46px, 8vw, 112px)` with line height 0.96.
- **Geist Mono** for addresses, hashes, byte counts, labels in capitals and equations.
- No serif and no italic for headlines. The deck uses an italic accent phrase in its titles.

## 4. Shape and elevation

- Cards have a 14px radius and a 1px line. Controls have a 10px radius. Buttons are pills.
- Flat surfaces. The only shadow is below the two product cards that float on the hero figure.

## 5. Components

- **Button:** 44-52px high, pill. Primary: chalk fill, dark text. Secondary: 1px outline. Text link: underline, accent color in task screens.
- **Figure:** a live diagram of the real mechanism, four 14px crop corners, and a caption that starts with "Fig. n" in mono.
- **Lattice (Fig. 1):** a 3D lattice of announcements on a canvas. A sweep with your key (accent) finds three. A sweep by a quantum computer (soft) finds none.
- **Product card:** a small card with real product content (the payment link, two inbox rows). It floats on the hero figure. Do not show it below 1000px.
- **Step row:** circle, sentence, status. Waiting (outline), in progress, done (accent fill with a check).
- **Deck slide:** a label at the top left, the count at the top right, one sentence, one exhibit, one source line, and the dots below.

## 6. Do and do not

- Do show what the chain sees, with real values (1,570 bytes, ML-KEM-1024).
- Do say what stays public on the same screen as a privacy claim.
- Do give each animation a `prefers-reduced-motion: reduce` alternative that shows the final state.
- Do not use green monospace text, glitch effects, glass or a purple glow (anti-references in `PRODUCT.md`).
- Do not add decoration that explains nothing.
