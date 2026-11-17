---
name: isometrics
description: Draw and animate outline-style ("Line") isometric objects in React + SVG for empty states, blocked states and spot illustrations, with exact isometric math, a 1 px outline, one brand mark and one beat of motion, verified by rendering and screenshots. Use when the user asks for an isometric illustration, an isometric icon or object, an empty-state or blocked-state illustration, "isometrics" of a topic (e.g. "gallery isometrics", "an isometric inbox"), or a line/outline isometric drawing with motion.
---

# Isometrics (Line style)

You turn a short brief ("gallery isometrics", "an empty inbox state") into
one drawn, animated object that ships as a complete state: the
illustration, a heading, a line of copy and a button. Every object is
built from 3D primitives in world units and projected in true isometric,
so it shares one grid, one outline and one look with every other object
made with this skill.

The look, in one line: **one object, facing the screen, a 1 px outline over
paper-white faces, one small brand-coloured mark, no shadow, no glow, one
beat of motion and then stillness.**

You do not skip stages. You do not call an object done until the checker
passes and you have looked at its sheet.

## Contents

| File | Read it |
| --- | --- |
| `SKILL.md` | always: the workflow and the rules |
| `references/brief-to-concept.md` | stage 1–2: turning a vague brief into three concepts |
| `references/motion.md` | stage 4: choosing and timing the beat |
| `references/line-style.md` | stage 3–5: every drawing rule, do and don't, with the reason |
| `references/engine-api.md` | while building: the engine and the Line kit |
| `references/isometric-math.md` | when a shape needs math the engine doesn't have |
| `examples/*.tsx` | before building: start from the closest one |
| `engine/iso-core.tsx`, `engine/iso-line.tsx` | copied into the user's project once |
| `scripts/check.mjs` | stage 5: the strict render check |

## Setup (once per project)

The objects are React client components for a project with Tailwind CSS
and shadcn/ui (they use `@/lib/utils` `cn` and `@/components/ui/button`)
and the `motion` package.

1. Check for `components/isometrics/iso-core.tsx`. If it is missing, copy
   `engine/iso-core.tsx` and `engine/iso-line.tsx` from this skill into
   `components/isometrics/` (or the folder the user prefers; objects import
   them relatively, so they all live in one folder).
2. If the project has no `motion`: install it (`npm i motion`, or the
   project's package manager). If it has no shadcn Button:
   `npx shadcn@latest add button`.
3. For the checker, Playwright: `npm i -D playwright` and
   `npx playwright install chromium` (or it uses an installed Chrome).
4. A page to render one object alone, e.g.
   `app/isometrics-preview/<name>/page.tsx` in Next.js, or a route in the
   project's own router. Create it per object; tell the user it is a
   preview page they can delete.

Never edit the engine to make one object work. If a shape is truly
missing, add a helper inside the object's own file, built from 3D, and
tell the user.

## The workflow

### Stage 1 · Read the brief

Turn the request into three answers before anything else:

- **Subject:** the thing or topic ("gallery" → photos, albums, images).
- **Use:** which state it serves: *empty* (nothing here yet), *blocked*
  (no access, off, not connected, not found), *nothing found* (search,
  filters), *success / all clear*, or a *spot* illustration in a feature
  card.
- **Message:** one plain sentence the state says ("You have no photos yet").

If the use isn't stated, the brief usually fits more than one; that is
what the concepts are for. See `references/brief-to-concept.md`.

### Stage 2 · Three concepts, then wait

Unless the brief already names one object and one state, show the user
**three concepts** as a table and **stop and wait for their pick**:

| | Object | Message (heading) | The one beat |
|---|---|---|---|
| A ★ | … | … | … |
| B | … | … | … |
| C | … | … | … |

Each concept must pass all four tests:

1. **Reads in outline at 120 px.** A silhouette people know without colour.
2. **Rounded beats boxy.** Rounded objects read friendlier in line; a plain
   box reads as a parcel or a wireframe.
3. **One object.** Not a scene, not a pile. A second small part is fine
   only if it belongs to the object (a lid, a flag, a hand).
4. **The beat says the message.** The motion is the verb of the sentence
   (see `references/motion.md`). If you can't name the beat, it's the
   wrong object.

Mark your recommendation with ★ and say why in one line. Vary the three:
different objects, different beats. When the brief is specific ("an empty
inbox state with a tray"), skip the table, state your choice and the beat,
and go on.

### Stage 3 · Break the object into parts

Write a parts table in world units before code: each part, the primitive
it is built from (`Extrude`, `Slice`, `Ring`, `FacePath`, `Box`…), its
size and position on the 0.5 grid, whether it moves, and which one part is
the brand mark. Then the copy: heading (≤ 28 characters), one or two
sentences, button label (≤ 22 characters) and its icon (the icon follows
the verb: a plus only where the action adds).

Rules that decide parts (all in `references/line-style.md`):
- Build facing +y about x = 0, standing on z = 0. The Line kit turns it
  to face the screen.
- Flat things (paper, labels, screens) are faces, not solids.
- Round solids are slices between level circles, painted from the foot up.
- An outline that isn't convex needs its far edge drawn.
- A part that slides out of a housing is cut at the housing, not floated.
- One brand mark (palette `main`); everything else is paper (`surface`).

### Stage 4 · Choose and write the beat

Pick the move from the message (`references/motion.md`), then write the
storyboard comment at the top of the file **before** the drawing code:
times, what moves, how far, why. Every value in a named constant. The
beat waits 400 ms after the art scrolls into view, lasts 1.2–2.4 s, plays
once, and a click replays it (80 ms delay). Reduced motion shows the
resting pose.

### Stage 5 · Build, render, check, look, fix

1. **Start from the closest example** in `examples/` (table below). Keep
   its structure: storyboard, TIMING, geometry, tracks, poses, pieces,
   `LineState`.
2. **Render it** on its preview page and **run the checker**:

   ```bash
   node <skill>/scripts/check.mjs http://localhost:3000/<preview-path>/<name> --duration <wait+beat ms>
   ```

   It renders light and dark, replays the beat on a fake clock, saves
   frames at 0, 25, 50, 75, 100 % and after, and checks:
   - no hydration or console errors, in light, dark and reduced motion;
   - the click replays it and the beat moves;
   - the beat settles exactly back to its resting pose;
   - reduced motion is still, shows the resting pose, offers no replay;
   - every outline is about 1 px; no filters, glow, shadows or gradient
     paint;
   - the resting drawing fits its frame;
   - the drawing is centred on the heading within 2 px;
   - its optical size matches the set (√(w×h) 140–175 px).
3. **Look at `sheet.png`** (open the image) and go through the checklist
   below. The checker cannot see design; you can.
4. **Fix and run again.** At most three rounds. If something still falls
   short after three, stop and tell the user exactly what, with the sheet.
5. **Report**: the concept, the storyboard, the checker result, what you
   fixed after looking, what still falls short, and the sheet's path.

## Look at the sheet: the checklist

**Reads**
- [ ] Without the heading, would a stranger name the object at the size of
      a thumbnail?
- [ ] Nothing reads as a face by accident (two round parts over a curve).
- [ ] The brand mark is one small part, and it is the part the eye should
      land on.

**Rests straight**
- [ ] At rest every upright is vertical and every edge level; nothing
      leans, nothing hangs askew, second sheets are offset, not turned.
- [ ] The resting pose equals the reduced-motion pose (the checker
      compares pixels; you check it looks *intended*).

**Lines**
- [ ] One outline weight everywhere; no doubled edges, no hairline seams
      between fills, no missing far edges on curved outlines, no fill
      poking past an outline.
- [ ] The top strip (thickness seen from 30° above) is there on solids
      and absent on thin faces.

**Motion**
- [ ] The beat says the message; each movement is caused by the one before
      (a lag, a follow-through, a settle).
- [ ] Hinged parts never swing through their housing; tips never cross
      rest; swings stay small (≤ 6° on a hanging part, ≤ 25° on a flap).
- [ ] Nothing fades in or out; things that appear grow with scale.

**Fits the page**
- [ ] Centred on the copy; the frame isn't padded with dead space.
- [ ] Looks right in dark: paper faces become dark paper, the brand mark
      stays the brand.

## Non-negotiable rules

1. **True isometric only.** Axes at 30° to horizontal, 120° apart, equal
   scale. Never the 2:1 "game" projection (26.565°).
2. **Geometry first.** Place primitives in world units. Never write a
   projected screen path by hand.
3. **One grid.** Positions and sizes on 0.5 world units; face details on
   0.25.
4. **One look.** `variant="ink"` (default) or `"line"`; never mix looks in
   one object. 1 px outline, paper walls, no shadow, no glow, no gradient.
5. **Theme from tokens.** Colours come only from the user's shadcn theme
   through the `--iso-*` variables. No hex, no oklch in an object file.
   The brand mark follows `tone` (default `primary`).
6. **Props, not forks.** Copy, tone, variant, stroke width, motion
   switches are props with doc comments (`LineStateProps`). Never name a
   content prop `title`: it is the accessible name.
7. **Accessible.** The art is decorative unless `title` is given; the
   replay is a real `<button>` with a label; reduced motion is respected
   without a hydration error (`useReduced`, never motion's
   `useReducedMotion` in the first render).
8. **One beat, then still.** No idle loops by default (`loop` is opt-in);
   people sit in front of an empty state.

## Examples

All ten are complete and pass the checker. Start from the one whose
technique is closest to what you need.

| File | State | Technique worth copying |
| --- | --- | --- |
| `map-pin.tsx` | no locations | drop with one bounce; squash and stretch that keeps volume; a level `Ring` that reacts |
| `folder.tsx` | no files | a hinged flap that opens and shuts without crossing its housing |
| `gift-box.tsx` | no rewards | a lid that lifts, peeks and drops back with one bounce |
| `mailbox.tsx` | no mail | a rounded-top body; a door dropping open about its bottom hinge |
| `toggle-switch.tsx` | blocked: feature off | "tries and stops": a knob that slides partway and returns |
| `cloud-upload.tsx` | nothing uploaded | a non-convex outline with its far edge; a part rising out of another |
| `chat-bubble.tsx` | no messages | a staggered wave across three parts |
| `hourglass.tsx` | nothing yet | a half turn in the front plane, then a flow that ends where it began |
| `stopwatch.tsx` | no time tracked | a press that causes a sweep; a hand on a dial |
| `sprout-pot.tsx` | no projects | a one-way beat (grows) with an `again` clip that undoes it first; round slices |

## Updating this skill

When the user corrects a drawing or a beat, add the rule to
`references/line-style.md` (or `motion.md`) with the reason, in the
user's words where possible. Rules here are scar tissue; keep them.
