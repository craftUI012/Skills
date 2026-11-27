#!/usr/bin/env node
/**
 * ink-gaps: measure how far the ink (the letters and the drawn lines of
 * icons) sits from each edge of an element, and compare it with the
 * padding you set. Padding is measured to boxes; the eye measures to ink.
 *
 *   node ink-gaps.mjs <url> [options]
 *
 *   --select <selector>   what to measure (default: button)
 *   --axis <x|y|both>     which sides to compare (default: x)
 *                           x: left vs right (buttons with icons)
 *                           y: top vs bottom (cards, list rows)
 *   --tolerance <px>      allowed difference between the two sides
 *                         (default 0.5)
 *   --shot <file.png>     also save a picture: each side shaded to the
 *                         ink, green when even, red when not
 *   --scale <n>           device scale for --shot (default 2)
 *   --width <px>          viewport width  (default 1280)
 *   --height <px>         viewport height (default 800)
 *
 * Text ink: where each glyph sits (DOM ranges) plus the font's own metrics:
 * the first line's cap top, the last line's baseline, and the first and
 * last letters' side bearings. Icon ink: each SVG shape's box plus half
 * its stroke. Images, video, canvas, and children with a fill, border or
 * shadow (a button at the bottom of a card) count as solid ink.
 *
 * Exits 1 when any element's sides differ by more than the tolerance.
 *
 * Needs Playwright with Chromium (`npm i -D playwright`,
 * `npx playwright install chromium`), or set CHROMIUM_PATH.
 */

import { chromium } from "playwright";

const args = process.argv.slice(2);
const url = args.find((arg, i) => !arg.startsWith("--") && !args[i - 1]?.startsWith("--"));
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? fallback : args[at + 1];
};

if (!url) {
  console.error("usage: node ink-gaps.mjs <url> [--select sel] [--axis x|y|both] [--shot file.png]");
  process.exit(2);
}

const options = {
  select: flag("select", "button"),
  axis: flag("axis", "x"),
  tolerance: Number(flag("tolerance", 0.5)),
  shot: flag("shot", null),
  scale: Number(flag("scale", 2)),
  width: Number(flag("width", 1280)),
  height: Number(flag("height", 800)),
};

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const page = await browser.newPage({
  viewport: { width: options.width, height: options.height },
  deviceScaleFactor: options.shot ? options.scale : 1,
});
await page.goto(url, { waitUntil: "networkidle" });

const results = await page.evaluate(async ({ select, axis, tolerance, shot }) => {
  await document.fonts.ready;
  const ctx = document.createElement("canvas").getContext("2d");

  const measure = (el) => {
    const R = el.getBoundingClientRect();
    // Screen px per CSS px, for elements that are scaled or zoomed.
    const k = el.offsetWidth ? R.width / el.offsetWidth : 1;
    const style = getComputedStyle(el);
    const pad = {
      left: Number.parseFloat(style.paddingLeft),
      right: Number.parseFloat(style.paddingRight),
      top: Number.parseFloat(style.paddingTop),
      bottom: Number.parseFloat(style.paddingBottom),
    };
    const ink = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
    const grow = (left, top, right, bottom) => {
      ink.left = Math.min(ink.left, left);
      ink.top = Math.min(ink.top, top);
      ink.right = Math.max(ink.right, right);
      ink.bottom = Math.max(ink.bottom, bottom);
    };
    const shown = (node) => {
      const box = node.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && getComputedStyle(node).visibility !== "hidden";
    };

    // Text: first line's cap top, last line's baseline, side bearings.
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? "";
      const start = text.search(/\S/);
      if (start === -1 || !node.parentElement || !shown(node.parentElement)) {
        continue;
      }
      const end = text.trimEnd().length;
      const s = getComputedStyle(node.parentElement);
      ctx.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
      const H = ctx.measureText("H");
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, end);
      const lines = [...range.getClientRects()].filter((r) => r.width > 0);
      if (lines.length === 0) {
        continue;
      }
      const glyph = (i) => {
        const r = document.createRange();
        r.setStart(node, i);
        r.setEnd(node, i + 1);
        return r.getClientRects()[0];
      };
      const first = glyph(start);
      const last = glyph(end - 1);
      const firstInk = first.left - ctx.measureText(text[start]).actualBoundingBoxLeft * k;
      const lastInk = last.left + ctx.measureText(text[end - 1]).actualBoundingBoxRight * k;
      // A range's rect is the font's content area: ascent over the
      // baseline, descent under it.
      const capTop = lines[0].top + (H.fontBoundingBoxAscent - H.actualBoundingBoxAscent) * k;
      const baseline = lines.at(-1).bottom - H.fontBoundingBoxDescent * k;
      // Lines between the first and last count by their box sideways.
      const left = Math.min(firstInk, ...lines.slice(1).map((r) => r.left));
      const right = Math.max(lastInk, ...lines.slice(0, -1).map((r) => r.right));
      grow(left, capTop, right, baseline);
    }

    // Icons: each shape's box plus half its stroke, in screen space.
    for (const shape of el.querySelectorAll(
      "svg path, svg circle, svg rect, svg line, svg polyline, svg polygon, svg ellipse"
    )) {
      const m = shape.getScreenCTM();
      if (!m || !shown(shape.ownerSVGElement ?? shape)) {
        continue;
      }
      const s = getComputedStyle(shape);
      const half = s.stroke === "none" ? 0 : Number.parseFloat(s.strokeWidth) / 2 || 0;
      const b = shape.getBBox();
      const corners = [
        [b.x - half, b.y - half],
        [b.x + b.width + half, b.y - half],
        [b.x - half, b.y + b.height + half],
        [b.x + b.width + half, b.y + b.height + half],
      ].map(([x, y]) => new DOMPoint(x, y).matrixTransform(m));
      grow(
        Math.min(...corners.map((p) => p.x)),
        Math.min(...corners.map((p) => p.y)),
        Math.max(...corners.map((p) => p.x)),
        Math.max(...corners.map((p) => p.y))
      );
    }

    // Pictures, and children with a fill, border or shadow (a button at
    // the bottom of a card, a badge, an avatar), are ink edge to edge.
    const solid = (child) => {
      const s = getComputedStyle(child);
      const filled = !/rgba\(.*,\s*0\)|transparent/.test(s.backgroundColor) || s.backgroundImage !== "none";
      const bordered = ["Top", "Right", "Bottom", "Left"].some(
        (side) => Number.parseFloat(s[`border${side}Width`]) > 0 && !/rgba\(.*,\s*0\)|transparent/.test(s[`border${side}Color`])
      );
      return filled || bordered || s.boxShadow !== "none";
    };
    for (const child of el.querySelectorAll("*")) {
      if (child instanceof SVGElement || !shown(child)) {
        continue;
      }
      if (child.matches("img, video, canvas") || solid(child)) {
        const r = child.getBoundingClientRect();
        grow(r.left, r.top, r.right, r.bottom);
      }
    }

    if (ink.left === Infinity) {
      return null;
    }
    const gaps = {
      left: (ink.left - R.left) / k,
      right: (R.right - ink.right) / k,
      top: (ink.top - R.top) / k,
      bottom: (R.bottom - ink.bottom) / k,
    };
    const label = (el.innerText || el.getAttribute("aria-label") || el.tagName)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 28);
    // Corner radii on screen (a zoomed or scaled element's are bigger).
    const radius = ["TopLeft", "TopRight", "BottomRight", "BottomLeft"]
      .map((corner) => {
        const value = style[`border${corner}Radius`].split(" ")[0];
        return value.endsWith("%") ? value : `${Number.parseFloat(value) * k}px`;
      })
      .join(" ");
    return { box: { left: R.left, top: R.top, right: R.right, bottom: R.bottom }, gaps, k, label, pad, radius };
  };

  const found = [...document.querySelectorAll(select)].filter(
    (el) => el.getBoundingClientRect().width > 0
  );
  const rows = found.map(measure).filter(Boolean);

  // Shade each compared side to the ink, with its number.
  if (shot) {
    const layer = document.createElement("div");
    layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647";
    document.body.append(layer);
    const add = (css, text) => {
      const div = document.createElement("div");
      div.style.cssText = `position:fixed;${css}`;
      if (text) {
        div.textContent = text;
      }
      layer.append(div);
    };
    const fmt = (v) => (Math.round(v * 10) / 10).toString();
    for (const row of rows) {
      const { box, gaps, k } = row;
      const width = box.right - box.left;
      const height = box.bottom - box.top;
      // Shading sits in a copy of the element's shape, so it keeps its
      // rounded corners.
      const shape = document.createElement("div");
      shape.style.cssText = `position:fixed;left:${box.left}px;top:${box.top}px;width:${width}px;height:${height}px;overflow:hidden;border-radius:${row.radius}`;
      layer.append(shape);
      const shade = (css) => {
        const div = document.createElement("div");
        div.style.cssText = `position:absolute;${css}`;
        shape.append(div);
      };
      const label = "font:500 12px ui-monospace,monospace;white-space:nowrap;";
      if (axis !== "y") {
        const even = Math.abs(gaps.left - gaps.right) <= tolerance;
        const color = even ? "#22c55e" : "#ef4444";
        const bands = [
          [box.left, gaps.left],
          [box.right - gaps.right * k, gaps.right],
        ];
        for (const [x, gap] of bands) {
          shade(`left:${x - box.left}px;top:0;width:${gap * k}px;height:100%;background:${color}40`);
          add(`left:${x}px;top:${box.bottom + 6}px;width:${gap * k}px;text-align:center;color:${color};${label}`, fmt(gap));
        }
      }
      if (axis !== "x") {
        const even = Math.abs(gaps.top - gaps.bottom) <= tolerance;
        const color = even ? "#22c55e" : "#ef4444";
        const bands = [
          [box.top, gaps.top],
          [box.bottom - gaps.bottom * k, gaps.bottom],
        ];
        for (const [y, gap] of bands) {
          shade(`left:0;top:${y - box.top}px;width:100%;height:${gap * k}px;background:${color}40`);
          add(`left:${box.right + 8}px;top:${y + (gap * k) / 2 - 8}px;color:${color};${label}`, fmt(gap));
        }
      }
    }
  }

  return rows.map(({ box, gaps, label, pad }) => ({ box, gaps, label, pad }));
}, options);

if (results.length === 0) {
  console.error(`nothing measurable matched "${options.select}"`);
  await browser.close();
  process.exit(2);
}

if (options.shot) {
  const margin = 24;
  const left = Math.max(0, Math.min(...results.map((r) => r.box.left)) - margin);
  const top = Math.max(0, Math.min(...results.map((r) => r.box.top)) - margin);
  const right = Math.max(...results.map((r) => r.box.right)) + margin + 40;
  const bottom = Math.max(...results.map((r) => r.box.bottom)) + margin + 16;
  await page.screenshot({
    path: options.shot,
    clip: { x: left, y: top, width: right - left, height: bottom - top },
  });
}

const fmt = (value) => value.toFixed(1).padStart(6);
let failed = 0;
const sides = {
  x: ["left", "right"],
  y: ["top", "bottom"],
};
const axes = options.axis === "both" ? ["x", "y"] : [options.axis];

for (const axis of axes) {
  const [a, b] = sides[axis];
  console.log(`\n${axis === "x" ? "Left / right" : "Top / bottom"} (CSS px)`);
  console.log(`${"element".padEnd(30)}${"padding".padStart(16)}${"to the ink".padStart(16)}${"diff".padStart(8)}  result`);
  for (const row of results) {
    const diff = row.gaps[a] - row.gaps[b];
    const ok = Math.abs(diff) <= options.tolerance;
    if (!ok) {
      failed += 1;
    }
    const padding = `${fmt(row.pad[a])} /${fmt(row.pad[b])}`;
    const ink = `${fmt(row.gaps[a])} /${fmt(row.gaps[b])}`;
    let hint = "";
    if (!ok && axis === "x") {
      const smaller = diff < 0 ? a : b;
      hint = `  add ${Math.abs(diff).toFixed(1)}px on the ${smaller}`;
    }
    if (axis === "y") {
      const extra = Math.max(row.gaps.top - row.pad.top, row.gaps.bottom - row.pad.bottom);
      if (extra > options.tolerance) {
        hint = `  ${extra.toFixed(1)}px of line air over the padding: try text-box: trim-both cap alphabetic`;
      }
    }
    console.log(
      `${JSON.stringify(row.label).slice(0, 29).padEnd(30)}${padding.padStart(16)}${ink.padStart(16)}${fmt(Math.abs(diff)).padStart(8)}  ${ok ? "PASS" : "FAIL"}${hint}`
    );
  }
}

if (options.shot) {
  console.log(`\nsaved ${options.shot}`);
}
await browser.close();
process.exit(failed > 0 ? 1 : 0);
