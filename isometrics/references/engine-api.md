# Engine and Line kit: the API you build with

Two files, copied into the user's project once (`components/isometrics/`):

- `iso-core.tsx`: the engine. True isometric projection, 3D primitives,
  rigs, the clock, tracks and eases, the stage and its theme variables.
- `iso-line.tsx`: the Line kit. Everything Line objects share: the front
  view, the outline, round solids, the reduced-motion read, the clock
  shell and the complete state component.

## World

- Axes: **x** runs right-down, **y** left-down, **z** up. One world unit is
  1.25 canvas units (`ISO_S`).
- `project([x, y, z])` → canvas `[sx, sy]`:
  `sx = S·(x − y)·cos 30°`, `sy = S·((x + y)/2 − z)`.
- Build Line objects facing **+y** (their front face is the plane y = 0,
  depth goes to negative y), centred on x = 0, standing on z = 0.

## Faces and planes

A face plane maps 2D face coordinates (u right, v down) to the world:

| `plane` | The face | u runs along | v runs along |
| --- | --- | --- | --- |
| `"left"` | the +y face (the **front** of a Line object) | +x | −z |
| `"right"` | the +x face (edge-on in the front view) | −y | −z |
| `"top"` | the +z face | +x | +y |

`at` is the world point where u = v = 0 (for a front face: its top-left
corner, `[left x, front y, top z]`).

## Primitives (iso-core)

| Primitive | Props | Use for |
| --- | --- | --- |
| `Extrude` | `plane`, `at`, `d` (face path: absolute M L H V C Q Z, no arcs), `depth`, `palette`, `convex`, `fillRule`, children | any outline given thickness: the body of almost every Line object. Children draw on its front face. |
| `FacePath` | `plane`, `at`, `d`, `style` | a flat shape or mark on a plane: paper, labels, details, a back outline for the far-edge recipe |
| `Face` | `plane`, `at`, children | fill-only 2D content in a plane |
| `FaceEllipse` | `plane`, `center`, `r` | an exact circle on a face |
| `Box` | `at`, `size [w,d,h]`, `palette` | a real box (edges along the axes) |
| `Slab`, `Panel` | see the file | rounded slabs lying flat / panels standing up |
| `roundedRect(w, h, r, x?, y?)` | | a rounded-rectangle face path |
| `mapPath(plane, at, d)` | | the projection behind `FacePath` |

Palettes: `"surface"` (paper: use for everything) and `"main"` (the brand
mark: use once). `"accent"` exists; Line objects don't use it.

## Rigs, clock, tracks (iso-core)

| API | What it is |
| --- | --- |
| `<Rig pivot rotate axis scale offset clock pose>` | Poses its children as one solid: `p' = pivot + R·S·(p − pivot) + offset`, in world units before projection. Rigs nest. With `clock` + `pose(ms)` it samples the pose every frame and re-renders only on change. |
| `IsoPose` | `{ rotate?: deg, axis?: "x"\|"y"\|"z", scale?: number \| [sx, sy, sz], offset?: [x, y, z] }` |
| `useRigged()` | where a world point lands after the rigs around it (for paths you project yourself) |
| `useClock(running, restart)` | ms since it started, as a motion value (the kit's `useLineShell` owns it) |
| `IsoTrack`, `sample(track, ms)` | keys `[ms, value, ease?]`, ease = `EASE.*`, `"hold"`, or linear; held before the first and after the last key |
| `EASE` | `soft`, `drop`, `in`, `easy`, `snap` (see motion.md) |
| `settle`, `hop`, `press`, `jolt`, `lift`, `toss` | preset tracks (read them before use; never `toss` a hinged part) |
| `shiftTrack(track, ms)`, `scaleTrack(track, k)` | followers |

Rotation axes after `FRONT_POSE`: **y** turns in the front plane (a dial
hand, a swing, an hourglass flip), **x** tips toward or away from the
viewer (a flap, a door, a lid), **z** turns about the vertical.

## The Line kit (iso-line)

| API | What it is |
| --- | --- |
| `FRONT_POSE`, `FRONT`, `facing(p)` | the front view; `facing` maps bound points |
| `LINE` | the one outline style for strokes you draw yourself |
| `faceFill(palette, face)` | a filled face in a palette shade with the outline |
| `Edge({ points })` | a straight 3D edge through the rigs around it |
| `ring(center, r, n?)` | world points round a level circle |
| `Ring({ center, r, palette?, style? })` | a level circle (filled top shade, or outline only) |
| `Slice({ bottom: [c, r], top: [c, r], palette?, open? })` | a round solid between two level circles; `open` fills the top as a mouth |
| `disc(r)` | a circle as a face path (box corner at 0, 0) |
| `circle(cx, cy, r)` | a circle as a face path, centred |
| `FarEdge({ at, depth, chain, joins })` | the far edge of a straight-on non-convex extrusion (line-style.md) |
| `r2(n)` | round to 2 decimals (for poses and paths) |
| `useReduced()` | reduced motion, hydration-safe |
| `useLineShell({ active, onPlayEnd, loop, intro, again, hold? })` | the clock and the clips: `active` left out plays `intro` once in view; passed, plays `again` each time it turns true (a start during a beat waits for it to settle); returns `{ clip, clock, ref }` |
| `onClock(clock, pose, rest)` | rig props: animated, or held at `rest` |
| `lineStageStyle(variant)` | the stage overrides (the kit applies it) |
| `LineState({ slot, bounds, shell, props, icon?, buttonVariant?, defaultArtClassName?, stageClassName?, children })` | the complete state: stage, `FRONT_POSE` rig, heading, copy, action (no button in the art) |
| `PlayOnHover({ children })` | passes `active` to its one child on hover, focus and touch |
| `LineStateProps` | the props every object takes |
| `ICON` | button icon paths: `plus`, `upload`, `arrowLeft`, `refresh` |

## The shape of an object file

```tsx
"use client";

import { EASE, Extrude, Rig, sample } from "./iso-core";
import type { IsoKey, IsoPose, IsoTrack, Vec3 } from "./iso-core";
import { ICON, LineState, facing, onClock, r2, useLineShell } from "./iso-line";
import type { LineStateProps } from "./iso-line";

/* storyboard comment (motion.md §4) */
const TIMING = { again: 80, start: 400 };

/* geometry in world units, on the 0.5 grid */
const BODY = { depth: 0.6, h: 4, w: 4 };
const EXTENT: Vec3[] = [/* resting extremes */];
const BOUNDS = EXTENT.map(facing);

/* tracks: interface Clip, beat(t0), INTRO, AGAIN, pose functions */

/* pieces: small components, one per part */

export type ThingProps = LineStateProps;

/** Doc comment: what state, what object, what beat. */
export const Thing = ({
  heading = "…",
  description = "…",
  actionLabel = "…",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: ThingProps) => {
  const shell = useLineShell({ active, again: AGAIN, intro: INTRO, loop, onPlayEnd });
  const { clip, clock } = shell;
  return (
    <LineState
      bounds={BOUNDS}
      icon={ICON.plus}
      props={{ actionLabel, description, heading, strokeWidth, tone, variant, ...rest }}
      shell={shell}
      slot="thing"
    >
      {/* parts, back to front, lowest first */}
    </LineState>
  );
};

export default Thing;
```

Usage in a page:

```tsx
import { MapPin } from "@/components/isometrics/map-pin";

<MapPin heading="No stores yet" actionLabel="Add a store" onAction={open} />
```
