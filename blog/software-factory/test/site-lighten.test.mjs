// What the section ships of its own scripts and stylesheet: the same code,
// without its full-line comments (lighten.mjs).
// Run: node --test blog/software-factory/test/site-lighten.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { kindOf, withoutComments } from '../lighten.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(HERE, '..', '..', 'assets', 'software-factory');
// What the build puts in the section's directory: its assets, and the measures module under a browser's name.
const SHIPPED = [
  ...fs
    .readdirSync(ASSETS)
    .filter((f) => kindOf(f))
    .map((f) => path.join(ASSETS, f)),
  path.join(HERE, '..', 'measures.mjs'),
];

test('full-line comments are blanked; every other line is kept as written, on its own line number', () => {
  const js = ['// A note.', 'const a = 1; // kept: it follows code', '  // indented', '/**', ' * A block.', ' */', "const url = 'https://example.invalid/*/x'; /* kept */", '  /* one line */', 'const b = `', '${a}`;', ''].join('\n');
  assert.equal(withoutComments(js, 'js'), ['', 'const a = 1; // kept: it follows code', '', '', '', '', "const url = 'https://example.invalid/*/x'; /* kept */", '', 'const b = `', '${a}`;', ''].join('\n'));
  // A stylesheet has no // comments: such a line is part of a rule.
  const css = ['/* A note', '   over two lines. */', 'a {', '  // not a comment in CSS', '  color: red; /* kept */', '}'].join('\n');
  assert.equal(withoutComments(css, 'css'), ['', '', 'a {', '  // not a comment in CSS', '  color: red; /* kept */', '}'].join('\n'));
  // Code after a block comment's end would be lost with its line: refused, with the line.
  assert.throws(() => withoutComments('/* a */ const x = 1;', 'js'), /line 1: a block comment ends before the end of its line/);
  assert.throws(() => withoutComments('/*\n a\n*/ b {}', 'css'), /line 3: /);
  assert.deepEqual(['app.js', 'measures.mjs', 'style.css', 'index.html', 'latest.json'].map(kindOf), ['js', 'js', 'css', null, null]);
});

test('every file the section ships is lighter and has as many lines as its source', () => {
  for (const file of SHIPPED) {
    const source = fs.readFileSync(file, 'utf8');
    const shipped = withoutComments(source, kindOf(file));
    assert.equal(shipped.split('\n').length, source.split('\n').length, file);
    assert.ok(shipped.length < source.length, `${file} has comments to drop`);
    assert.doesNotMatch(shipped, /^\s*\/\*\*/m, file);
  }
});

// The rule above reads lines, not code. A parser says whether it dropped only
// comments: minified, the source and what is shipped are the same text.
let esbuild = null;
try {
  esbuild = await import('esbuild');
} catch {
  // Not installed (it comes with wrangler): the lines are still checked above.
}

test('a parser finds the same code in every shipped file as in its source', { skip: esbuild ? false : 'needs esbuild, which comes with wrangler (npm ci)' }, () => {
  for (const file of SHIPPED) {
    const kind = kindOf(file);
    const source = fs.readFileSync(file, 'utf8');
    const minified = (text) => esbuild.transformSync(text, { loader: kind, minify: true, legalComments: 'none', format: kind === 'js' ? 'esm' : undefined }).code;
    assert.equal(minified(withoutComments(source, kind)), minified(source), file);
  }
});
