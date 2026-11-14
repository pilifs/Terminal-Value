// Reading posts: front matter and the post collection, shared by build.mjs and
// the Software Factory section. Drafts are left out before their Markdown is
// rendered, so a draft's missing image can't break a production build.

import fs from 'node:fs';
import path from 'node:path';

// Front matter is a flat `key: value` block between --- lines.
export function parsePost(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) throw new Error('Missing front matter');
  const meta = {};
  for (const line of match[1].split('\n')) {
    const i = line.indexOf(':');
    if (i === -1) continue;
    const value = line
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    meta[line.slice(0, i).trim()] =
      value === 'true' ? true : value === 'false' ? false : value;
  }
  for (const key of ['title', 'date', 'description']) {
    if (!meta[key]) throw new Error(`Missing front matter field: ${key}`);
  }
  return { meta, body: source.slice(match[0].length) };
}

/**
 * Every post in postsDir, newest first, as { slug, dir, source, meta, html }.
 * Without includeDrafts, a post with `draft: true` is left out before
 * render(dir, body) turns its Markdown into HTML. This is the one collection
 * every page, feed and index is made from.
 */
export function loadPosts(postsDir, { includeDrafts, render }) {
  if (!fs.existsSync(postsDir)) return [];
  return fs
    .readdirSync(postsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = path.join(postsDir, entry.name);
      const source = fs.readFileSync(path.join(dir, 'index.md'), 'utf8');
      return { slug: entry.name, dir, source, ...parsePost(source) };
    })
    .filter((post) => includeDrafts || !post.meta.draft)
    .map(({ body, ...post }) => ({ ...post, html: render(post.dir, body) }))
    .sort((a, b) => b.meta.date.localeCompare(a.meta.date));
}
