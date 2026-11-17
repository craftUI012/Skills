"use client";

import { EASE, Extrude, FacePath, Rig, sample } from "./iso-core";
import type { IsoKey, IsoPose, IsoTrack, Vec3 } from "./iso-core";
import {
  LINE,
  LineState,
  Slice,
  disc,
  faceFill,
  facing,
  onClock,
  r2,
  useLineShell,
} from "./iso-line";
import type { LineStateProps } from "./iso-line";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * "No time tracked", told by one object in line: a stopwatch whose crown
 * is pressed and whose hand runs once round. Use: empty state. Move: a
 * press, then a full turn of the hand. Each value is ms after the art
 * comes into view.
 *
 *    0ms   the stopwatch stands still, its hand at 12
 *  400ms   the crown is pressed 0.375 units down its stem (120ms)
 *  520ms   it clicks: the hand sets off clockwise from 12, fast, slowing
 *          as it comes round (1000ms); the crown springs back up (300ms)
 * 1520ms   the hand runs 6° past 12, swings back 1.5° short, and settles
 *          on 12 (300ms)
 * 1820ms   still: the hand at 12, exactly as it started
 *
 * Rest to rest, so one clip built twice: 400ms wait in view, 80ms on click.
 * Reduced motion (or autoPlay off): the stopwatch still, the hand at 12.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  again: 80,
  start: 400,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// Built facing +y about x = 0; the front face is the plane y = 0.

// The case: a disc standing on its edge, R round and DEPTH deep.
const CASE = { depth: 1, r: 3 };
const CENTRE: Vec3 = [0, 0, CASE.r];
const TOP = CASE.r * 2;
// The crown stands on the case's top edge, in the middle of its depth.
const AXIS_Y = -CASE.depth / 2;

// The dial on the face, a shade lighter than the case's rim.
const DIAL = { r: 2.5 };

// Twelve ticks; the four quarters are longer.
const TICK = { inner: 2, major: 1.75, outer: 2.25 };
const TICKS = Array.from({ length: 12 }, (_, i) => {
  const a = (i * Math.PI) / 6;
  const from = i % 3 === 0 ? TICK.major : TICK.inner;
  const s = Math.sin(a);
  const c = Math.cos(a);
  return `M${r2(from * s)} ${r2(-from * c)} L${r2(TICK.outer * s)} ${r2(-TICK.outer * c)}`;
}).join(" ");

// The hand: a slim needle from a short tail through the centre to short
// of the ticks, and the hub it turns on. Face units, centre at 0,0.
const HAND = { hub: 0.25, tail: 0.5, tip: 1.5, w: 0.125 };
const HAND_PATH = [
  `M0 ${-HAND.tip}`,
  `L${HAND.w} 0`,
  `L0 ${HAND.tail}`,
  `L${-HAND.w} 0`,
  "Z",
].join(" ");

// The crown: a ring on the case, a stem, and a button with a seam round it.
const RING = { h: 0.25, r: 0.5 };
const STEM = { h: 0.75, r: 0.25 };
const BUTTON = { h: 0.5, r: 0.5, seam: 0.25 };
const BUTTON_Z = TOP + STEM.h;
// How far the button goes down its stem.
const PRESS = 0.375;

// The frame fits the stopwatch at rest, from its foot to the button.
const EXTENT: Vec3[] = [
  [-CASE.r, 0, 0],
  [CASE.r, 0, 0],
  [-CASE.r, -CASE.depth, TOP],
  [CASE.r, -CASE.depth, TOP],
  [0, AXIS_Y - BUTTON.r, BUTTON_Z + BUTTON.h],
];
const BOUNDS = EXTENT.map(facing);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

interface Clip {
  end: number;
  /** The button's travel along its stem, world units (negative is down). */
  crown: IsoTrack;
  /** The hand's turn, degrees clockwise from 12. */
  hand: IsoTrack;
}

const beat = (t0: number): Clip => {
  const click = t0 + 120;
  const round = click + 1000;
  const crown: IsoKey[] = [
    [t0, 0, EASE.in],
    [click, -PRESS, EASE.soft],
    [click + 200, 0.03, EASE.easy],
    [click + 300, 0],
  ];
  const hand: IsoKey[] = [
    [click, 0, EASE.drop],
    [round, 366, EASE.easy],
    [round + 150, 358.5, EASE.easy],
    [round + 300, 360],
  ];
  return { crown, end: round + 300, hand };
};

const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

const crownPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    offset: [0, 0, r2(sample(clip.crown, ms))],
  });

const handPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    axis: "y",
    // A whole turn lands where it started: hold it as 0, not 360.
    rotate: r2(sample(clip.hand, ms) % 360),
  });

/* ───────────────────────────── Pieces ─────────────────────────────────── */

/** A round part on the crown's axis, between two heights. */
const Round = ({ from, to, r }: { from: number; to: number; r: number }) => (
  <Slice bottom={[[0, AXIS_Y, from], r]} top={[[0, AXIS_Y, to], r]} />
);

/** The case, its dial and ticks, and the hand turning on the face. */
const Case = ({ hand }: { hand: ReturnType<typeof onClock> }) => (
  <Extrude
    at={[-CASE.r, 0, TOP]}
    convex
    d={disc(CASE.r)}
    depth={CASE.depth}
    palette="surface"
    plane="left"
  >
    <FacePath
      at={[-DIAL.r, 0, CASE.r + DIAL.r]}
      d={disc(DIAL.r)}
      plane="left"
      style={faceFill("surface", "top")}
    />
    <FacePath at={CENTRE} d={TICKS} plane="left" style={LINE} />
    <Rig pivot={CENTRE} {...hand}>
      <FacePath
        at={CENTRE}
        d={HAND_PATH}
        plane="left"
        style={faceFill("main", "left")}
      />
    </Rig>
    <FacePath
      at={[-HAND.hub, 0, CASE.r + HAND.hub]}
      d={disc(HAND.hub)}
      plane="left"
      style={faceFill("main", "left")}
    />
  </Extrude>
);

/** The crown: the ring and stem stay, the button rides its track. */
const Crown = ({ button }: { button: ReturnType<typeof onClock> }) => (
  <>
    <Round from={TOP} r={RING.r} to={TOP + RING.h} />
    <Round from={TOP} r={STEM.r} to={BUTTON_Z} />
    <Rig pivot={[0, AXIS_Y, BUTTON_Z]} {...button}>
      <Round from={BUTTON_Z} r={BUTTON.r} to={BUTTON_Z + BUTTON.seam} />
      <Round
        from={BUTTON_Z + BUTTON.seam}
        r={BUTTON.r}
        to={BUTTON_Z + BUTTON.h}
      />
    </Rig>
  </>
);

/* ───────────────────────────── Scene ──────────────────────────────────── */

// A play triangle, for the verb "start".
const PLAY = "M8 5.5v13l10.5-6.5z";

export type StopwatchProps = LineStateProps;

/**
 * Stopwatch: a complete "no time tracked" state with a line illustration,
 * a heading, a line of copy and a button. Its crown is pressed and the
 * hand runs once round the dial, landing back on 12. One fine outline,
 * paper faces, the hand the one brand mark, facing the screen, no shadow.
 * Click the stopwatch to play it again. Follows the shadcn theme.
 */
export const Stopwatch = ({
  heading = "No time tracked",
  description = "Start a timer and your hours will show up here.",
  actionLabel = "Start timer",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  autoPlay = true,
  loop = false,
  replayOnClick = true,
  ...rest
}: StopwatchProps) => {
  const shell = useLineShell({
    again: AGAIN,
    autoPlay,
    intro: INTRO,
    loop,
    replayOnClick,
  });
  const { clip, clock } = shell;
  return (
    <LineState
      bounds={BOUNDS}
      icon={PLAY}
      props={{
        actionLabel,
        description,
        heading,
        strokeWidth,
        tone,
        variant,
        ...rest,
      }}
      shell={shell}
      defaultArtClassName="w-44"
      slot="stopwatch"
    >
      <Case hand={onClock(clock, handPose(clip), clip.end)} />
      <Crown button={onClock(clock, crownPose(clip), clip.end)} />
    </LineState>
  );
};

export default Stopwatch;
