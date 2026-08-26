#!/usr/bin/env node
/* Rewrite colour literals INSIDE [style*="…"] selectors into the form browsers
 * actually serialise into the style attribute.
 *
 * The design source writes `background: #f3f2f2`, but React sets styles through
 * the CSSOM and the browser re-serialises them, so the live DOM contains
 * `background: rgb(243, 242, 242)`. Likewise `rgba(32,30,29,0.4)` becomes
 * `rgba(32, 30, 29, 0.4)` — with spaces. A selector written against the source
 * form silently matches nothing.
 *
 * Only the text inside [style*="…"] is touched; the declarations we *set* are
 * left alone.
 */
const fs = require('fs');

const hex = (h) => {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

const normalize = (s) =>
  s
    // #abc / #aabbcc -> rgb(r, g, b)
    .replace(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g, hex)
    // rgba(1,2,3,.4) -> rgba(1, 2, 3, 0.4)
    .replace(/rgba?\(([^)]*)\)/g, (m, inner) => {
      const parts = inner.split(',').map((p) => p.trim());
      const fn = parts.length === 4 ? 'rgba' : 'rgb';
      return `${fn}(${parts.join(', ')})`;
    });

let changed = 0;
for (const file of process.argv.slice(2)) {
  const src = fs.readFileSync(file, 'utf8');
  const out = src.replace(/\[style\*="([^"]+)"\]/g, (m, inner) => {
    const fixed = normalize(inner);
    if (fixed !== inner) { changed++; console.log(`  ${file}: ${inner}  ->  ${fixed}`); }
    return `[style*="${fixed}"]`;
  });
  if (out !== src) fs.writeFileSync(file, out);
}
console.log(changed ? `\nrewrote ${changed} selector(s)` : '\nnothing to change');
