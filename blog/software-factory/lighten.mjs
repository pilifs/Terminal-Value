// What the section ships of its own scripts and stylesheet: the same code with
// its full-line comments blanked. About a fifth of their gzipped weight is
// comments, written for the next reader of the source and not for a browser.
//
// A blanked line stays as an empty line, so a line number in the browser is
// the line number in the source. Only whole lines go: a comment after code on
// its line is kept, since telling it from a `//` inside a string or a regular
// expression would take a parser. For the same reason this assumes what the
// sources keep to: no line inside a template literal starts with `//` or `/*`,
// and a block comment ends at the end of its line. The second is checked here;
// test/site-lighten.test.mjs checks both against a real parser.

/**
 * `text` with its full-line comments blanked. `kind` is 'js' or 'css': a
 * stylesheet has no `//` comments.
 */
export function withoutComments(text, kind) {
  let block = false;
  return text
    .split('\n')
    .map((line, i) => {
      const t = line.trim();
      if (block || t.startsWith('/*')) {
        const end = t.indexOf('*/', block ? 0 : 2);
        if (end !== -1 && end !== t.length - 2) throw new Error(`line ${i + 1}: a block comment ends before the end of its line`);
        block = end === -1;
        return '';
      }
      return kind === 'js' && t.startsWith('//') ? '' : line;
    })
    .join('\n');
}

/** The kind of a file this applies to, by its name, or null. */
export const kindOf = (file) => (/\.m?js$/.test(file) ? 'js' : file.endsWith('.css') ? 'css' : null);
