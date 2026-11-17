# Motion: one beat, then stillness

A Line object moves once, to say its message, and then stays still. People
sit in front of an empty state; a loop would nag them. This file is how
you choose the beat, write it down, time it and build it.

## 1. The beat comes from the message

The motion is the verb of the state's sentence.

| Use | The sentence | What the object does | Examples |
| --- | --- | --- | --- |
| Empty | "There's nothing in here yet." | **opens or reveals, and shows nothing inside** | a flap tips open, a lid lifts, a door drops, a print slides off a stack |
| Blocked | "You can't do this." | **tries, and stops** | a shackle tugs and stays shut, a plug falls short of its socket, a knob slides partway back |
| Nothing found | "We looked, nothing matched." | **searches, then pauses** | a magnifier drifts left, right, settles in the middle |
| All clear / done | "You're up to date." | **settles, clicks in, rings once** | a bell rings smaller, a clip snaps shut, a check stamps down |
| Waiting | "It'll be here soon." | **turns over, runs, ends where it began** | an hourglass flips and the sand runs down |
| First step | "Start here." | **grows or lands** | a sprout grows, a pin drops on a map |
| Spot (feature card) | "This is what it does." | **does the feature once** | an arrow rises out of a cloud (upload), a card dips into a reader (pay) |

If two moves fit, pick the calmer one.

## 2. The moves you may use

Each has limits. They are there because breaking them looked wrong.

| Move | How | Limits |
| --- | --- | --- |
| **Slide** out of or along a housing | `offset` on a `Rig` from a track | A part leaving a housing is *cut* at the housing's face, never floated over it. Travel ≤ about half the part's length. |
| **Tip** about an edge | `rotate` about a pivot on that edge | Never past rest: a cone rocking left pivots on its left foot, rocking right on its right foot, each track ≥ 0. |
| **Swing** on a pivot (hanging things) | `rotate` about the hang point, each swing smaller | ≤ 6° for a hanging badge, ≤ 11° for a bell; followers lag 60–120 ms and swing wider. |
| **Hinge** a lid, flap or door | `rotate` about the hinge edge | The track starts at 0 and only overshoots at the *open* end. Never `toss` (it winds back below zero and drives the part through its housing). Flaps ≤ 25°, doors ≤ 100°. |
| **Drop / hop** with one bounce | `offset` z + squash `scale` | One bounce (≤ 25% of the drop). Squash keeps volume: height × s, width × 1/√s. |
| **Press** | `scale` z about the base (`press` preset) | ≤ 40% travel. Something must happen *because* of the press. |
| **Turn** in the front plane | `rotate` about the y axis (the front plane after `FRONT_POSE`) | Whole turns or half turns that land straight; a small overshoot ≤ 6°. |
| **Wave** across parts | the same track `shiftTrack`ed 60–120 ms per part | 3–5 parts; amplitude ≤ the part's own size. |
| **Grow / appear** | `scale` from 0 about the part's base | Never opacity. Grow from where it would really come from (the soil, the slot). |
| **Arc** (pop out and back) | two tracks per part, `x` and `z`, eased differently (§6) | Rises fast, drifts slower; stagger 60–80 ms; tilt ≤ 12°; back in faster than out, last out first in. Parts hide inside their housing at rest. |
| **Draw** a stroke | a clip or `scale` along the stroke | Only for thin marks (a check, a stem). |

Not allowed in this style: loops by default, camera turns, pointer
tilting, glow or pulses of light, fades, blur, colour changes (except a
brand-mark part popping in by scale), shadows that move.

## 3. Timing

| What | Value |
| --- | --- |
| Wait after the art is 40% in view | 400 ms (`TIMING.start`) |
| Wait after `active` turns true | 80 ms (`TIMING.again`) |
| The beat itself | 1.2–2.4 s, settle included |
| A follower's lag | 60–120 ms |
| A hold inside the beat (to show "empty") | 250–400 ms |
| Loop hold (only when `loop` is on) | ≈ 5 s |

Eases (from the engine, never invent numbers in an object):

| `EASE.` | Use for |
| --- | --- |
| `soft` | things springing up, popping in, a lid lifting |
| `drop` | landing softly from full speed, settling |
| `in` | falling, slamming, the last part of a drop |
| `easy` | every half swing of a sway or a settle |
| `snap` | moving from one slot to another |

Presets: `settle(to)` (the house spring: overshoot 1.42, swings halving,
≈ 900 ms), `hop`, `press`, `jolt`, `lift`. Read their tracks in
`engine/iso-core.tsx` before using one; most beats are better as your own
short track built from these eases.

## 4. Write the storyboard first

At the top of the object file, before any geometry:

```tsx
/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * "<Message>", told by one object in line: <object> that <beat>.
 * Use: <use>. Move: <move>. Each value is ms after it comes into view.
 *
 *    0ms   <rest pose>
 *  400ms   <first movement> (<duration>)
 *  …       <each movement, caused by the one before>
 * 1400ms   still: <resting pose, exactly as it started | the end state>
 *
 * Rest to rest, so one clip built twice: 400ms in view, 80ms when
 * `active` turns true.
 * Reduced motion, or `active` false before any play: <the resting pose>.
 * ───────────────────────────────────────────────────────── */

const TIMING = { again: 80, start: 400 };
```

Then build the clip as named tracks (`IsoTrack`: `[ms, value, ease]`
keys), sampled in pose functions:

```tsx
interface Clip { end: number; lift: IsoTrack }

const beat = (t0: number): Clip => {
  const up = t0 + 240;
  const lift: IsoKey[] = [
    [t0, 0, EASE.soft],
    [up, 1.2, EASE.in],
    [up + 200, 0],
  ];
  return { end: up + 200, lift };
};
const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

const partPose = (clip: Clip) => (ms: number): IsoPose => ({
  offset: [0, 0, r2(sample(clip.lift, ms))],
});

// in the JSX
<Rig pivot={BASE} {...onClock(clock, partPose(clip), clip.end)}>…</Rig>
```

`onClock` gives the rig the clock while it plays and holds the pose at
`clip.end` when it doesn't (reduced motion, `active` false before the
first play, server render).

## 5. Rest to rest, or one way

- **Rest to rest** (most beats): the object ends exactly as it started.
  One `beat(t0)` built twice, `INTRO` and `AGAIN`. The resting pose is
  both the first and last frame.
- **One way** (it grows, it opens and stays open): the resting pose is
  the *end* state, because that is what reduced motion and the server
  show. `INTRO` starts from the beginning state; `AGAIN` first undoes the
  beat quickly (≈ 200 ms, `EASE.in`) and then plays it again. Pose
  functions sample tracks whose last key is the end state.

## 6. Throwing parts on an arc

Things popping out of a container (pages out of a folder, cards out of a
box, coins out of a jar) look thrown when each one flies on an arc. You
don't draw an arc path: give the part **two tracks**, across (`x`) and
up (`z`), with **different eases**. The rise is fast and lands softly
(`EASE.soft`, overshooting a little then `EASE.easy` down to its height);
the drift across is slower (`EASE.drop` over a longer time). Because the
two finish at different moments, the point traces a curve.

```tsx
// SHEETS: where each one rests (x) and where it flies to ([x, z]), tilt.
const SHEETS = [
  { tilt: -12, to: [-3, 3], x: -1.5 },
  { tilt: 0, to: [0, 4.25], x: 0 },
  { tilt: 12, to: [3, 3.5], x: 1.5 },
] as const;
const OUT = { rise: 260, settle: 160, stagger: 70 };
const BACK_IN = { ms: 180, stagger: 40 };

const sheets = SHEETS.map(({ tilt, to: [tx, tz], x }, i) => {
  const go = out + OUT.stagger * i;                              // one after another
  const back = home + BACK_IN.stagger * (SHEETS.length - 1 - i); // last out, first in
  const peak = go + OUT.rise;
  return {
    // up: fast, a little past, then down to its height; hold; swiftly back
    z: [[go, 0, EASE.soft], [peak, tz + 0.5, EASE.easy], [peak + OUT.settle, tz, "hold"],
        [back, tz, EASE.in], [back + BACK_IN.ms, 0]],
    // across: slower, so the path curves
    x: [[go, 0, EASE.drop], [peak + OUT.settle, tx - x, "hold"],
        [back, tx - x, EASE.in], [back + BACK_IN.ms, 0]],
    // a small tilt in flight, straight again at rest
    tilt: [[go, 0, EASE.soft], [peak, tilt, "hold"],
           [back, tilt, EASE.in], [back + BACK_IN.ms, 0]],
  };
});

// pose: offset [x, 0, z] and an in-plane turn (axis "y" after FRONT_POSE)
const sheetPose = (clip: Clip, i: number) => (ms: number): IsoPose => ({
  axis: "y",
  offset: [r2(sample(clip.sheets[i].x, ms)), 0, r2(sample(clip.sheets[i].z, ms))],
  rotate: r2(sample(clip.sheets[i].tilt, ms)),
});
```

Rules that came from building it (`examples/folder.tsx`):
- **Hidden at rest means hidden even when the housing is open.** Parts
  behind a face show depth/√3 higher than their height, and an opened
  flap drops. Sit them low enough that their tops never peek over the
  open flap, or they read as a row of boxes once they're back in.
- **Paint order does the hiding:** the back panel, then the parts, then
  the flap. The parts are faces on one plane in the gap between them.
- **Keep the arcs inside the art's air.** The highest one may rise a
  little past the frame (the padding isn't clipped), not far above it.
- **Don't fly over the brand mark.** Pick destinations that leave it
  visible the whole time.
- **Out on a curve, back in a line.** Coming back is `EASE.in` on both
  tracks together, faster than going out: they're pulled home.
- **The container waits for them.** The flap stays open until the last
  part is in, then shuts.

## 7. Make it feel caused

- **Something lags.** A follower (a clapper, a second leaf, a flag)
  moves 60–120 ms after its leader and a little further.
- **Anticipation is small.** A 5–8% crouch before a hop; a 2–3° wind-up
  before a turn. Never a wind-up that drives a part through its housing.
- **The landing shows.** When something lands, what it lands on reacts
  (a spot widens, a base squashes).
- **Settle, then stop dead.** The last swing is ≤ 1° or ≤ 0.02 units, and
  the final key is exactly the rest value (the checker compares pixels).
- **Round poses** with `r2()` so the rig doesn't re-render on float noise.
