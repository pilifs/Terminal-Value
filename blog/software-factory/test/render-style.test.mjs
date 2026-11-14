// The section's stylesheet must not touch the rest of the site: every rule is
// scoped under body.software-factory. Run: npm run test:software-factory

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(HERE, '..', '..', 'assets', 'software-factory', 'style.css'), 'utf8');

/** Every selector list of a style rule, @media and similar blocks unwrapped. */
function selectors(source) {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const found = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      const prelude = text.slice(start, i).trim();
      if (!prelude.startsWith('@')) found.push(prelude);
      depth++;
      start = i + 1;
    } else if (text[i] === '}') {
      depth--;
      start = i + 1;
    } else if (text[i] === ';') {
      start = i + 1;
    }
  }
  assert.equal(depth, 0, 'balanced braces');
  return found;
}

/** Split a selector list on its top-level commas, not those inside :is() or :not(). */
function splitList(list) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    if (list[i] === '(') depth++;
    else if (list[i] === ')') depth--;
    else if (list[i] === ',' && depth === 0) {
      parts.push(list.slice(start, i));
      start = i + 1;
    }
  }
  return [...parts, list.slice(start)];
}

test('every rule in style.css is scoped under body.software-factory', () => {
  const lists = selectors(css);
  assert.ok(lists.length > 50, 'the stylesheet has rules');
  for (const list of lists) {
    for (const sel of splitList(list)) {
      assert.match(sel.trim(), /^body\.software-factory(?=$|[\s.:[>])/, `unscoped selector: ${sel.trim()}`);
    }
  }
});

test('style.css has a dark scheme and a phone layout', () => {
  assert.match(css, /@media \(prefers-color-scheme: dark\)/);
  assert.match(css, /@media \(max-width: 36rem\)/);
  assert.doesNotMatch(css, /verify-bytecode/);
});
