# Optical spacing

**Principle:** pad the ink, not the box.

Padding is measured from boxes: an icon's box, a line of text's box. The
eye measures from the ink, the letters and the drawn lines. When a box has
air inside it, the padding you see is the padding you set plus that air.
One folder per topic, each with the rule, why it works, the numbers and a
way to check it.

| Topic | Rule |
| --- | --- |
| [Button icon padding](button-icon-padding/) | An icon's box has air inside it, so with equal padding the icon side looks wider. Give the text side about 2px extra. |
| [Card text trim](card-text-trim/) | Lines of text carry air above and below, so a card's padding looks bigger than it is. Trim it with `text-box: trim-both cap alphabetic`. |

Both are checked with [`ink-gaps.mjs`](ink-gaps.mjs), which measures each
side's gap to the ink and saves a picture of it.

## Install

```bash
npx skills add https://github.com/craftUI012/Skills/tree/main/notes/notes-optical-spacing
```

Then ask your agent, or run `/notes-optical-spacing`.
