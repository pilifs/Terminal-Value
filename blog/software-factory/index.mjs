// The Software Factory section of the site build: build.mjs calls
// buildSection() once, after copying blog/assets/ into dist/. Owned by the
// coordinator (docs/software-factory.md): streams change the modules it calls,
// not this file.
//
// It never reads upstream data: the build is offline and uses the snapshot
// committed in data/ (written by `npm run software-factory:refresh`).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COVER, coverAlt } from './cover.mjs';
import { selectPosts } from './editorial.mjs';
import { kindOf, withoutComments } from './lighten.mjs';
import { renderPages } from './render.mjs';
import { validateSnapshotDir } from './validate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROUTE = 'software-factory';
export const DATA_DIR = path.join(HERE, 'data');
export const SECTION = JSON.parse(fs.readFileSync(path.join(HERE, 'config', 'section.json'), 'utf8'));
// Public browser files: blog/assets/software-factory/ is copied by build.mjs
// with the other assets; measures.mjs is shared with the importer and copied here.
const STYLES = [`/${ROUTE}/style.css`];
const APP = 'app.js';

/**
 * Every module app.js reaches by its static imports, in the order first met,
 * so the page can preload them with app.js instead of a round trip later.
 */
export function moduleGraph(dir, entry = APP) {
  const seen = new Set([entry]);
  const order = [];
  const visit = (file) => {
    const source = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const [, spec] of source.matchAll(/^import\s+(?:[^;]*?\sfrom\s+)?['"](\.\.?\/[^'"]+)['"]/gm)) {
      const next = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
      if (seen.has(next)) continue;
      seen.add(next);
      order.push(next);
      visit(next);
    }
  };
  visit(entry);
  return order;
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/**
 * The committed snapshot as { pointer, manifest, overview }, or why there is
 * none. Details stay files for the browser to load when asked, but for the
 * examples, which the overview names: `examples` is that collection's records,
 * or null when the snapshot has none.
 */
export function loadSnapshot(dataDir = DATA_DIR) {
  if (!fs.existsSync(path.join(dataDir, 'latest.json')))
    return { snapshot: null, unavailable: 'No Software Factory data has been published yet.' };
  const problems = validateSnapshotDir(dataDir);
  if (problems.length)
    return { snapshot: null, unavailable: `The published data failed validation: ${problems[0]}` };
  const pointer = readJson(path.join(dataDir, 'latest.json'));
  const base = path.join(dataDir, path.dirname(pointer.manifest));
  const manifest = readJson(path.join(dataDir, pointer.manifest));
  const catalog = manifest.collections.find((c) => c.name === 'examples');
  return {
    snapshot: {
      pointer,
      manifest,
      overview: readJson(path.join(base, 'overview.json')),
    },
    examples: catalog ? readJson(path.join(base, catalog.path)).records : null,
    unavailable: null,
  };
}

/**
 * Writes the section into outDir and returns what the site-wide files need:
 * { sitemap: [url paths], llms: [llms.txt lines], headers: '_headers rules' }.
 *
 * While config/section.json says published: false, a production build gets
 * nothing (and the copied assets are removed); a drafts build gets it all.
 * SOFTWARE_FACTORY_DATA_DIR points a drafts build at another snapshot, such as
 * test/fixtures/snapshot-example, and the pages then say they show a fixture
 * (when its data loads: unavailable data shows no numbers to label).
 */
export function buildSection({ outDir, posts, includeDrafts, site, layout, helpers, published = SECTION.published }) {
  const out = path.join(outDir, ROUTE);
  const none = { sitemap: [], llms: [], headers: '' };
  if (!published && !includeDrafts) {
    fs.rmSync(out, { recursive: true, force: true });
    return none;
  }
  const override = includeDrafts ? process.env.SOFTWARE_FACTORY_DATA_DIR : undefined;
  const dataDir = override ? path.resolve(override) : DATA_DIR;
  const { snapshot, examples, unavailable } = loadSnapshot(dataDir);

  // The bundled data: the snapshot as committed, outside the Function's /data/ route.
  if (snapshot) fs.cpSync(dataDir, path.join(out, 'static-data'), { recursive: true });
  fs.mkdirSync(out, { recursive: true });
  fs.copyFileSync(path.join(HERE, 'measures.mjs'), path.join(out, 'measures.js'));
  // The section's own scripts and stylesheet go out without their full-line comments.
  for (const file of fs.readdirSync(out)) {
    const kind = kindOf(file);
    if (!kind || !fs.statSync(path.join(out, file)).isFile()) continue;
    try {
      fs.writeFileSync(path.join(out, file), withoutComments(fs.readFileSync(path.join(out, file), 'utf8'), kind));
    } catch (err) {
      throw new Error(`${ROUTE}/${file}: ${err.message}`);
    }
  }

  // The client module runs on the pages that show the snapshot's numbers
  // (page.app), and only with a snapshot to load.
  const hasApp = Boolean(snapshot) && fs.existsSync(path.join(out, APP));
  const preloads = hasApp ? moduleGraph(out).map((file) => `/${ROUTE}/${file}`) : [];

  const selection = selectPosts(posts, { postImage: helpers.postImage });
  const pages = renderPages({
    snapshot,
    // The records the overview names its catalog's squares from.
    examples,
    unavailable,
    // The banner speaks of the numbers shown, so it needs a snapshot to show.
    fixture: Boolean(override) && Boolean(snapshot),
    // A drafts build may show what the running-loops panel will look like, as a labelled example.
    preview: Boolean(includeDrafts),
    posts: selection,
    site,
    helpers,
    paths: { route: `/${ROUTE}/`, staticData: `/${ROUTE}/static-data/`, remoteData: `/${ROUTE}/data/` },
  });
  // The link-preview image is of the committed snapshot (cover.mjs), so pages
  // that show another snapshot don't name it.
  const cover = !override && snapshot && fs.existsSync(path.join(out, path.basename(COVER.png))) ? coverAlt(snapshot) : null;
  const image = cover ? { url: COVER.url, width: COVER.width, height: COVER.height, alt: cover } : undefined;
  for (const page of pages) {
    const file = path.join(out, page.path);
    const app = hasApp && Boolean(page.app);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      layout({
        title: page.title,
        description: page.description,
        canonical: `/${ROUTE}/${page.path.replace(/index\.html$/, '')}`,
        image,
        body: page.body,
        pageClass: ROUTE,
        styles: fs.existsSync(path.join(out, 'style.css')) ? STYLES : [],
        scripts: app ? [`/${ROUTE}/${APP}`] : [],
        preloads: app ? preloads : [],
      })
    );
  }

  const urls = pages.map((p) => `/${ROUTE}/${p.path.replace(/index\.html$/, '')}`);
  return {
    sitemap: published ? urls : [],
    llms: published ? [`- [Software Factory](${site.url}/${ROUTE}/): ${pages[0]?.description ?? ''}`] : [],
    headers:
      `/${ROUTE}/static-data/latest.json\n  Cache-Control: no-cache\n` +
      `/${ROUTE}/static-data/snapshots/*\n  Cache-Control: public, max-age=31536000, immutable\n`,
  };
}
