# craftUI Skills

Free agent skills from [craftUI](https://www.craftui.space) for Claude Code,
Cursor, Codex and any agent that reads `SKILL.md` skills.

| Skill | What it does |
| --- | --- |
| [`isometrics`](isometrics/) | Draws and animates outline-style isometric objects in React + SVG: empty states, blocked states and spot illustrations, with exact isometric math, one beat of motion, and a strict render-and-screenshot check. Ships with its engine and 10 examples. |
| [`notes-*`](notes/) | Small craft details, one skill each: [`notes-optical-alignment`](notes/notes-optical-alignment/) centres an icon by where its shape weighs and tells you the nudge in pixels. |

More skills (illustrations) will live next to it, one folder each.

## Install

```bash
npx skills add craftUI012/Skills --skill isometrics
```

Only the notes (every `notes-*` skill, nothing else):

```bash
npx skills add https://github.com/craftUI012/Skills/tree/main/notes
```

Pick your agents and choose **Symlink** when asked. One copy goes into
`.agents/skills/isometrics/`, and each agent's skills folder links to it,
so they all share one version. Update later with:

```bash
npx skills update
```

Add `-g` to install it for your user instead of one project.

**Without the CLI**, clone and link it yourself:

```bash
git clone https://github.com/craftUI012/Skills.git ~/craftui-skills
ln -s ~/craftui-skills/isometrics ~/.claude/skills/isometrics      # Claude Code, all projects
ln -s ~/craftui-skills/isometrics .claude/skills/isometrics        # or one project
```

`git pull` in `~/craftui-skills` updates every link.

## Use

Ask your agent in plain words:

> gallery isometrics
>
> an isometric empty state for our billing page
>
> /isometrics an empty inbox

It reads the brief, offers three concepts (object, message, the one beat
of motion) and waits for your pick, then builds the object as a complete
state (illustration, heading, copy, button), renders it in light and dark,
runs `scripts/check.mjs`, looks at the frames and fixes what fails.

### Control the motion from your code

Every object plays one beat of motion, and your code decides when:

```tsx
<Folder />                                   // once, when it scrolls into view
<PlayOnHover><Folder /></PlayOnHover>        // on hover, focus and touch
<Folder active={uploadDone} onPlayEnd={reset} />  // each time `active` turns true
<Folder active={false} />                    // still until you say
<Folder heading="" description="" actionLabel="" artClassName="w-16" />  // the art alone, any size
```

There's no button inside the art, so it's safe inside links and buttons,
and visitors who ask for reduced motion always see it at rest.

### What your project needs

- React with Tailwind CSS and shadcn/ui (`@/lib/utils` and the `Button`
  component), and the `motion` package. The skill installs the engine
  files into `components/isometrics/` on first use.
- For the check: Playwright (`npm i -D playwright`, then
  `npx playwright install chromium`, or an installed Google Chrome).

## Licence

MIT. Use the skill, the engine and the examples in anything, commercial
included; keep the copyright line.

Want finished, polished isometric scenes and objects without drawing them?
The full library is at [craftui.space](https://www.craftui.space).
