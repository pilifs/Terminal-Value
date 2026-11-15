// The section's link-preview image: 1200x630, the overview's headline over
// every run of every loop. Made the way /prove-java-change/'s was, a page in
// blog/covers/ rendered to a committed PNG, with one difference: this page is
// written from the committed snapshot, so its numbers are the overview's.
//
//   npm run software-factory:cover
//     writes blog/covers/software-factory.html from the committed snapshot,
//     renders it with headless Chromium (llm-dlc/tools/screenshot.sh --setup
//     installs it) into blog/assets/software-factory/cover.png, and stamps the
//     PNG with the page's sha256 and the snapshot's id.
//
// Run it after every refresh that is committed. test/site-cover.test.mjs fails
// while the page or the image is of an older snapshot. The build doesn't read
// blog/covers/, and never renders: it only names the PNG in the pages' head.

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { accountClock, loopAccountFacts, stretches } from '../assets/software-factory/factory.js';
import { escapeHtml as e, formatDay } from '../assets/software-factory/format.js';
import { torontoDay } from '../assets/software-factory/measures-local.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');

export const COVER = {
  html: path.join(REPO, 'blog', 'covers', 'software-factory.html'),
  png: path.join(REPO, 'blog', 'assets', 'software-factory', 'cover.png'),
  url: '/software-factory/cover.png',
  width: 1200,
  height: 630,
};

const count = (n) => Math.round(n).toLocaleString('en-US');
const dayOf = (instant) => formatDay(torontoDay(instant), { year: false });
const dayYear = (instant) => formatDay(torontoDay(instant));
const px = (n) => String(Math.round(n * 10) / 10);

/**
 * What the card says, from the snapshot: the overview's headline, the counts
 * under it, and the days it covers. Null for a snapshot without the source's
 * account of its loops, which has no such headline.
 */
export function coverFacts(snapshot) {
  const f = loopAccountFacts(snapshot.overview);
  const clock = accountClock(snapshot.overview);
  if (!f || !f.recorded || !clock) return null;
  const all = stretches({ runs: clock.runs });
  if (!all.length) return null;
  return {
    headline: `${count(f.totals.commits)} of ${count(f.recorded)} commits were made inside a loop run`,
    counts: f.counts,
    typed: f.typed,
    range: `${dayOf(all[0].from)} to ${dayYear(all.at(-1).to)}`,
    stretches: all,
    runs: clock.runs.length,
  };
}

/** The card's alt text: what it says, then what it draws. */
export function coverAlt(snapshot) {
  const f = coverFacts(snapshot);
  return f ? `${f.headline}. ${f.counts}, ${f.range}. Under it, every run of every loop as a bar on one clock.` : null;
}

// --- The strip: every run on one clock ----------------------------------------

const STRIP = { width: 1080, gap: 22, bar: 20, lane: 28, label: 26 };
const MARK = 1.6;

// A row for each run under way at once; the verification sessions keep the first.
function rowsOf(stretch) {
  const free = [];
  return stretch.runs.map((r) => {
    if (r.quiet) return { ...r, row: 0 };
    let row = free.findIndex((until) => until <= r.from);
    if (row === -1) row = free.length;
    free[row] = r.to;
    return { ...r, row: row + 1 };
  });
}

/**
 * The runs as bars, a stretch of work after another, cut where no loop ran
 * (stretches() in factory.js, as the pages' own clock). A mark on a bar is a
 * cycle that ended in a commit.
 */
function stripSvg(all) {
  const placed = all.map((s) => ({ ...s, runs: rowsOf(s) }));
  const rows = Math.max(...placed.flatMap((s) => s.runs.map((r) => r.row))) + 1;
  const total = all.reduce((t, s) => t + (s.to - s.from), 0);
  const scale = (STRIP.width - STRIP.gap * (all.length - 1)) / total;
  const height = rows * STRIP.lane;
  let x = 0;
  let labelEnd = -Infinity;
  const parts = [];
  for (const s of placed) {
    const width = (s.to - s.from) * scale;
    parts.push(`<rect class="bed" x="${px(x)}" y="0" width="${px(width)}" height="${height}" rx="4"/>`);
    for (const r of s.runs) {
      const left = x + (r.from - s.from) * scale;
      const y = r.row * STRIP.lane + (STRIP.lane - STRIP.bar) / 2;
      const wide = Math.max(3, (r.to - r.from) * scale);
      parts.push(`<rect class="${r.quiet ? 'quiet' : 'run'}" x="${px(left)}" y="${px(y)}" width="${px(wide)}" height="${STRIP.bar}" rx="3"/>`);
      // A mark stays inside its bar: a run's last cycle ends where the run does.
      for (const t of r.quiet ? [] : (r.ticks ?? []))
        parts.push(`<rect class="tick" x="${px(Math.min(left + wide - MARK, Math.max(left, left + t * 1000 * scale - MARK / 2)))}" y="${px(y)}" width="${MARK}" height="${STRIP.bar}"/>`);
    }
    // A stretch's first day under it, where the one before left room.
    const text = dayOf(s.from);
    if (x >= labelEnd && x + text.length * 11 <= STRIP.width) {
      parts.push(`<text x="${px(x)}" y="${height + STRIP.label}">${e(text)}</text>`);
      labelEnd = x + text.length * 11 + 14;
    }
    x += width + STRIP.gap;
  }
  return `<svg viewBox="0 0 ${STRIP.width} ${height + STRIP.label + 6}" width="${STRIP.width}" height="${height + STRIP.label + 6}" role="img" aria-label="Every run of every loop, as bars on one clock">
      ${parts.join('\n      ')}
    </svg>`;
}

/** The card's page, from the committed snapshot. The same snapshot gives the same text, byte for byte. */
export function coverHtml(snapshot) {
  const f = coverFacts(snapshot);
  if (!f) return null;
  return `<!doctype html>
<!--
  The link-preview image of /software-factory/, ${COVER.width}x${COVER.height}. Not published: the build doesn't read this folder.
  Written by blog/software-factory/cover.mjs from snapshot ${snapshot.pointer.snapshotId}. Don't edit it here:
  change cover.mjs, then run

    npm run software-factory:cover

  which also renders it into blog/assets/software-factory/cover.png. A test fails while either is of an older snapshot.
-->
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>/software-factory cover</title>
    <style>
      * { box-sizing: border-box; margin: 0; }
      body {
        width: ${COVER.width}px;
        height: ${COVER.height}px;
        padding: 50px 60px 0;
        overflow: hidden;
        background: #0d1211;
        color: #eef2f0;
        font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      }
      .brand { display: flex; justify-content: space-between; font: 700 24px ui-monospace, 'SF Mono', Menlo, Consolas, monospace; color: #4fd1a5; }
      .brand span { color: #8b9791; font-weight: 400; }
      h1 { margin-top: 24px; font-size: 64px; line-height: 1.08; letter-spacing: -0.03em; }
      h1 em { font-style: normal; color: #4fd1a5; }
      .punch { margin-top: 20px; font-size: 27px; font-weight: 650; line-height: 1.3; letter-spacing: -0.01em; }
      .punch span { color: #8b9791; font-weight: 400; }
      svg { display: block; margin-top: 34px; }
      .bed { fill: #131917; }
      .run { fill: #1f5c4a; }
      .tick { fill: #6ee7b7; }
      .quiet { fill: #2a3531; }
      text { fill: #8b9791; font: 18px ui-monospace, 'SF Mono', Menlo, Consolas, monospace; }
      .by { margin-top: 10px; color: #8b9791; font-size: 19px; }
      .by i { display: inline-block; width: 13px; height: 13px; margin: 0 7px 0 18px; border-radius: 3px; vertical-align: -1px; }
      .by i:first-child { margin-left: 0; }
      .by .k-run { background: #1f5c4a; border-right: 3px solid #6ee7b7; }
      .by .k-quiet { background: #2a3531; }
    </style>
  </head>
  <body>
    <p class="brand">Software Factory <span>terminalvalue.net</span></p>
    <h1><em>${e(f.headline.split(' commits ')[0])}</em> commits ${e(f.headline.split(' commits ')[1])}</h1>
    <p class="punch">${e(f.counts)}, ${e(f.range)}.<br><span>${e(f.typed)}</span></p>
    ${stripSvg(f.stretches)}
    <p class="by"><i class="k-run"></i>A run of a loop, with a mark where a cycle ended in a commit<i class="k-quiet"></i>A session of the verification loop</p>
  </body>
</html>
`;
}

// --- The stamp: which page a PNG was rendered from -----------------------------

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const KEYWORD = 'Comment';
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

function chunks(png) {
  if (!png.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG');
  const out = [];
  for (let at = 8; at < png.length; ) {
    const length = png.readUInt32BE(at);
    out.push({ type: png.toString('latin1', at + 4, at + 8), data: png.subarray(at + 8, at + 8 + length), from: at, to: at + 12 + length });
    at += 12 + length;
  }
  return out;
}

/** The stamp's text for a page and the snapshot it was written from. */
export const stampFor = (html, snapshotId) => `software-factory cover; page sha256 ${sha256(html)}; snapshot ${snapshotId}`;

/** A PNG's size and its stamp: { width, height, stamp } (stamp null when it has none). */
export function readCover(png) {
  const all = chunks(png);
  const head = all.find((c) => c.type === 'IHDR');
  const text = all.filter((c) => c.type === 'tEXt').map((c) => c.data.toString('latin1').split('\0'));
  return { width: head.data.readUInt32BE(0), height: head.data.readUInt32BE(4), stamp: text.find(([k]) => k === KEYWORD)?.[1] ?? null };
}

/** The PNG with the stamp as a text chunk before its end (any earlier stamp replaced). */
export function stamped(png, stamp) {
  const all = chunks(png).filter((c) => !(c.type === 'tEXt' && c.data.toString('latin1').startsWith(`${KEYWORD}\0`)));
  const body = Buffer.from(`tEXt${KEYWORD}\0${stamp}`, 'latin1');
  const chunk = Buffer.alloc(body.length + 8);
  chunk.writeUInt32BE(body.length - 4, 0);
  body.copy(chunk, 4);
  chunk.writeUInt32BE(zlib.crc32(body), body.length + 4);
  const end = all.findIndex((c) => c.type === 'IEND');
  return Buffer.concat([SIGNATURE, ...all.slice(0, end).map((c) => png.subarray(c.from, c.to)), chunk, png.subarray(all[end].from, all[end].to)]);
}

// --- npm run software-factory:cover ---------------------------------------------

function headlessShell() {
  const root = path.join(os.homedir(), '.cache', 'ms-playwright');
  const found = fs.existsSync(root)
    ? fs
        .readdirSync(root)
        .filter((d) => d.startsWith('chromium_headless_shell-'))
        .sort()
        .map((d) => path.join(root, d, 'chrome-headless-shell-linux64', 'chrome-headless-shell'))
        .filter((f) => fs.existsSync(f))
    : [];
  if (!found.length) throw new Error('no headless Chromium: run llm-dlc/tools/screenshot.sh --setup');
  return found.at(-1);
}

// index.mjs imports this module for the pages' head, so the command loads it
// only once this module has finished loading.
async function main() {
  const { loadSnapshot } = await import('./index.mjs');
  const { snapshot, unavailable } = loadSnapshot();
  const html = snapshot ? coverHtml(snapshot) : null;
  if (!html) {
    console.error(`ERROR no cover: ${unavailable ?? 'the committed snapshot has no account of its loops'}`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(COVER.html), { recursive: true });
  fs.writeFileSync(COVER.html, html);
  const shot = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sf-cover-')), 'cover.png');
  try {
    execFileSync(headlessShell(), ['--no-sandbox', '--hide-scrollbars', `--window-size=${COVER.width},${COVER.height}`, `--screenshot=${shot}`, COVER.html], { stdio: 'pipe' });
    const png = fs.readFileSync(shot);
    const size = readCover(png);
    if (size.width !== COVER.width || size.height !== COVER.height) throw new Error(`rendered ${size.width}x${size.height}, not ${COVER.width}x${COVER.height}`);
    fs.writeFileSync(COVER.png, stamped(png, stampFor(html, snapshot.pointer.snapshotId)));
  } catch (err) {
    console.error(`ERROR ${err.message}`);
    process.exit(1);
  } finally {
    fs.rmSync(path.dirname(shot), { recursive: true, force: true });
  }
  console.log(`cover written from ${snapshot.pointer.snapshotId}: ${path.relative(REPO, COVER.html)}, ${path.relative(REPO, COVER.png)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
