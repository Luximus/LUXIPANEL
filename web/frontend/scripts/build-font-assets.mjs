import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const files = ['inter-400.ttf', 'inter-700.ttf', 'jetbrains-mono-400.ttf', 'jetbrains-mono-600.ttf', 'chakra-petch-v12-latin-700.woff2'];
const urls = {};
mkdirSync(path.join(root, 'public/_luxi/fonts'), { recursive: true });
for (const file of files) {
  const data = readFileSync(path.join(root, 'public/fonts', file));
  const ext = path.extname(file), name = path.basename(file, ext);
  const version = createHash('sha256').update(data).digest('hex').slice(0, 12);
  const url = `/_luxi/fonts/${name}.${version}${ext}`;
  copyFileSync(path.join(root, 'public/fonts', file), path.join(root, 'public', url));
  urls['/fonts/' + file] = url;
  for (const css of ['src/styles/starwind/fonts.css', 'src/styles/panel-workspace.css']) {
    const target = path.join(root, css), before = readFileSync(target, 'utf8');
    const next = before.replace(new RegExp(`/(?:fonts/${file.replaceAll('.', '\\.')}|_luxi/fonts/${name}\\.[a-f0-9]+${ext.replaceAll('.', '\\.')})`, 'g'), url);
    if (before !== next) writeFileSync(target, next);
  }
}
writeFileSync(path.join(root, 'scripts/generated-font-urls.json'), JSON.stringify(urls));
