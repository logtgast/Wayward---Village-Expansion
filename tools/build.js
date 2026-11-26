#!/usr/bin/env node
/* Rebuilds wayward-expanded.html from wayward-baseline.html + src/wayward-expansion.js */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'wayward-baseline.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'src/wayward-expansion.js'), 'utf8');
if (js.includes('</script') || js.includes('<!--')) {
  console.error('Unsafe sequence in module; refusing to inline.');
  process.exit(1);
}
const snippet = '<script>\n/* ==== Wayward Expansion (add-on module) \u2014 injected build; see README-EXPANSION.md ==== */\n' + js + '\n</script>\n';
if (!html.includes('</body>')) { console.error('No </body> in baseline.'); process.exit(1); }
if (html.includes('==== Wayward Expansion (add-on module)')) {
  console.error('Baseline already contains the expansion; use the pristine wayward-baseline.html.');
  process.exit(1);
}
fs.writeFileSync(path.join(root, 'wayward-expanded.html'), html.replace('</body>', snippet + '</body>'));
console.log('Wrote wayward-expanded.html (' + (html.length + snippet.length) + ' bytes)');
