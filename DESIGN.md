---
name: Bellaso
version: 0.2.0
source: seed (pre-implementation, 23 Nov 2026). Re-run `/impeccable document` when `apps/web` has tokens.
reference: a mathematician's blackboard, with the two-color technical drawings of the cover of "Ignition!" (Rutgers University Press Classics) redrawn in chalk. The user selected the dark chalkboard palette on 23 Nov 2026.
colors:
  board: "oklch(0.185 0.009 175)"
  board-raised: "oklch(0.205 0.010 175)"
  board-deep: "oklch(0.16 0.008 175)"
  chalk: "oklch(0.94 0.008 95)"
  chalk-muted: "oklch(0.76 0.01 95)"
  chalk-line: "oklch(0.94 0.008 95 / 0.18)"
  blue-chalk: "oklch(0.80 0.085 235)"
  blue-chalk-hover: "oklch(0.88 0.065 235)"
  blue-tint: "oklch(0.27 0.03 235)"
  orange-chalk: "oklch(0.80 0.12 62)"
  orange-tint: "oklch(0.28 0.035 62)"
  on-chalk: "oklch(0.18 0.01 175)"
  success: "oklch(0.80 0.10 160)"
  danger: "oklch(0.72 0.14 25)"
typography:
  display: "EB Garamond, 400/500, italic 400"
  ui: "IBM Plex Sans, 400/500/600"
  mono: "IBM Plex Mono, 400/500"
textures:
  chalk-dust: "fractal noise tile (feTurbulence), 16% over the board. The only texture."
radius: { control: "4px", panel: "2px", badge: "999px" }
motion:
  ui: "220ms cubic-bezier(0.22, 1, 0.36, 1)"
  state: "420-900ms cubic-bezier(0.16, 1, 0.3, 1)"
  draw: "1.1-2.6s cubic-bezier(0.65, 0, 0.35, 1)"
  ambient: "22-120s linear or ease-in-out (plate drift, cipher wheel, seal ring)"
---

# Design System: Bellaso

## 1. Overview

A clean blackboard in a research lab, set like a modern scientific paper. Large serif statements, generous empty board, and one live figure per screen that shows the real mechanism (Fig. 1: a lattice of announcements that a scan line opens). The look must feel like a genius at work, not like a hacker terminal, and not like a template.

Rejected on 23 Nov 2026 as "messy, AI slop": full equation plates behind text, eraser stripes, chalk annotations with arrows, a boxed hero panel, a rotating quote seal in the hero.

Product register: task screens are calm. The chalk drawings stay at low strength in the margins. The landing page uses the full board.

## 2. Colors

Strategy: **Restrained** on task screens (board, chalk, one blue chalk for actions). **Full palette** on the landing board only (white, blue and orange chalk).

### Primary
- **Blue chalk** `oklch(0.80 0.085 235)`: primary buttons, links, the selected state, subtitles. Dark text (`on-chalk`) on a blue chalk fill.

### Secondary
- **Orange chalk** `oklch(0.80 0.12 62)`: drawings, the byline, annotations, the "links your payments" warning. On the dark board, orange chalk is readable as text.

### Neutral
- **Board** `oklch(0.185 0.009 175)`: the page. A dark slate with a little green, like a real blackboard. Not pure black.
- **Board raised** `oklch(0.205 0.010 175)`: cards and tables, with a 1px chalk line at 18%.
- **Chalk** `oklch(0.94 0.008 95)` for text, **chalk muted** `oklch(0.76 0.01 95)` for secondary text.

### Named Rules
- **Chalk, not light.** No glow, no neon, no gradient light. Chalk is matte.
- **One blue per screen means "do this".** Only the primary action and the current selection are filled with blue chalk.
- **Write on the board, do not float over it.** Main text sits on the empty board. Use a card only for a real group of data or controls.
- **One figure per screen.** A figure has crop corners and a caption that starts with "Fig. n" in mono. Nothing is drawn behind text.

## 3. Typography

- **EB Garamond** for the wordmark, page titles, chalk equations and annotations. Never in labels, buttons or data.
- **IBM Plex Sans** for all UI. Tabular numbers for amounts.
- **IBM Plex Mono** for addresses, hashes, byte counts and the cipher table.

### Hierarchy
| Role | Font | Size / line height |
|---|---|---|
| Landing statement | EB Garamond 400, the key phrase in blue chalk italic | 80px / 1.02 |
| Pull quote | EB Garamond italic 400 | 64px / 1.05 |
| Page title | EB Garamond 400 | 44-48px / 1.05 |
| Section title | Plex Sans 600 | 16-18px / 1.3 |
| Body | Plex Sans 400 | 16-18px / 1.55 |
| Label | Plex Sans 500 | 13px / 1.3 |
| Data | Plex Mono 400 | 12-13px / 1.4 |

## 4. Elevation

Flat. Cards use a 1px chalk line. The only "depth" is chalk dust and the eraser marks. No drop shadows.

## 5. Components

- **Button:** 44-52px high, 4px radius. Primary: blue chalk fill, dark text. Secondary: a text link with a chalk underline and an arrow, or a 1px chalk outline. States: hover (lighter chalk and a 1px chalk ring), focus (2px blue chalk outline, 3px offset), disabled, loading (a hairline that moves).
- **Figure:** a live diagram of the real mechanism, four 14px crop corners in chalk at 45%, and a caption "Fig. n" (Plex Mono) plus one sentence.
- **Spec strip:** a row of label and mono value pairs between two chalk rules. Facts, not big numbers.
- **Step row:** circle, sentence, status. Waiting (outline), in progress (a turning dashed dial), done (filled blue chalk with a drawn check).
- **Seal:** a circle with ring text that turns slowly. Used for the quote on the landing page and for "Paid" on the receipt.
- **Announcement tape:** one tick for each announcement. The scan cursor (orange chalk) moves along it. Ticks that belong to the user turn blue chalk.
- **Callout:** a full 1px border and a tint. No side stripe.

## 6. Do's and Don'ts

- Do show what the chain sees, with real values (1,570 bytes, ML-KEM-1024).
- Do say what stays public on the same screen as a privacy claim.
- Do let motion show a state or the act of writing: a line that draws, an equation that is written, a scan that moves.
- Don't use green monospace text, glitch effects, glass, glow or neon (anti-references in `PRODUCT.md`).
- Don't put the main message in a box that floats over the board.
- Every animation has a `prefers-reduced-motion: reduce` alternative that shows the final state.
