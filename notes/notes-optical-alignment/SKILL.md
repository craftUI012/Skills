---
name: notes-optical-alignment
description: Optically centre an icon or glyph in its box (button, badge, avatar, play button, icon tile) by where its shape weighs, not by its bounding box, and say exactly how many pixels to nudge it. Use when an icon looks off-centre even though the padding is equal, when centring a play triangle, a pencil/edit icon, a bin or any lopsided glyph, when the user asks for optical alignment or optical centring, or when sizing a set of icons so they read the same size.
---

# Optical alignment

**Rule:** centre an icon by where its shape weighs, not by its box.

Equal padding centres the box an icon is drawn in; the eye centres the
shape. A lopsided icon (a play triangle, a pencil poking out of a square, a
bin with a wide lid) looks off in a perfectly centred box. Measure where
the shape weighs and move the icon by the difference, rounded to a step the
screen can show.

`README.md` next to this file has the full note: the calibration table, the
calibration sheet and a worked example. Read it when you need to justify a
number or change `α`.

## Steps

1. **Collect the inputs** for each icon: its SVG (viewBox `V`, paths, stroke
   width), the size it is drawn at `s`, the box it sits in `B` (the button
   or tile, inside its border), and `step` = 0.25px (visible on 2× screens).
2. **Measure, don't guess.** Run the script on the real SVGs:

   ```bash
   node <this skill's folder>/optical-center.mjs icon.svg other.svg --size 14 --box 28 --alpha 0.7
   ```

   It needs Playwright and Chromium (`npm i -D playwright`,
   `npx playwright install chromium`, or `CHROMIUM_PATH=/path/to/chrome`).
   Per icon it prints `box`, `mass`, `area`, `eye`, `nudge`, `padding` and
   `scale` (with `--area-ref`). If an icon comes from a React icon library,
   render or export it to an `.svg` file first.
3. **Apply the nudge** in the project's own way, one of:
   - padding: `left = p + nudge.x`, `right = p − nudge.x`,
     `top = p + nudge.y`, `bottom = p − nudge.y`, with `p = (B − s) / 2`
   - `translate: nudge.x nudge.y` on the icon (same result, keeps layout)

   Put the reason in a comment beside it (measured mass, α, the nudge), so
   nobody "fixes" it back to the box centre.
4. **Look at it.** Screenshot before and after at 2× and compare. If the
   eye disagrees, move `α` (0.5 weaker … 1 stronger), not the pixels by hand.

## The formula (what the script does)

```
silhouette  every shape filled, strokes kept, drawn at 480px; opacity = weight w
Cb          centre of the drawn ink's bounds            (viewBox units)
Cm          Σ w·(x, y) / Σ w                             (centre of mass)
C_eye       α·Cm + (1 − α)·Cb                            α = 0.7 by default
Δ           (C_eye − V/2) · s / V                        (px at the drawn size)
nudge       −round(Δ / step) · step
s_opt       s · √(A_ref / A)                             (optional: even optical size for a set)
```

`α = 0.7` comes from how icon systems place their own play triangles
(Material 0.82, Tabler 0.68, Lucide 0.50; mean 0.67). Small icons (≤ 16px)
often read better nearer `α = 1`; start from 0.7 at larger sizes.

## Limits

- It weighs shape in two dimensions only. Direction (an arrow that points, a
  chevron) can pull the eye further than its mass; check those by eye.
- Filling an open path closes it with a straight chord, so for very open
  shapes (a lone hook, a bracket) the mass is approximate.
- Sub-quarter-pixel nudges are noise: round to `step` and leave 0 as 0.
- Don't nudge symmetric icons (a circle, a plus): their mass is their box
  centre, and the script will say 0, 0.
