#!/usr/bin/env node
/**
 * tab-drift: click every tab in a dialog and measure how far the tab row
 * moves. A row that moves when its own content changes height will move
 * under the pointer; it should not move at all.
 *
 *   node tab-drift.mjs <url> [options]
 *
 *   --open <selector>     click this first to open the dialog
 *   --scope <selector>    where to look for tabs (default: the open
 *                         [role=dialog], else the page)
 *   --tabs <selector>     the tabs to click (default: [role=tab])
 *   --watch <selector>    the element whose top must stay put
 *                         (default: [role=tablist])
 *   --width <px>          viewport width  (default 1280)
 *   --height <px>         viewport height (default 800)
 *   --tolerance <px>      allowed drift   (default 0.5)
 *
 * Every frame while a tab switch settles is sampled, so drift during a
 * height animation counts, not just where it lands. Exits 1 when the row
 * moved more than the tolerance.
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
  console.error("usage: node tab-drift.mjs <url> [--open sel] [--tabs sel] [--watch sel]");
  process.exit(2);
}

const options = {
  open: flag("open", null),
  scope: flag("scope", null),
  tabs: flag("tabs", "[role=tab]"),
  watch: flag("watch", "[role=tablist]"),
  width: Number(flag("width", 1280)),
  height: Number(flag("height", 800)),
  tolerance: Number(flag("tolerance", 0.5)),
};

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const page = await browser.newPage({
  viewport: { width: options.width, height: options.height },
});
await page.goto(url, { waitUntil: "networkidle" });

if (options.open) {
  await page.click(options.open);
  await page.waitForTimeout(800);
}

const scope =
  options.scope ??
  ((await page.locator("[role=dialog]:visible").count()) > 0
    ? "[role=dialog]:visible"
    : "body");
const root = page.locator(scope).first();
const watch = root.locator(options.watch).first();
const tabs = root.locator(options.tabs);
const count = await tabs.count();

if (count < 2) {
  console.error(`found ${count} tab(s) for "${options.tabs}" in "${scope}"`);
  await browser.close();
  process.exit(2);
}

/** Sample the watched top and the box height every frame until both hold
 * still for 250ms (or 3s pass). Returns the extremes seen. */
const settle = () =>
  watch.evaluate(
    (el, boxSel) =>
      new Promise((resolve) => {
        const box = el.closest(boxSel) ?? document.body;
        const start = performance.now();
        let still = start;
        let last = null;
        let min = Infinity;
        let max = -Infinity;
        const tick = () => {
          const top = el.getBoundingClientRect().top;
          const height = box.getBoundingClientRect().height;
          min = Math.min(min, top);
          max = Math.max(max, top);
          const now = performance.now();
          if (!last || Math.abs(top - last.top) > 0.01 || Math.abs(height - last.height) > 0.01) {
            still = now;
          }
          last = { top, height };
          if (now - still > 250 || now - start > 3000) {
            resolve({ top, height, min, max });
          } else {
            requestAnimationFrame(tick);
          }
        };
        requestAnimationFrame(tick);
      }),
    scope === "body" ? "body" : "[role=dialog]"
  );

const rows = [];
const first = await settle();
const origin = first.top;
let worst = 0;
let heights = new Set([Math.round(first.height)]);

// Visit every tab, then come back to the first, so each switch is a real
// height change in at least one direction.
const order = [...Array(count).keys()].slice(1).concat(0);
for (const index of order) {
  const tab = tabs.nth(index);
  const label = ((await tab.textContent()) ?? `tab ${index}`).trim();
  await tab.click();
  const s = await settle();
  const drift = Math.max(Math.abs(s.min - origin), Math.abs(s.max - origin));
  worst = Math.max(worst, drift);
  heights.add(Math.round(s.height));
  rows.push({
    tab: label.slice(0, 24),
    "box height": Math.round(s.height),
    "row top": Number(s.top.toFixed(2)),
    "max drift": Number(drift.toFixed(2)),
  });
}

await browser.close();

console.log(`scope ${scope} · watching ${options.watch} · start top ${origin.toFixed(2)}px`);
console.table(rows);

if (heights.size < 2) {
  console.log("note: the box never changed height, so this run proves nothing either way");
}
if (worst > options.tolerance) {
  console.log(`FAIL the tab row moved ${worst.toFixed(2)}px (tolerance ${options.tolerance}px)`);
  process.exit(1);
}
console.log(`PASS the tab row stayed within ${options.tolerance}px`);
