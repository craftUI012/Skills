#!/usr/bin/env node
/**
 * check.mjs: the isometrics skill's strict render check.
 *
 * Renders one Line object on a page of your running app, in light and in
 * dark, steps its beat frame by frame on a fake clock, runs the automatic
 * checks, and writes a contact sheet to look at. An object is not done until
 * this passes AND you have looked at the sheet against the checklist in
 * SKILL.md ("Verify").
 *
 *   node check.mjs <url> [--out dir] [--duration ms] [--times 0,200,400]
 *                        [--dark-class dark] [--zoom 2]
 *
 *   <url>        a page that renders the object alone (one per object)
 *   --out        where frames, sheet.png and report.json go (default
 *                ./iso-check/<last path segment of the url>)
 *   --duration   the replay's length in ms, wait + beat (default 1600)
 *   --times      the frames to capture, ms after the replay click
 *                (default 0, 25, 50, 75 and 100% of --duration, then +600)
 *   --dark-class the class your app puts on <html> for dark (default "dark";
 *                "" to rely on prefers-color-scheme alone)
 *   --zoom       device scale factor for the frames (default 2)
 *
 * Needs Playwright: `npm i -D playwright` (or pnpm/yarn/bun) and either
 * `npx playwright install chromium` or Google Chrome installed.
 *
 * Exit code 0 when every automatic check passes, 1 otherwise.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/* ------------------------------- Arguments -------------------------------- */

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const url = argv.find((a) => !a.startsWith("--") && /^https?:/.test(a));
if (!url) {
  console.error("Usage: node check.mjs <url> [--out dir] [--duration ms]");
  process.exit(2);
}
const name = new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? "item";
const out = flag("out", join("iso-check", name));
const duration = Number(flag("duration", 1600));
const darkClass = flag("dark-class", "dark");
const zoom = Number(flag("zoom", 2));
const times = flag("times")
  ? flag("times").split(",").map(Number)
  : [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * duration)).concat(duration + 600);

/* ------------------------------- Browser ---------------------------------- */

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error(
    "Playwright is missing. Install it in this project: npm i -D playwright"
  );
  process.exit(2);
}
const launch = async () => {
  try {
    return await chromium.launch();
  } catch {
    return await chromium.launch({ channel: "chrome" });
  }
};
const browser = await launch();
await mkdir(out, { recursive: true });

const ART = '[data-slot$="-art"]';

/** A fresh page in a theme, the clock faked from the start. */
const open = async (theme, { reduced = false } = {}) => {
  const context = await browser.newContext({
    colorScheme: theme,
    deviceScaleFactor: zoom,
    reducedMotion: reduced ? "reduce" : "no-preference",
    viewport: { height: 900, width: 900 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.clock.install();
  await page.goto(url, { timeout: 120_000, waitUntil: "networkidle" });
  if (theme === "dark" && darkClass) {
    await page.evaluate((c) => document.documentElement.classList.add(c), darkClass);
  }
  const art = page.locator(ART).first();
  await art.waitFor({ timeout: 30_000 });
  // Wait until React has hydrated the art (a slow dev server can take
  // seconds): before that the server's still frame would pass for "rest".
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return !!el && Object.keys(el).some((k) => k.startsWith("__react"));
    },
    ART,
    { timeout: 120_000 }
  );
  await art.scrollIntoViewIfNeeded();
  return { art, context, errors, page };
};

/** Waits (in real time) until the art stops changing: the intro is over. */
const settled = async (page) => {
  await page.waitForTimeout(duration + 400);
  let last = await shootBuffer(page);
  for (let i = 0; i < 60; i += 1) {
    await page.waitForTimeout(300);
    const next = await shootBuffer(page);
    // A few anti-aliased pixels may flicker on repaint; that is rest.
    if ((await diff(page, last, next)) < 0.002) return;
    last = next;
  }
  throw new Error("The art never came to rest (still changing after 18 s).");
};

/** The page's own clock (faked): pause it so frames are exact. */
const pause = async (page) => {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 20);
};

const clipOf = async (page) => {
  const box = await page.locator(`${ART} [data-slot="iso-stage"]`).first().boundingBox();
  const pad = 24;
  return {
    height: box.height + pad * 2,
    width: box.width + pad * 2,
    x: Math.max(0, box.x - pad),
    y: Math.max(0, box.y - pad),
  };
};
const shootBuffer = async (page) => page.screenshot({ clip: await clipOf(page) });
const shoot = async (page, file) =>
  page.screenshot({ clip: await clipOf(page), path: join(out, file) });

/* ------------------------------- Checks ----------------------------------- */

/** Measured in the page at rest: outline weights, effects, frame, centring. */
const measure = (page) =>
  page.evaluate((artSel) => {
    const art = document.querySelector(artSel);
    const stage = art.querySelector('[data-slot="iso-stage"]');
    const svg = stage.querySelector("svg");
    // Resolve the outline colour the stage defines.
    const probe = document.createElementNS("http://www.w3.org/2000/svg", "path");
    probe.style.stroke = "var(--iso-edge, var(--iso-stroke))";
    svg.appendChild(probe);
    const edge = getComputedStyle(probe).stroke;
    probe.remove();

    const drawn = [...svg.querySelectorAll("path, ellipse, circle, rect, line, polyline, polygon")];
    const weights = [];
    const effects = [];
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (const el of drawn) {
      if (el.closest("defs, clipPath, mask")) continue;
      const cs = getComputedStyle(el);
      if (cs.filter !== "none") effects.push(`filter on <${el.tagName}>`);
      for (const paint of [cs.fill, cs.stroke]) {
        if (paint.startsWith("url(") && !paint.includes("clip")) {
          effects.push(`paint server ${paint} on <${el.tagName}>`);
        }
      }
      const r = el.getBoundingClientRect();
      if (r.width + r.height > 0) {
        left = Math.min(left, r.left);
        right = Math.max(right, r.right);
        top = Math.min(top, r.top);
        bottom = Math.max(bottom, r.bottom);
      }
      if (cs.stroke !== edge || Number.parseFloat(cs.strokeWidth) === 0) continue;
      const w = Number.parseFloat(cs.strokeWidth);
      const scaled = cs.vectorEffect !== "non-scaling-stroke";
      const k = scaled ? el.getScreenCTM()?.a ?? 1 : 1;
      weights.push(Math.round(w * k * 100) / 100);
    }
    const frame = stage.getBoundingClientRect();
    const heading = art.parentElement.querySelector("p");
    const headingBox = heading?.getBoundingClientRect();
    const glowDefs = svg.querySelectorAll("feGaussianBlur, feDropShadow").length;
    return {
      centre: headingBox
        ? Math.round(((left + right) / 2 - (headingBox.left + headingBox.right) / 2) * 10) / 10
        : null,
      drawn: { bottom, left, right, top },
      effects,
      frame: { bottom: frame.bottom, left: frame.left, right: frame.right, top: frame.top },
      glowDefs,
      weights,
    };
  }, ART);

/** Fraction of pixels that differ between two PNG buffers (same size). */
const diff = async (page, a, b) =>
  page.evaluate(
    async ([x, y]) => {
      const load = async (b64) => {
        const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
        const c = new OffscreenCanvas(img.width, img.height);
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, img.width, img.height);
      };
      const [p, q] = await Promise.all([load(x), load(y)]);
      if (p.width !== q.width || p.height !== q.height) return 1;
      let n = 0;
      for (let i = 0; i < p.data.length; i += 4) {
        const d =
          Math.abs(p.data[i] - q.data[i]) +
          Math.abs(p.data[i + 1] - q.data[i + 1]) +
          Math.abs(p.data[i + 2] - q.data[i + 2]);
        if (d > 24) n += 1;
      }
      return n / (p.width * p.height);
    },
    [a.toString("base64"), b.toString("base64")]
  );

/* ------------------------------- Run -------------------------------------- */

const results = [];
const pass = (id, ok, detail) => results.push({ detail, id, ok });
const frames = { dark: [], light: [] };
let restLight;
let endLight;
let rest;

for (const theme of ["light", "dark"]) {
  const { art, context, errors, page } = await open(theme);
  // Let the intro play out in real time, then freeze the clock.
  await settled(page);
  await pause(page);
  if (theme === "light") {
    rest = await measure(page);
    restLight = await shoot(page, "light-rest.png");
  }
  // Replay on click and step the beat.
  const button = art.locator("button").first();
  const replays = (await button.count()) > 0;
  if (replays) await button.click();
  let at = 0;
  for (const t of times) {
    await page.clock.runFor(Math.max(0, t - at));
    at = t;
    const file = `${theme}-${String(t).padStart(5, "0")}ms.png`;
    const shot = await shoot(page, file);
    frames[theme].push({ file, shot, t });
  }
  if (theme === "light") {
    endLight = frames.light.at(-1).shot;
    pass("replays on click", replays, replays ? "" : "no button in the art");
    let moved = 0;
    for (const f of frames.light.slice(1)) {
      moved = Math.max(moved, await diff(page, frames.light[0].shot, f.shot));
    }
    pass("the beat moves", moved > 0.002, `up to ${(moved * 100).toFixed(2)}% of pixels changed during the beat`);
  }
  const hydration = errors.filter((e) => /hydrat|did not match|server rendered/i.test(e));
  pass(`no hydration errors (${theme})`, hydration.length === 0, hydration.slice(0, 2).join(" | "));
  pass(`no console errors (${theme})`, errors.length === 0, errors.slice(0, 3).join(" | "));
  await context.close();
}

// Reduced motion: the resting pose, nothing moving, nothing to replay.
{
  const { art, context, errors, page } = await open("light", { reduced: true });
  await page.waitForTimeout(600);
  const a = await shoot(page, "reduced-a.png");
  await page.waitForTimeout(duration + 400);
  const b = await shoot(page, "reduced-b.png");
  const still = await diff(page, a, b);
  pass("reduced motion is still", still < 0.0005, `${(still * 100).toFixed(3)}% changed`);
  const rested = await diff(page, b, restLight);
  pass("reduced motion shows the resting pose", rested < 0.003, `${(rested * 100).toFixed(3)}% differs from the rest frame`);
  const button = await art.locator("button").count();
  pass("reduced motion offers no replay", button === 0, button ? "a replay button is still there" : "");
  const hydration = errors.filter((e) => /hydrat|did not match|server rendered/i.test(e));
  pass("no hydration errors (reduced motion)", hydration.length === 0, hydration.slice(0, 2).join(" | "));
  await context.close();
}

// Settles exactly back to rest (or to its end state, for one-way beats).
{
  const context = await browser.newContext();
  const page = await context.newPage();
  const settled = await diff(page, endLight, restLight);
  pass("the beat settles to the resting pose", settled < 0.003, `${(settled * 100).toFixed(3)}% differs from rest`);
  await context.close();
}

// Outline: every edge one weight, about 1 px.
{
  const off = rest.weights.filter((w) => w < 0.75 || w > 1.5);
  const kinds = [...new Set(rest.weights)].sort((a, b) => a - b);
  pass("outline is ~1 px everywhere", rest.weights.length > 0 && off.length === 0, `weights seen (px): ${kinds.join(", ")}`);
}
pass("no glow, no shadow, no gradient paint", rest.effects.length === 0 && rest.glowDefs === 0 ? true : rest.effects.length === 0, rest.effects.slice(0, 3).join(" | "));
{
  const f = rest.frame;
  const d = rest.drawn;
  const over = Math.max(f.left - d.left, d.right - f.right, f.top - d.top, d.bottom - f.bottom);
  pass("the resting drawing fits its frame", over <= 1.5, `overflows by ${over.toFixed(1)} px`);
}
{
  // Optical size: every object in the set should feel the same size on the
  // page. √(width × height) of the resting drawing at its default art width.
  const w = rest.drawn.right - rest.drawn.left;
  const h = rest.drawn.bottom - rest.drawn.top;
  const size = Math.round(Math.sqrt(w * h));
  pass(
    "optical size 140–175 px, height ≤ 215 px",
    size >= 140 && size <= 175 && h <= 215,
    `√(w×h) = ${size} px (${Math.round(w)} × ${Math.round(h)}); set defaultArtClassName to fix`
  );
}
if (rest.centre !== null) {
  pass("drawing centred on the heading (±2 px)", Math.abs(rest.centre) <= 2, `off by ${rest.centre} px (centre the main mass, see line-style.md)`);
}

/* ------------------------------- Sheet ------------------------------------ */

{
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await context.newPage();
  const cell = (f, label, bg) =>
    `<figure style="margin:0;background:${bg};padding:8px;border-radius:8px"><img src="data:image/png;base64,${f.toString("base64")}" style="width:220px;display:block"/><figcaption style="font:12px ui-monospace,monospace;color:#888;margin-top:6px">${label}</figcaption></figure>`;
  const row = (theme, bg) =>
    `<div style="display:flex;gap:8px;margin-bottom:8px">${frames[theme].map((f) => cell(f.shot, `${theme} ${f.t}ms`, bg)).join("")}</div>`;
  const table = results
    .map((r) => `<div style="font:13px ui-monospace,monospace;color:${r.ok ? "#15803d" : "#b91c1c"}">${r.ok ? "PASS" : "FAIL"} ${r.id}${r.detail ? ` <span style="color:#777">· ${r.detail}</span>` : ""}</div>`)
    .join("");
  await page.setContent(
    `<body style="margin:0;padding:16px;background:#e5e5e5;width:max-content">${row("light", "#fff")}${row("dark", "#0a0a0a")}<div style="margin-top:12px">${table}</div></body>`
  );
  await page.screenshot({ fullPage: true, path: join(out, "sheet.png") });
  await context.close();
}

await browser.close();

const report = { duration, results, times, url };
await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.id}${r.detail ? `  (${r.detail})` : ""}`);
}
console.log(`\nFrames and sheet: ${join(out, "sheet.png")}`);
console.log("Now LOOK at the sheet against the checklist in SKILL.md before calling it done.");
process.exit(results.every((r) => r.ok) ? 0 : 1);
