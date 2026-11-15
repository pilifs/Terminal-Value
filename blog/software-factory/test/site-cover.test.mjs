// The section's link-preview image (cover.mjs): its page in blog/covers/ is
// written from the committed snapshot, the committed PNG was rendered from
// that page, and the built pages name it. After a refresh that changes the
// snapshot these fail until `npm run software-factory:cover` has run.
// Coordinator-owned. Run: npm run test:software-factory

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { heroHtml } from '../../assets/software-factory/factory.js';
import { COVER, coverAlt, coverFacts, coverHtml, readCover, stampFor, stamped } from '../cover.mjs';
import { loadSnapshot } from '../index.mjs';
import { REPO, buildCopy, read, skip } from './site-build.mjs';

const EXAMPLE = path.join(REPO, 'blog', 'software-factory', 'test', 'fixtures', 'snapshot-example');
const AGAIN = 'run `npm run software-factory:cover` and commit both files';
const { snapshot } = loadSnapshot();
const text = (html) => html.replace(/<[^>]+>/g, '').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const count = (html, re) => (html.match(re) ?? []).length;

test('the card’s page is written from the committed snapshot', () => {
  assert.ok(fs.existsSync(COVER.html), AGAIN);
  assert.equal(read(COVER.html), coverHtml(snapshot), `blog/covers/software-factory.html is of another snapshot: ${AGAIN}`);
  assert.match(read(COVER.html), new RegExp(`from snapshot ${snapshot.pointer.snapshotId}\\.`));
});

test('the card’s image was rendered from that page, at 1200x630', () => {
  assert.ok(fs.existsSync(COVER.png), AGAIN);
  const png = readCover(fs.readFileSync(COVER.png));
  assert.deepEqual([png.width, png.height], [1200, 630]);
  assert.equal(png.stamp, stampFor(read(COVER.html), snapshot.pointer.snapshotId), `cover.png was rendered from another page: ${AGAIN}`);
});

test('the card says the overview’s headline and draws every run the account has', () => {
  const html = coverHtml(snapshot);
  const headline = text(heroHtml(snapshot, { title: 'Software Factory', lede: '' }).match(/<span class="sf-headline">(.*?)<\/span>/)[1]);
  assert.equal(text(html.match(/<h1>(.*?)<\/h1>/)[1]), headline);
  const { runs } = snapshot.overview.loopAccount;
  const quiet = runs.filter((r) => r.category === 'verification');
  assert.equal(count(html, /<rect class="run"/g), runs.length - quiet.length);
  assert.equal(count(html, /<rect class="quiet"/g), quiet.length);
  assert.ok(quiet.length > 0 && quiet.length < runs.length);
  // A mark for each cycle that ended in a commit, in the runs that have cycles.
  const ticks = runs.filter((r) => r.category !== 'verification').reduce((n, r) => n + r.ticks.length, 0);
  assert.equal(count(html, /<rect class="tick"/g), ticks);
  assert.ok(ticks > 0);
  const f = coverFacts(snapshot);
  assert.ok(text(html).includes(`${f.counts}, ${f.range}.`));
  assert.ok(coverAlt(snapshot).startsWith(`${headline}. `));
  // Nothing drawn runs past the strip, and no label is cut by its edge.
  for (const [, x, width] of html.matchAll(/<rect class="[a-z]+" x="([\d.]+)" y="[\d.]+" width="([\d.]+)"/g)) assert.ok(Number(x) + Number(width) <= 1080.5, `${x} + ${width}`);
  for (const [, x, label] of html.matchAll(/<text x="([\d.]+)" y="\d+">([^<]+)<\/text>/g)) assert.ok(Number(x) + label.length * 11 <= 1080, label);
  assert.doesNotMatch(text(html), /(?<!Software )Factory|\blive\b/);
});

test('a snapshot without the account of its loops has no card', () => {
  const other = loadSnapshot(EXAMPLE).snapshot;
  assert.ok(other);
  assert.equal(coverFacts(other), null);
  assert.equal(coverHtml(other), null);
  assert.equal(coverAlt(other), null);
});

test('a stamp is read back, and a new one replaces it without touching the picture', () => {
  const png = fs.readFileSync(COVER.png);
  const once = stamped(png, 'first');
  const twice = stamped(once, 'second');
  assert.equal(readCover(once).stamp, 'first');
  assert.equal(readCover(twice).stamp, 'second');
  assert.equal(once.length, twice.length - 1);
  assert.deepEqual(stamped(twice, readCover(png).stamp), png, 'the same stamp gives the same file');
  assert.throws(() => readCover(Buffer.from('not a png at all')), /not a PNG/);
});

test('published, every page of the section names the card, and the build ships it', { skip }, () => {
  const dist = buildCopy({ published: true });
  assert.deepEqual(fs.readFileSync(path.join(dist, 'software-factory', 'cover.png')), fs.readFileSync(COVER.png));
  const pages = fs.readdirSync(path.join(dist, 'software-factory'), { recursive: true }).filter((f) => f.endsWith('index.html'));
  assert.ok(pages.length >= 8, pages.join(' '));
  for (const file of pages) {
    const head = read(path.join(dist, 'software-factory', file)).split('</head>')[0];
    assert.match(head, /<meta property="og:image" content="https:\/\/terminalvalue\.net\/software-factory\/cover\.png">\s*<meta property="og:image:width" content="1200">\s*<meta property="og:image:height" content="630">/, file);
    assert.ok(head.includes(`<meta property="og:image:alt" content="${coverAlt(snapshot)}">`), file);
    assert.match(head, /<meta name="twitter:card" content="summary_large_image">/, file);
  }
  // The rest of the site keeps its own images.
  assert.doesNotMatch(read(path.join(dist, 'index.html')), /og:image/);
});

test('pages that show another snapshot don’t name the card', { skip }, () => {
  const dist = buildCopy({ published: false, drafts: true, dataDir: EXAMPLE });
  const overview = read(path.join(dist, 'software-factory', 'index.html'));
  assert.doesNotMatch(overview, /og:image/);
});
