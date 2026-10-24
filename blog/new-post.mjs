// Starts a new draft post from blog/templates/post.
//
//   npm run new -- <slug>

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BLOG_DIR = path.dirname(fileURLToPath(import.meta.url));
const slug = process.argv[2];

if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  console.error('Usage: npm run new -- <slug>   (lowercase words joined by -)');
  process.exit(1);
}
const dir = path.join(BLOG_DIR, 'posts', slug);
if (fs.existsSync(dir)) {
  console.error(`blog/posts/${slug} already exists.`);
  process.exit(1);
}

fs.cpSync(path.join(BLOG_DIR, 'templates', 'post'), dir, { recursive: true });
const file = path.join(dir, 'index.md');
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(
  file,
  fs.readFileSync(file, 'utf8').replace(/^date: .*$/m, `date: ${today}`)
);
console.log(`Created blog/posts/${slug}/ as a draft. Replace the example text and images.`);
