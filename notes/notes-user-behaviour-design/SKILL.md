---
name: notes-user-behaviour-design
description: Design UI around what people's hands and eyes actually do, so controls stay where the pointer expects them and the screen doesn't move under a repeated action. Covers tab anchoring (pin a dialog, popover or card to its top edge so tabs don't move when the content under them changes height). Use when building or reviewing a dialog, modal, sheet or panel with tabs, a segmented control or a stepper over content of different heights, when tabs "jump", "slide" or "move under the pointer", when a centred modal resizes, or when the user asks about user behaviour, tab anchoring or a stable tab row.
---

# User behaviour design

**Principle:** people aim before they look. A control someone just used,
and is likely to use again, must stay where their hand left it. The
interface moves around their behaviour, never the other way.

Each topic is a folder next to this file with the full note (`README.md`),
its media and any script. Read the topic's README before changing code:
it has the steps, the numbers and how to check the result.

## Topics

| Topic | Rule | Read |
| --- | --- | --- |
| Tab anchor | Pin the edge your controls sit on; let only the far edge move. A centred box moves its tabs by `Δh / 2` whenever the content under them changes height. | `tab-anchor/README.md` |

## Tab anchor, in short

```css
.dialog {
  top: max(1rem, 12dvh);       /* was: top: 50% */
  translate: -50% 0;           /* was: translate: -50% -50% */
  transform-origin: top;
  max-height: calc(100dvh - max(1rem, 12dvh) - 1rem);
  overflow-y: auto;
}
```

Switch tab panels at once, without a cross-fade. Then check that the row
never moves, at any frame:

```bash
node <this skill's folder>/tab-anchor/tab-drift.mjs <url> --open "<selector that opens the dialog>"
```

It needs Playwright and Chromium (`npm i -D playwright`,
`npx playwright install chromium`, or `CHROMIUM_PATH=/path/to/chrome`).
It passes at ≤ 0.5px of drift.

## Adding a topic

A folder `<topic>/` next to this file with `README.md` (rule, why, steps,
numbers, how to check, when not to) plus its media and scripts, a row in
the table above, and the topic's trigger words in this file's
`description`.
