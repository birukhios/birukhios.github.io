// Extract the hardcoded content arrays from index.html into content/*.json
// by evaluating the script prelude, so prefix consts (CR +, AD + ...) resolve.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = '/Users/biruk/Documents/portfolio';
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// pull the dc script block
const m = html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
if (!m) throw new Error('dc script block not found');
const script = m[1];

// everything before the component class = the data prelude
const cut = script.indexOf('class Component extends DCLogic');
if (cut === -1) throw new Error('Component class not found');
const prelude = script.slice(0, cut);

const COLLECTIONS = {
  'projects':    'P',
  'posters':     'POSTERS',
  'branding':    'BRANDING',
  'mood':        'MOOD',
  'sites':       'SITES',
  'sites-more':  'SITES_MORE',
  'services':    'SERVICES',
  'education':   'EDU',
  'experience':  'EXPERIENCE',
  'process':     'PROCESS',
};

const sandbox = { window: {}, document: {}, console };
vm.createContext(sandbox);
vm.runInContext(prelude, sandbox, { timeout: 5000 });
// expose the consts (they're block-scoped in the script, so re-read via expression)
const values = vm.runInContext(
  '({' + Object.values(COLLECTIONS).map(v => `${v}: typeof ${v} !== 'undefined' ? ${v} : null`).join(',') + '})',
  sandbox
);

const outDir = path.join(ROOT, 'content');
fs.mkdirSync(outDir, { recursive: true });

let total = 0;
for (const [file, varName] of Object.entries(COLLECTIONS)) {
  const val = values[varName];
  if (!val) { console.log(`  SKIP ${varName} (undefined)`); continue; }
  const dest = path.join(outDir, file + '.json');
  // wrapped as { items: [...] } so Sveltia/Decap file collections can map to it
  fs.writeFileSync(dest, JSON.stringify({ items: val }, null, 2) + '\n');
  console.log(`  ${varName.padEnd(11)} -> content/${file}.json  (${val.length} entries, ${(fs.statSync(dest).size/1024).toFixed(1)} KB)`);
  total += val.length;
}
console.log(`\ntotal entries: ${total}`);
