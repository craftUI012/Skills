#!/usr/bin/env node
/**
 * optical-center.mjs: where an icon looks centred, and how far to move it.
 *
 *   node optical-center.mjs <icon.svg ...> [--size 14] [--box 28]
 *                           [--alpha 0.75] [--step 0.25] [--area-ref 0.5]
 *   node optical-center.mjs --calibrate [--out ./calibration]
 *
 * For each SVG it draws the icon's silhouette (every shape filled, strokes
 * kept) at 480px and measures, in the icon's own viewBox units:
 *   box     the centre of the drawn ink's bounds
 *   mass    the centre of mass of the silhouette (the eye's pull)
 *   area    the share of the viewBox the silhouette covers
 * then, at the size you draw it (--size) inside a box (--box):
 *   eye     = alpha · mass + (1 − alpha) · box
 *   delta   = (eye − viewBox centre) · size / viewBox
 *   nudge   = −delta, rounded to --step px
 *   padding = (box − size) / 2, then left += nudge.x, right −= nudge.x,
 *                                    top += nudge.y, bottom −= nudge.y
 *   scale   = √(area-ref / area)   (only with --area-ref)
 *
 * --calibrate measures play triangles from icon systems that place theirs
 * optically (each implies an alpha), and writes calibration.png: a
 * triangle, a pencil and a bin at alpha 0 / 0.5 / 0.75 / 1 to judge by eye.
 *
 * Needs Playwright (`npm i -D playwright`) and Chromium
 * (`npx playwright install chromium`), or set CHROMIUM_PATH.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { chromium } from "playwright";

/* ------------------------------- Arguments -------------------------------- */

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const has = (name) => argv.includes(`--${name}`);
const files = argv.filter(
  (arg, i) => !arg.startsWith("--") && !argv[i - 1]?.startsWith("--")
);

const SIZE = Number(flag("size", 14));
const BOX = Number(flag("box", 28));
const ALPHA = Number(flag("alpha", 0.75));
const STEP = Number(flag("step", 0.25));
const AREA_REF = flag("area-ref", null);
const OUT = flag("out", "./calibration");

/* --------------------------- Reference glyphs ----------------------------- */
// Play triangles drawn by icon systems. Each sits off its grid's centre on
// purpose; how far, against its own mass, is the alpha it chose.
const svg = (body, attrs = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${attrs}>${body}</svg>`;

const REFERENCES = [
  {
    name: "Material play_arrow",
    svg: svg('<path d="M8 5v14l11-7z"/>', 'fill="currentColor"'),
  },
  {
    name: "Lucide play",
    svg: svg(
      '<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/>',
      'fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"'
    ),
  },
  {
    name: "Tabler player-play-filled",
    svg: svg(
      '<path d="M6 4v16a1 1 0 0 0 1.524 .852l13 -8a1 1 0 0 0 0 -1.704l-13 -8a1 1 0 0 0 -1.524 .852z"/>',
      'fill="currentColor"'
    ),
  },
  {
    name: "Hugeicons play",
    svg: svg(
      '<path d="M18.8906 12.846C18.5371 14.189 16.8667 15.138 13.5257 17.0361C10.296 18.8709 8.6812 19.7884 7.37983 19.4196C6.8418 19.2671 6.35159 18.9776 5.95624 18.5787C5 17.6139 5 15.7426 5 12C5 8.2574 5 6.3861 5.95624 5.42132C6.35159 5.02245 6.8418 4.73288 7.37983 4.58042C8.6812 4.21165 10.296 5.12907 13.5257 6.96393C16.8667 8.86197 18.5371 9.811 18.8906 11.154C19.0365 11.7084 19.0365 12.2916 18.8906 12.846Z"/>',
      'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"'
    ),
  },
];

// Judged by eye on the sheet: box-centred, so any shift is the formula's.
const SHEET = [
  {
    name: "Triangle",
    svg: svg('<path d="M5 4 L19 12 L5 20 Z"/>', 'fill="currentColor"'),
  },
  {
    name: "Pencil edit",
    svg: svg(
      '<path d="M16.4249 4.60509L17.4149 3.6151C18.2351 2.79497 19.5648 2.79497 20.3849 3.6151C21.205 4.43524 21.205 5.76493 20.3849 6.58507L19.3949 7.57506M16.4249 4.60509L9.76558 11.2644C9.25807 11.772 8.89804 12.4078 8.72397 13.1041L8 16L10.8959 15.276C11.5922 15.102 12.228 14.7419 12.7356 14.2344L19.3949 7.57506M16.4249 4.60509L19.3949 7.57506"/><path d="M18.9999 13.5C18.9999 16.7875 18.9999 18.4312 18.092 19.5376C17.9258 19.7401 17.7401 19.9258 17.5375 20.092C16.4312 21 14.7874 21 11.4999 21H11C7.22876 21 5.34316 21 4.17159 19.8284C3.00003 18.6569 3 16.7712 3 13V12.5C3 9.21252 3 7.56879 3.90794 6.46244C4.07417 6.2599 4.2599 6.07417 4.46244 5.90794C5.56879 5 7.21252 5 10.5 5"/>',
      'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"'
    ),
  },
  {
    name: "Bin",
    svg: svg(
      '<path d="M19.5 5.5L18.8803 15.5251C18.7219 18.0864 18.6428 19.3671 18.0008 20.2879C17.6833 20.7431 17.2747 21.1273 16.8007 21.416C15.8421 22 14.559 22 11.9927 22C9.42312 22 8.1383 22 7.17905 21.4149C6.7048 21.1257 6.296 20.7408 5.97868 20.2848C5.33688 19.3626 5.25945 18.0801 5.10461 15.5152L4.5 5.5"/><path d="M3 5.5H21M16.0557 5.5L15.3731 4.09173C14.9196 3.15626 14.6928 2.68852 14.3017 2.39681C14.215 2.3321 14.1231 2.27454 14.027 2.2247C13.5939 2 13.0741 2 12.0345 2C10.9688 2 10.436 2 9.99568 2.23412C9.8981 2.28601 9.80498 2.3459 9.71729 2.41317C9.32164 2.7167 9.10063 3.20155 8.65861 4.17126L8.05292 5.5"/><path d="M9.5 16.5V10.5"/><path d="M14.5 16.5V10.5"/>',
      'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"'
    ),
  },
];

/* ------------------------------- Measuring -------------------------------- */

const RES = 480;

// In the page: draw the silhouette and take its moments.
const measureInPage = async ([text, res]) => {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const root = doc.documentElement;
  const vb = (root.getAttribute("viewBox") ?? "0 0 24 24").split(/[\s,]+/).map(Number);
  root.setAttribute("width", String(res));
  root.setAttribute("height", String(res));
  root.setAttribute("color", "#000");
  // Silhouette: every shape filled; strokes kept at their width.
  for (const el of root.querySelectorAll("path,rect,circle,ellipse,polygon,polyline,line")) {
    el.setAttribute("fill", "#000");
    if (el.getAttribute("stroke") || root.getAttribute("stroke")) {
      el.setAttribute("stroke", "#000");
    }
  }
  if (root.getAttribute("stroke")) {
    root.setAttribute("stroke", "#000");
  }
  root.setAttribute("fill", "#000");
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(root))}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = res;
  canvas.height = res;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, res, res).data;
  let sum = 0;
  let sx = 0;
  let sy = 0;
  let x0 = res;
  let y0 = res;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < res; y += 1) {
    for (let x = 0; x < res; x += 1) {
      const a = data[(y * res + x) * 4 + 3];
      if (a > 0) {
        sum += a;
        sx += (x + 0.5) * a;
        sy += (y + 0.5) * a;
      }
      if (a > 32) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x + 1);
        y1 = Math.max(y1, y + 1);
      }
    }
  }
  const unit = vb[2] / res;
  return {
    area: sum / 255 / (res * res),
    box: [((x0 + x1) / 2) * unit + vb[0], ((y0 + y1) / 2) * unit + vb[1]],
    mass: [(sx / sum) * unit + vb[0], (sy / sum) * unit + vb[1]],
    view: vb[2],
  };
};

const round = (value, step) => Math.round(value / step) * step;
const fixed = (value, digits = 2) => Number(value.toFixed(digits));

/** The nudge, paddings and scale for one measured icon. */
export const place = (m, { size, box, alpha, step, areaRef }) => {
  const centre = m.view / 2;
  const eye = [0, 1].map((i) => alpha * m.mass[i] + (1 - alpha) * m.box[i]);
  const delta = eye.map((value) => ((value - centre) * size) / m.view);
  const nudge = delta.map((value) => fixed(round(-value, step) || 0));
  const pad = (box - size) / 2;
  return {
    eye: eye.map((value) => fixed(value)),
    nudge,
    padding: {
      bottom: fixed(pad - nudge[1]),
      left: fixed(pad + nudge[0]),
      right: fixed(pad - nudge[0]),
      top: fixed(pad + nudge[1]),
    },
    scale: areaRef ? fixed(Math.sqrt(areaRef / m.area), 3) : 1,
  };
};

/** The alpha an icon system chose, from where it put a glyph (per axis). */
const impliedAlpha = (m, axis) => {
  const gap = m.box[axis] - m.mass[axis];
  return Math.abs(gap) < 0.15 ? null : fixed((m.box[axis] - m.view / 2) / gap);
};

/* --------------------------------- Sheet ---------------------------------- */

const SHEET_ALPHAS = [0, 0.5, 0.75, 1];
const CELL = 132;
const GLYPH = 66;

const sheetHtml = (rows) => `<!doctype html><html><body style="margin:0;background:#0b0b0b;color:#d4d4d4;font:13px ui-monospace,monospace">
<div style="display:grid;grid-template-columns:140px repeat(${SHEET_ALPHAS.length},${CELL + 24}px);gap:16px;padding:28px;align-items:center">
<div></div>${SHEET_ALPHAS.map((a) => `<div style="text-align:center">alpha ${a}</div>`).join("")}
${rows
  .map(
    (row) => `<div>${row.name}</div>${SHEET_ALPHAS.map((a) => {
      const shift = place(row.m, { alpha: a, box: CELL, size: GLYPH, step: 0.01 }).nudge;
      return `<div style="position:relative;width:${CELL}px;height:${CELL}px;border-radius:999px;background:#1c1c1c;margin:0 auto;color:#a3a3a3">
  <div style="position:absolute;left:0;right:0;top:50%;border-top:1px dashed rgba(248,113,113,.45)"></div>
  <div style="position:absolute;top:0;bottom:0;left:50%;border-left:1px dashed rgba(248,113,113,.45)"></div>
  <div style="position:absolute;left:${(CELL - GLYPH) / 2}px;top:${(CELL - GLYPH) / 2}px;width:${GLYPH}px;height:${GLYPH}px;transform:translate(${shift[0]}px,${shift[1]}px)">${row.svg.replace("<svg ", `<svg width="${GLYPH}" height="${GLYPH}" `)}</div>
</div>`;
    }).join("")}`
  )
  .join("")}
</div></body></html>`;

/* ---------------------------------- Run ----------------------------------- */

const launch = () =>
  chromium.launch(
    process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}
  );

const main = async () => {
  const browser = await launch();
  const page = await browser.newPage();
  await page.setContent("<!doctype html><html><body></body></html>");
  const measure = (text) => page.evaluate(measureInPage, [text, RES]);

  if (has("calibrate")) {
    const refs = [];
    for (const ref of REFERENCES) {
      const m = await measure(ref.svg);
      refs.push({
        alphaX: impliedAlpha(m, 0),
        box: m.box.map((v) => fixed(v)),
        mass: m.mass.map((v) => fixed(v)),
        name: ref.name,
      });
    }
    const rows = [];
    for (const row of SHEET) {
      rows.push({ ...row, m: await measure(row.svg) });
    }
    await mkdir(OUT, { recursive: true });
    await page.setViewportSize({ height: 640, width: 980 });
    await page.setContent(sheetHtml(rows));
    await page.screenshot({ fullPage: true, path: join(OUT, "calibration.png") });
    const report = {
      references: refs,
      sheet: rows.map((row) => ({
        box: row.m.box.map((v) => fixed(v)),
        mass: row.m.mass.map((v) => fixed(v)),
        name: row.name,
      })),
    };
    await writeFile(join(OUT, "calibration.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  } else {
    if (files.length === 0) {
      console.error("Give one or more .svg files, or --calibrate.");
      process.exitCode = 1;
    }
    const options = {
      alpha: ALPHA,
      areaRef: AREA_REF ? Number(AREA_REF) : null,
      box: BOX,
      size: SIZE,
      step: STEP,
    };
    const results = [];
    for (const file of files) {
      const m = await measure(await readFile(file, "utf8"));
      results.push({
        area: fixed(m.area, 3),
        box: m.box.map((v) => fixed(v)),
        file: basename(file),
        mass: m.mass.map((v) => fixed(v)),
        ...place(m, options),
      });
    }
    console.log(JSON.stringify({ options, results }, null, 2));
  }
  await browser.close();
};

await main();
