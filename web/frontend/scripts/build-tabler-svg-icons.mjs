import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const used = new Set(['ti-help-circle']);
function scan(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) scan(file);
    else if (/\.(?:astro|tsx?|css|js)$/.test(file) && !/\.test\./.test(file))
      for (const match of readFileSync(file, 'utf8').matchAll(/\bti-[a-z0-9-]+\b/g)) used.add(match[0]);
  }
}
scan(path.join(root, 'src'));
const xml = readFileSync(path.join(root, 'node_modules/@tabler/icons-webfont/dist/fonts/tabler-icons.svg'), 'utf8');
const css = readFileSync(path.join(root, 'node_modules/@tabler/icons-webfont/dist/tabler-icons.min.css'), 'utf8');
const paths = new Map();
for (const glyph of xml.matchAll(/<glyph\s+([\s\S]*?)\/>/g)) {
  const unicode = /unicode="&#x([\da-f]+);"/i.exec(glyph[1]);
  const d = /\bd="([^"]+)"/.exec(glyph[1]);
  if (unicode && d) paths.set(unicode[1].toLowerCase(), d[1].replace(/-?\d+\.\d+/g, n => String(Math.round(Number(n) * 100) / 100)));
}
const strokeNodes = JSON.parse(readFileSync(path.join(root, 'scripts/vendor/tabler-nodes-outline-3.44.0.json'), 'utf8'));
const escape = s => String(s).replaceAll('&', '&amp;').replaceAll('\"', '&quot;').replaceAll('<', '&lt;');
const rules = [];
for (const icon of css.matchAll(/\.(ti-[\w-]+):before\{content:"\\([\da-f]+)"\}/g)) {
  const d = paths.get(icon[2].toLowerCase());
  if (!d) continue;
  const nodes = strokeNodes[icon[1].slice(3)];
  const svg = nodes
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${nodes.map(([tag, attributes]) => `<${tag} ${Object.entries(attributes).map(([key, value]) => `${key}="${escape(value)}"`).join(' ')}/>`).join('')}</svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><path transform="translate(0 900) scale(1 -1)" d="${d}"/></svg>`;
  const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  rules.push({ name: icon[1], rule: `.${icon[1]}{--ti-svg:${url}}` });
}
const aliases = { 'ti-check-circle': 'ti-circle-check', 'ti-x-circle': 'ti-circle-x', 'ti-alert-circle': 'ti-alert-circle', 'ti-shield-alert': 'ti-shield-exclamation' };
for (const [name, target] of Object.entries(aliases)) {
  used.add(name);
  if (rules.some(icon => icon.name === name)) continue;
  const original = rules.find(icon => icon.name === target);
  if (original) rules.push({ name, rule: original.rule.replace('.' + target + '{', '.' + name + '{') });
}
const base = '/* Tabler Icons 3.44.0, MIT: https://github.com/tabler/tabler-icons/blob/master/LICENSE */\n.ti{display:inline-block;font-style:normal;font-weight:normal;line-height:1;vertical-align:-.125em}.ti:before{content:"";display:block;width:1em;height:1em;background-color:currentColor;mask:var(--ti-svg) center/contain no-repeat;-webkit-mask:var(--ti-svg) center/contain no-repeat}\n';
const critical = base + rules.filter(icon => used.has(icon.name)).map(icon => icon.rule).join('\n');
const full = base + rules.map(icon => icon.rule).join('\n');
writeFileSync(path.join(root, 'src/styles/tabler-svg.css'), critical);
writeFileSync(path.join(root, 'src/lib/tabler-svg-critical.json'), JSON.stringify(rules.filter(icon => used.has(icon.name)).map(icon => icon.name))); 
mkdirSync(path.join(root, 'public/icons'), { recursive: true });
writeFileSync(path.join(root, 'public/icons/tabler-svg-all.css'), full);
console.log(JSON.stringify({ icons: rules.length, initial: rules.filter(icon => used.has(icon.name)).length, initialGzipBytes: gzipSync(critical).length, fullGzipBytes: gzipSync(full).length }));
