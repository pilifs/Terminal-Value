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
import { selectPosts } from './editorial.mjs';
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
 * none. Details stay files for the browser to load when asked.
 */
export function loadSnapshot(dataDir = DATA_DIR) {
  if (!fs.existsSync(path.join(dataDir, 'latest.json')))
    return { snapshot: null, unavailable: 'No Software Factory data has been published yet.' };
  const problems = validateSnapshotDir(dataDir);
  if (problems.length)
    return { snapshot: null, unavailable: `The published data failed validation: ${problems[0]}` };
  const pointer = readJson(path.join(dataDir, 'latest.json'));
  const base = path.join(dataDir, path.dirname(pointer.manifest));
  return {
    snapshot: {
      pointer,
      manifest: readJson(path.join(dataDir, pointer.manifest)),
      overview: readJson(path.join(base, 'overview.json')),
    },
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
 * test/fixtures/snapshot-example, and the pages then say they show a fixture.
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
  const { snapshot, unavailable } = loadSnapshot(dataDir);

  // The bundled data: the snapshot as committed, outside the Function's /data/ route.
  if (snapshot) fs.cpSync(dataDir, path.join(out, 'static-data'), { recursive: true });
  fs.mkdirSync(out, { recursive: true });
  fs.copyFileSync(path.join(HERE, 'measures.mjs'), path.join(out, 'measures.js'));

  // The client module runs only on the overview, and only with a snapshot to load.
  const hasApp = Boolean(snapshot) && fs.existsSync(path.join(out, APP));
  const preloads = hasApp ? moduleGraph(out).map((file) => `/${ROUTE}/${file}`) : [];

  const selection = selectPosts(posts, { postImage: helpers.postImage });
  const pages = renderPages({
    snapshot,
    unavailable,
    fixture: Boolean(override),
    posts: selection,
    site,
    helpers,
    paths: { route: `/${ROUTE}/`, staticData: `/${ROUTE}/static-data/`, remoteData: `/${ROUTE}/data/` },
  });
  for (const page of pages) {
    const file = path.join(out, page.path);
    const overview = hasApp && page.path === 'index.html';
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      layout({
        title: page.title,
        description: page.description,
        canonical: `/${ROUTE}/${page.path.replace(/index\.html$/, '')}`,
        body: page.body,
        pageClass: ROUTE,
        styles: fs.existsSync(path.join(out, 'style.css')) ? STYLES : [],
        scripts: overview ? [`/${ROUTE}/${APP}`] : [],
        preloads: overview ? preloads : [],
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
