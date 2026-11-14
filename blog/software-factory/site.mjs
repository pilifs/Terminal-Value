// The Software Factory's entry in the rest of the site: a link in the header
// of every page and a short block on the home page, with the few style rules
// they need. Owned by the coordinator (docs/software-factory.md).
//
// build.mjs shows them only where the section is built: in production once
// config/section.json says published: true, and in the drafts build, which
// previews the section. While the section is unpublished, a production build
// has none of this, and its style.css stays byte for byte blog/assets/style.css:
// the rules live in site.css here and are appended to dist/style.css only when
// the entry is shown.
//
//   headerNav(canonical) -> '<nav …>' for the site header; marks the link
//     aria-current="true" on the section's own pages.
//   homeEntry() -> the home page's block, after the tagline.
//   STYLES -> site.css's rules, for dist/style.css.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DESCRIPTION, TITLE } from './render.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const URL_PATH = '/software-factory/';
export const STYLES = fs.readFileSync(path.join(HERE, 'site.css'), 'utf8');

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** The header's section link; canonical is the page's own path. */
export function headerNav(canonical = '') {
  const here = canonical.startsWith(URL_PATH) ? ' aria-current="true"' : '';
  return `<nav class="sections" aria-label="Sections"><a href="${URL_PATH}"${here}>${escapeHtml(TITLE)}</a></nav>`;
}

/** The home page's block: the section's name and what it shows. */
export function homeEntry() {
  return `<aside class="section-entry" aria-label="${escapeHtml(TITLE)}">
        <a href="${URL_PATH}">${escapeHtml(TITLE)}</a>
        <p>${escapeHtml(DESCRIPTION)}</p>
      </aside>`;
}
