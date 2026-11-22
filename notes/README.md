# Notes

Small craft details, one folder each. Every note is also a skill named
`notes-<topic>`, so your agent can use it (`/notes-optical-alignment`).
Each one has the rule, why it works, the measured numbers, and how to check
it again.

| Note | Skill | Rule |
| --- | --- | --- |
| [Optical alignment](notes-optical-alignment/) | `notes-optical-alignment` | Centre an icon by where its shape weighs, not by its box. Formula, calibration (α 0.7) and a script that measures any SVG. |

## Install

Every note, and only the notes:

```bash
npx skills add https://github.com/craftUI012/Skills/tree/main/notes
```

One note:

```bash
npx skills add https://github.com/craftUI012/Skills/tree/main/notes/notes-optical-alignment
```

Choose **Symlink** when asked. Run `npx skills update` later to get new
versions; re-run the notes command to pick up notes added since.

## Adding a note

A folder `notes/notes-<topic>/` with:

- `SKILL.md`: `name: notes-<topic>` (must match the folder), a description
  that says when to use it, then the rule, the steps, the numbers, the limits
- `README.md`: the full note for people (calibration, worked examples)
- any script or images it needs, next to them
