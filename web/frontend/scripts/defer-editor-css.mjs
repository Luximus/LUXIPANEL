import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const entry = fileURLToPath(new URL('../dist/server/entry.mjs', import.meta.url));
const source = fs.readFileSync(entry, 'utf8');
const ast = ts.createSourceFile('entry.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
let metadata;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'deserializeManifest' && ts.isObjectLiteralExpression(node.arguments[0])) metadata = node.arguments[0];
  ts.forEachChild(node, visit);
}
visit(ast);
if (!metadata) throw new Error('Cannot locate Astro manifest to defer editor styles');
const manifest = JSON.parse(metadata.getText(ast));
let removed = 0;
// Vite's dynamic editor imports carry their CSS dependencies. An SSR layout
// reference should not preload Monaco into every page of the private panel.
for (const route of manifest.routes ?? []) {
  route.styles = (route.styles ?? []).filter(style => {
    const drop = style.type === 'external' && /^_luxi\/editor\.[\w-]+\.css$/.test(style.src ?? '');
    if (drop) removed++;
    return !drop;
  });
}
if (removed) fs.writeFileSync(entry, source.slice(0, metadata.getStart(ast)) + JSON.stringify(manifest) + source.slice(metadata.end));
console.log(`[defer-editor-css] ${removed} eager editor references removed; dynamic imports preserved.`);
