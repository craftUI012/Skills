# The Line style: every rule, with its reason

Each rule here came from a drawing that looked wrong. The reason is kept
so you can apply the rule to objects it never mentions.

## The look

| Do | Don't | Why |
| --- | --- | --- |
| One object, facing the screen | A scene, a pile, a desk of things | An empty state has one idea; a scene asks to be read |
| A 1 px outline on every visible edge (`strokeWidth` 0.23 in `ink`) | Thicker strokes, a second weight for details | One weight is what makes the set look like one family at any size |
| Paper faces: palette `surface`, walls a whisper darker than tops | Shading, gradients, lit faces | The outline carries the form; shading turns line art into clip art |
| One small brand mark (palette `main`): a dot, a label, a hand, a flag | A brand-coloured body, two coloured parts | The eye needs one landing point; a coloured body shouts |
| No shadow, no floor, no grid | Drop shadows, contact shadows, glow, halos, bloom | They date the drawing and fight the page; the object sits on the copy, not on a floor |
| `variant="ink"` by default, `"line"` as the pure-outline option | Mixing ink and line parts | One look per object |

## Facing the screen

- **Build facing +y, about x = 0, standing on z = 0, and show it through
  `FRONT_POSE`.** The isometric camera sees +y at an angle; the kit turns
  the object 45° so its front points at the viewer and stretches heights
  by √(3/2) so the front keeps its true proportions. It is still one
  exact parallel projection of a solid: its thickness shows along its top
  edges at 1/√3 of its depth.
- **Thin things show a strip, deep things show a top.** A badge shows only
  a sliver along its top; a box shows its whole lid. So a solid stays a
  solid (a cone on a square foot whose top shows reads as a cone, not a
  cut-out).
- **Bounds go through `facing`.** The stage fits its frame to `bounds`
  without the rig, so map every bound point through `facing`.

## Resting straight

- **At rest every part lines up with the axes**: uprights vertical, edges
  level. An off-axis rest pose reads as *drawn wrong*, not relaxed. Parts
  may swing, tip or wobble during the beat, but they settle straight.
- **Show a second sheet by offsetting it (left and up), never by turning
  it.** A turned sheet reads as a mistake.
- **Copy references' objects, not their tilt.** Pins and mood images often
  show objects casually askew; rebuild them straight.

## Geometry

- **Positions and sizes on 0.5 world units; face details on 0.25.** Keeps
  every object on one grid and their proportions comparable.
- **Flat things are faces, not solids.** Paper, labels, screens, the
  pocket of an envelope: `FacePath`s on one plane in front of the body,
  hidden by paint order. Two stacked thin extrusions give three parallel
  edges and a dark band down the side.
- **Convex outlines pass `convex` to `Extrude`.** The engine then draws
  the far outline and the two side edges that join front and back.
- **Non-convex outlines need their far edge drawn.** The engine draws the
  far edge only for convex outlines. The exact recipe, at any lean: after
  the `Extrude`, draw the same outline as a `FacePath` on the back plane
  (`y = -depth`), add an `Edge` from front to back at each sharp corner of
  the silhouette, then paint the front face once more over all of it.
  What still shows of the back outline is exactly the far edge. Keep
  every side of such an outline leaning in by more than the widest swing,
  or part of the far edge hides mid-swing. A ring with a hole is the same
  with the hole drawn on the back plane.
  **That recipe is exact only when the object leans** (a swinging bell).
  For an object that stays straight-on, near a sharp corner above a level
  edge (an arrowhead's shoulders, a narrow tail tip) a stretch of the back
  outline lands outside the front face but inside the visible side wall
  and shows as a stray line. Use the **top-chain form** instead: draw only
  the *top run* of the outline on the back plane (the part of the
  silhouette you see over the front face), plus one `Edge` from front to
  back at each point where the side turns on screen: the leftmost and
  rightmost points, sharp corners, valley creases between lobes, tips.
  `FarEdge` in the kit does this (`chain` = the top run as a face path,
  `joins` = the turning points). See `cloud-upload.tsx` and
  `chat-bubble.tsx`.
  Simpler alternative: build a non-convex outline from convex pieces
  (a bubble's body and its tail as two extrusions, the tail behind).
- **Anything standing in front of a face shows depth/√3 lower than its
  height.** A knob or a dot that sits proud of a face looks low in front
  view; raise it by that amount (or make it thinner) so it reads centred.
- **Round solids are slices between level circles** (`Slice`, `Ring`):
  the side of a slice is the convex hull of its two rings. Paint slices
  from the foot up and each one covers the far half of the ring it stands
  on, which leaves exactly the visible edges. Cut a body into two or three
  slices so the seam draws a band round it; a plain tapered tub with a
  flat lid reads as a paper cup.
- **A mouth is the top ring filled a shade darker** (`Slice open`): from
  30° above, a deep vessel shows only its far inside wall.
- **A part that slides out of a housing is cut, not floated.** Painter's
  order can't hide the half still inside. Clip the part at the housing's
  front plane, or rebuild its outline from the clock (a shackle's legs
  get longer as it rises, so it slides out of the body instead of lifting
  off it).
- **Parts side by side along a slope are written from the lowest up.** In
  the front view a part's thickness shows above it, so each one must be
  drawn before the part above it hides its top edge.
- **Seen through glass is drawn on the thing behind.** Clip the enlarged
  marks to the lens opening inside the card's own face.
- **Clip drawn parts to an opening with a `clipPath` holding a
  `FacePath`**, so the clip is projected like everything else, then draw
  the opening's outline again over the cut ends.
- **A flexible part is computed, not rigged** (a cable): a centre line of
  cubic curves pushed out by half its width on either side.
- **Never hand-write a projected screen path.** Every shape is world
  geometry; missing shapes are helpers built from 3D.

## Composition

- **Centre the main mass over the copy, not the whole drawing.** The art,
  heading and button share one centre line and the eye puts it through
  the object's body. A part hanging off one side (a pencil, a tag) pulls
  the frame's middle away: make the frame even either side of the body's
  middle and let the overhang run into the padding, or shift the stage by
  the difference with a CSS `translate` on `stageClassName`. The checker
  wants ±2 px.
- **Every object is the same optical size.** Side by side, a tall
  hourglass at the default width looked twice the size of a wide toggle.
  At its default art width the resting drawing's √(width × height) is
  140–175 px and its height ≤ 215 px (the checker measures it). Set it
  with `defaultArtClassName` on `LineState` (wide objects get a wider
  box, tall ones a narrower one), never by changing world units.
- **Fit the frame to the resting pose.** Swings and hops run into the
  stage's padding, which is not clipped. Fitting the extremes makes the
  object small in its frame.
- **Look for an accidental face.** Two matching round parts over a curve
  read as eyes and a smile. Break the symmetry or move a part.

## Motion (see motion.md for the full grammar)

- **Tips never cross rest.** Rock about one edge, then the other, each
  track ≥ 0, so no foot goes through the floor.
- **Hinged parts: track from 0, overshoot only at the open end.** A
  wind-up below zero swings the flap through its housing.
- **Parts that pop out of a container fly on arcs** (two tracks, x and
  z, eased differently; see motion.md §6) and hide inside it at rest,
  low enough that they don't peek over an opened flap.
- **A part that leaves is thrown in a rig and shrunk away.** Nothing
  fades.
- **Rest-to-rest beats need one clip; one-way beats need an `again` clip
  that first undoes the beat.**
- **Reduced motion is read through a store, never in the first render**
  (`useReduced` in the kit). Reading it at once makes the server and the
  browser render different trees: a hydration error for every visitor
  with reduced motion on.

## The state around the art

- **The words ship with the object**: `heading`, `description`,
  `actionLabel` (an empty string hides each), `onAction`, and `children`
  to replace the button. The object is the whole state.
- **The button's icon follows its verb**: a plus only where the action
  adds; an arrow back for "Back to home"; an upload arrow for "Upload";
  no icon for "Request access". Where the state asks nothing of anyone
  the button steps back (`buttonVariant="secondary"`) or goes away
  (`actionLabel=""`).
- **Optical padding**: the label's side of an icon button gets 2 px more
  than the icon's side (the kit does this).
- **No button in the art.** Playing is the caller's: `active` (each time
  it turns true) and `onPlayEnd`. A click-to-replay button inside the art
  made a button inside a button the moment someone put the object in a
  link or a card, so it was removed (2026-11-17). `PlayOnHover` gives the
  hover, focus and touch case in one wrapper.
- **Copy budgets**: heading ≤ 28 characters, description one or two short
  sentences, button ≤ 22 characters. Plain words, no exclamation marks.

## Colour

- Only `--iso-*` variables and the kit's styles in an object file. The
  user's shadcn theme drives everything; `tone` picks the brand mark's
  colour (a token name like `primary` or `chart-2`, or any CSS colour).
- Dark mode is automatic: paper becomes dark paper, the outline becomes
  light, the brand mark stays the brand. Check it on the sheet anyway.
