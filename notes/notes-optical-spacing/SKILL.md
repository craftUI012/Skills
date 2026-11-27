---
name: notes-optical-spacing
description: Set padding so the space people see matches the space you meant, by measuring to the ink (the letters and the drawn lines of icons) instead of to boxes. Covers button icon padding (a button with text and an icon looks wider on the icon side, so give the text side about 2px extra) and card text trim (a card's padding looks bigger than it is because lines of text carry air above their capitals and below their baseline, so trim it with text-box). Use when building or reviewing buttons with a leading or trailing icon, pills, chips, cards, list rows, banners or any padded box with text at its edges; when padding "looks uneven", "looks off", "looks bigger at the top" or "the icon side looks wider"; or when the user asks about optical spacing, optical padding, text-box, text-box-trim, leading trim or cap height.
---

# Optical spacing

**Principle:** pad the ink, not the box. Padding is measured from boxes:
the icon's 24-unit box, the line box of a piece of text. The eye measures
from the ink. When a box has air inside it, the padding you see is the
padding you set plus that air, and it's rarely the same on both sides.

Each topic is a folder next to this file with the full note (`README.md`),
a before/after picture and an example page. Read the topic's README before
changing code: it has the steps, the numbers and the limits.

## Topics

| Topic | Rule | Read |
| --- | --- | --- |
| Button icon padding | An icon's box has air inside it, so with equal padding the icon side looks wider. Give the text side about 2px extra; keep the icon side. | `button-icon-padding/README.md` |
| Card text trim | Lines of text carry air above their capitals and below their baseline, so a card's padding looks bigger than it is, and uneven. Trim it with `text-box: trim-both cap alphabetic`. | `card-text-trim/README.md` |

## In short

```css
/* Button with a trailing icon: the text side gets the extra. */
.button { padding-inline: 18px 16px; }      /* was 16px 16px */
/* Leading icon: mirrored. */
.button--icon-start { padding-inline: 16px 18px; }

/* Card: trim the first line's top and the last line's bottom. */
.card {
  padding: 24px;
  text-box: trim-both cap alphabetic;
}
```

## Check it

`ink-gaps.mjs` measures each element's gaps to the ink on both sides and
compares them:

```bash
node <this skill's folder>/ink-gaps.mjs <url> --select "button"            # left / right
node <this skill's folder>/ink-gaps.mjs <url> --select ".card" --axis y    # top / bottom
```

Add `--shot gaps.png` for a picture with each side shaded to the ink. It
exits 1 when two sides differ by more than 0.5px. For `--axis y` it also
says how much line air sits over the padding. It needs Playwright and
Chromium (`npm i -D playwright`, `npx playwright install chromium`, or
`CHROMIUM_PATH=/path/to/chrome`).

## Steps

1. Run `ink-gaps.mjs` on the elements in question. Don't fix by eye first;
   the numbers say which side is short and by how much.
2. Buttons: add the difference to the text side (round to whole or half
   px). Cards: add `text-box: trim-both cap alphabetic`, keep the inside
   in block flow (see the card note), then re-check.
3. Re-run until it passes, and leave a comment beside the padding saying
   it's optical, so nobody "fixes" it back to equal.

## Adding a topic

A folder `<topic>/` next to this file with `README.md` (rule, why, the
fix, steps, numbers, how to check, when not to) plus its media and an
example page, a row in the table above, and the topic's trigger words in
this file's `description`.
