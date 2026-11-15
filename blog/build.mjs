// Builds the blog from blog/posts/<slug>/index.md into dist/.
// Every post is published twice: as HTML for people and as Markdown for agents.
//
//   node blog/build.mjs            production build (drafts excluded)
//   node blog/build.mjs --drafts   include drafts, mark the site noindex
//   node blog/build.mjs --serve    also serve dist/ at http://localhost:8788
//                                  (PORT=8791 serves on another port)

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { imageSize } from 'image-size';
import { Marked } from 'marked';
import markedFootnote from 'marked-footnote';
import { createHighlighter } from 'shiki';
import { loadPosts } from './posts.mjs';
import { byline, evidenceLinks, validateEvidence } from './software-factory/editorial.mjs';
import { buildSection, SECTION } from './software-factory/index.mjs';
import * as sectionEntry from './software-factory/site.mjs';

const SITE = {
  title: 'Terminal Value',
  tagline: 'Thoughts and experiments on AI Engineering',
  url: 'https://terminalvalue.net',
  author: 'Filip Stankovic',
  links: [
    ['GitHub', 'https://github.com/pilifs/Terminal-Value'],
    ['LinkedIn', 'https://www.linkedin.com/in/filipstankovic/'],
  ],
};

const BLOG_DIR = path.dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = path.join(BLOG_DIR, 'posts');
const ASSETS_DIR = path.join(BLOG_DIR, 'assets');
const OUT_DIR = path.join(BLOG_DIR, '..', 'dist');
// Static builds of projects in projects/<name>/dist, published at /projects/<name>/.
// Build them first with `npm run build:projects`.
const PROJECTS = ['terminal-value-pipeline'];
const PROJECTS_DIR = path.join(BLOG_DIR, '..', 'projects');
const CODE_LANGS = [
  'js',
  'ts',
  'json',
  'html',
  'css',
  'sh',
  'python',
  'md',
  'xml',
  'yaml',
  'diff',
];

const args = new Set(process.argv.slice(2));
const includeDrafts = args.has('--drafts');
// The Software Factory section is built in production once published, and in
// the drafts build as a preview. Its entry in the header and on the home page,
// and its posts' evidence links, follow it.
const sectionShown = SECTION.published || includeDrafts;

const escapeHtml = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[
        c
      ])
  );

const formatDate = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function createMarkdown(highlighter, postDir) {
  const markdown = new Marked();
  markdown.use(markedFootnote()); // GitHub-style [^1] footnotes
  markdown.use({
    renderer: {
      // A paragraph that holds only an image becomes a <figure>, not <p><figure>.
      paragraph({ tokens }) {
        if (tokens.length === 1 && tokens[0].type === 'image')
          return this.parser.parseInline(tokens);
        // "![before](a.png) → ![after](b.png)" shows the two figures side by side.
        const [before, arrow, after] = tokens;
        if (
          tokens.length === 3 &&
          before.type === 'image' &&
          after.type === 'image' &&
          arrow.type === 'text' &&
          /^\s*(→|->)\s*$/.test(arrow.text)
        )
          return (
            `<div class="compare">${this.parser.parseInline([before])}` +
            `<span class="arrow" aria-hidden="true">→</span>` +
            `${this.parser.parseInline([after])}</div>\n`
          );
        return `<p>${this.parser.parseInline(tokens)}</p>\n`;
      },
      // ![alt text](file.png "Caption") renders as a zoomable figure with a caption.
      image({ href, title, text }) {
        const local = !/^[a-z]+:\/\//i.test(href);
        let size = '';
        if (local) {
          const file = path.join(postDir, href);
          if (!fs.existsSync(file)) throw new Error(`Image not found: ${file}`);
          const { width, height } = imageSize(fs.readFileSync(file));
          size = ` width="${width}" height="${height}"`;
        }
        const caption = title
          ? `<figcaption>${markdown.parseInline(title)}</figcaption>`
          : '';
        return (
          `<figure><a class="zoom" href="${escapeHtml(href)}">` +
          `<img src="${escapeHtml(href)}" alt="${escapeHtml(
            text
          )}"${size} loading="lazy" decoding="async"></a>` +
          `${caption}</figure>\n`
        );
      },
      // GitHub's alert syntax, "> [!NOTE]", renders as an info box.
      blockquote({ tokens }) {
        const html = this.parser.parse(tokens);
        const note = html.match(/^<p>\[!NOTE\]\s*/);
        if (!note) return `<blockquote>\n${html}</blockquote>\n`;
        return `<aside class="note">\n<p>${html.slice(note[0].length)}</aside>\n`;
      },
      code({ text, lang }) {
        const language = CODE_LANGS.includes(lang) ? lang : 'text';
        return highlighter.codeToHtml(text, {
          lang: language,
          themes: { light: 'min-light', dark: 'min-dark' },
          defaultColor: false,
        });
      },
      heading({ tokens, depth }) {
        const html = this.parser.parseInline(tokens);
        if (depth === 1) return `<h2>${html}</h2>\n`; // the post title is the only h1
        const id = slugify(html);
        return `<h${depth} id="${id}"><a href="#${id}">${html}</a></h${depth}>\n`;
      },
    },
  });
  return markdown;
}

function layout({
  title,
  description,
  canonical,
  body,
  markdownUrl,
  home,
  image,
  type = 'website',
  pageClass, // a class on <body>, for a section's own styles
  styles = [], // extra stylesheets, after /style.css
  scripts = [], // extra ES modules
  preloads = [], // the modules those import, fetched alongside them (modulepreload)
}) {
  const pageTitle = title ? `${title} · ${SITE.title}` : SITE.title;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(pageTitle)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="author" content="${escapeHtml(SITE.author)}">
    ${includeDrafts ? '<meta name="robots" content="noindex">' : ''}
    <link rel="canonical" href="${SITE.url}${canonical}">
    <meta property="og:type" content="${type}">
    <meta property="og:site_name" content="${SITE.title}">
    <meta property="og:url" content="${SITE.url}${canonical}">
    <meta property="og:title" content="${escapeHtml(title || SITE.title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    ${
      image
        ? `<meta property="og:image" content="${SITE.url}${image.url}">
    <meta property="og:image:width" content="${image.width}">
    <meta property="og:image:height" content="${image.height}">
    <meta name="twitter:card" content="summary_large_image">`
        : ''
    }
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/style.css">${styles
      .map((href) => `\n    <link rel="stylesheet" href="${href}">`)
      .join('')}
    <link rel="alternate" type="application/rss+xml" title="${
      SITE.title
    }" href="/feed.xml">
    ${
      markdownUrl
        ? `<link rel="alternate" type="text/markdown" href="${markdownUrl}">`
        : ''
    }
    <script src="/zoom.js" defer></script>${scripts
      .map((src) => `\n    <script type="module" src="${src}"></script>`)
      .join('')}${preloads.map((href) => `\n    <link rel="modulepreload" href="${href}">`).join('')}
  </head>
  <body${pageClass ? ` class="${escapeHtml(pageClass)}"` : ''}>
    ${
      home
        ? ''
        : `<header class="site"><a href="/">${SITE.title}</a>${
            sectionShown ? sectionEntry.headerNav(canonical) : ''
          }</header>`
    }
    <main>
${body}
    </main>
    <footer class="site">
      <nav aria-label="Links">${SITE.links
        .map(([label, href]) => `<a href="${href}">${label}</a>`)
        .join(
          ''
        )}<a href="/feed.xml">RSS</a><a href="/llms.txt">llms.txt</a></nav>
    </footer>
  </body>
</html>
`;
}

// `image: file.png` in front matter: shown on the home page and as the preview
// when the post is shared. 1200x630, with the subject in the middle (the home
// page crops the top and bottom).
function postImage({ slug, dir, meta }) {
  if (!meta.image) return undefined;
  const file = path.join(dir, meta.image);
  if (!fs.existsSync(file)) throw new Error(`Image not found: ${file}`);
  const { width, height } = imageSize(fs.readFileSync(file));
  return { url: `/posts/${slug}/${meta.image}`, width, height };
}

function renderPost(post) {
  const { meta, slug, html } = post;
  const draft = meta.draft ? '<span class="draft">Draft</span>' : '';
  // Software Factory: the author's byline, and links to the post's frozen
  // evidence and the section, once the section is built.
  const links = evidenceLinks(post, { section: sectionShown });
  const body = `      <article>
        <h1>${escapeHtml(meta.title)}</h1>
        <p class="meta"><time datetime="${meta.date}">${formatDate(
    meta.date
  )}</time>${byline(post)}${draft}</p>
        ${html}
      </article>${links ? `\n      ${links}` : ''}
      <p class="source">This post is also available as <a href="/posts/${slug}/index.md">Markdown</a>.</p>`;
  return layout({
    title: meta.title,
    description: meta.description,
    canonical: `/posts/${slug}/`,
    markdownUrl: `/posts/${slug}/index.md`,
    image: postImage(post),
    type: 'article',
    body,
  });
}

function renderIndex(posts) {
  const items = posts
    .map((post) => {
      const { slug, meta } = post;
      const image = postImage(post);
      return `        <li>
          <a href="/posts/${slug}/">${escapeHtml(meta.title)}</a>${
        meta.draft ? '<span class="draft">Draft</span>' : ''
      }
          <time datetime="${meta.date}">${formatDate(meta.date)}</time>${
        image
          ? `
          <a class="cover" href="/posts/${slug}/" tabindex="-1" aria-hidden="true"><img src="${image.url}" alt="" width="${image.width}" height="${image.height}"></a>`
          : ''
      }
          <p>${escapeHtml(meta.description)}</p>
        </li>`;
    })
    .join('\n');
  const body = `      <h1>${SITE.title}</h1>
      <p class="tagline">${SITE.tagline}</p>${
        sectionShown ? `\n      ${sectionEntry.homeEntry()}` : ''
      }
      ${
        posts.length
          ? `<ol class="posts">\n${items}\n      </ol>`
          : '<p>No posts yet.</p>'
      }`;
  // The home page's h1 is the site title, so it skips the header link.
  return layout({ description: SITE.tagline, canonical: '/', body, home: true });
}

function renderLlmsTxt(posts, sections = []) {
  const lines = posts.map(
    ({ slug, meta }) =>
      `- [${meta.title}](${SITE.url}/posts/${slug}/index.md): ${meta.description}`
  );
  const more = sections.length
    ? `\n## Sections\n\n${sections.join('\n')}\n`
    : '';
  return `# ${SITE.title}\n\n> ${SITE.tagline} By ${
    SITE.author
  }.\n\nEvery post is available as Markdown at /posts/<slug>/index.md.\n\n## Posts\n\n${lines.join(
    '\n'
  )}\n${more}`;
}

function renderSitemap(posts, sectionUrls = []) {
  const urls = [
    '/',
    ...posts.map(({ slug }) => `/posts/${slug}/`),
    ...sectionUrls,
    ...PROJECTS.flatMap((name) => [
      `/projects/${name}/`,
      ...(fs.existsSync(path.join(ASSETS_DIR, 'projects', name, 'compare'))
        ? [`/projects/${name}/compare/`]
        : []),
    ]),
  ];
  return `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${SITE.url}${url}</loc></url>`).join('\n')}
</urlset>
`;
}

function renderFeed(posts) {
  const items = posts
    .map(
      ({ slug, meta, html }) => `    <item>
      <title>${escapeHtml(meta.title)}</title>
      <link>${SITE.url}/posts/${slug}/</link>
      <guid>${SITE.url}/posts/${slug}/</guid>
      <pubDate>${new Date(`${meta.date}T12:00:00Z`).toUTCString()}</pubDate>
      <description>${escapeHtml(meta.description)}</description>
      <content:encoded><![CDATA[${html.replaceAll(
        ']]>',
        ']]]]><![CDATA[>'
      )}]]></content:encoded>
    </item>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${SITE.title}</title>
    <link>${SITE.url}/</link>
    <description>${SITE.tagline}</description>
${items}
  </channel>
</rss>
`;
}

function write(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

async function build() {
  const highlighter = await createHighlighter({
    themes: ['min-light', 'min-dark'],
    langs: CODE_LANGS,
  });
  const posts = loadPosts(POSTS_DIR, {
    includeDrafts,
    render: (dir, body) => createMarkdown(highlighter, dir).parse(body),
  });
  const problems = posts.flatMap(validateEvidence);
  if (problems.length) throw new Error(problems.join('\n'));

  for (const name of PROJECTS) {
    if (!fs.existsSync(path.join(PROJECTS_DIR, name, 'dist', 'index.html')))
      throw new Error(
        `projects/${name}/dist is missing. Run \`npm run build:projects\` first.`
      );
  }

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.cpSync(ASSETS_DIR, OUT_DIR, { recursive: true });
  if (sectionShown)
    fs.appendFileSync(path.join(OUT_DIR, 'style.css'), sectionEntry.STYLES);
  for (const name of PROJECTS) {
    fs.cpSync(
      path.join(PROJECTS_DIR, name, 'dist'),
      path.join(OUT_DIR, 'projects', name),
      { recursive: true }
    );
  }

  for (const post of posts) {
    const out = path.join(OUT_DIR, 'posts', post.slug);
    fs.cpSync(post.dir, out, { recursive: true }); // images and the Markdown source
    write(path.join(out, 'index.html'), renderPost(post));
  }
  // After the assets and projects are copied: the section writes into dist/
  // and, while it is unpublished, removes its own files from a production build.
  const section = buildSection({
    outDir: OUT_DIR,
    posts,
    includeDrafts,
    site: SITE,
    layout,
    helpers: { escapeHtml, formatDate, postImage },
  });
  write(path.join(OUT_DIR, 'index.html'), renderIndex(posts));
  write(path.join(OUT_DIR, 'llms.txt'), renderLlmsTxt(posts, section.llms));
  write(path.join(OUT_DIR, 'feed.xml'), renderFeed(posts));
  write(
    path.join(OUT_DIR, '404.html'),
    layout({
      title: 'Not found',
      description: SITE.tagline,
      canonical: '/404',
      body: '      <h1>Not found</h1>\n      <p><a href="/">Back to all posts</a></p>',
    })
  );
  // Show raw JSONL data files in the browser instead of downloading them. A
  // drafts build is noindex on every response, data files and projects too.
  write(
    path.join(OUT_DIR, '_headers'),
    (includeDrafts ? '/*\n  X-Robots-Tag: noindex\n' : '') +
      '/posts/*.jsonl\n  Content-Type: text/plain; charset=utf-8\n' +
      section.headers
  );
  write(path.join(OUT_DIR, 'sitemap.xml'), renderSitemap(posts, section.sitemap));
  write(
    path.join(OUT_DIR, 'robots.txt'),
    includeDrafts
      ? 'User-agent: *\nDisallow: /\n'
      : `User-agent: *\nAllow: /\n\nSitemap: ${SITE.url}/sitemap.xml\n`
  );

  console.log(
    `Built ${posts.length} post(s) into ${path.relative(
      process.cwd(),
      OUT_DIR
    )}/${includeDrafts ? ' (drafts included)' : ''}`
  );
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.jsonl': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function serve(port = 8788) {
  http
    .createServer((req, res) => {
      const urlPath = decodeURIComponent(
        new URL(req.url, 'http://localhost').pathname
      );
      let file = path.join(OUT_DIR, path.normalize(urlPath));
      if (!file.startsWith(OUT_DIR)) return res.writeHead(403).end();
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
        // Match Cloudflare Pages, so relative links inside folders resolve.
        if (!urlPath.endsWith('/'))
          return res.writeHead(308, { location: `${urlPath}/` }).end();
        file = path.join(file, 'index.html');
      }
      const found = fs.existsSync(file);
      const target = found ? file : path.join(OUT_DIR, '404.html');
      res.writeHead(found ? 200 : 404, {
        'content-type':
          TYPES[path.extname(target)] || 'application/octet-stream',
      });
      fs.createReadStream(target).pipe(res);
    })
    .listen(port, () =>
      console.log(`Serving dist/ at http://localhost:${port}`)
    );
}

await build();
if (args.has('--serve')) serve(Number(process.env.PORT) || 8788);
