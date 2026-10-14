import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
export async function verifyRuntimeImports(root) {
  const missing = [];
  async function walk(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) { await walk(file); continue; }
      if (!/\.(?:mjs|cjs|js)$/.test(entry.name) || /\.(?:test|spec)\./.test(entry.name)) continue;
      const source = ts.createSourceFile(file, await fs.readFile(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
      const references = [];
      function visit(node) {
        const literal = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) ? node.moduleSpecifier :
          ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : null;
        if (literal && ts.isStringLiteral(literal) && literal.text.startsWith('.')) references.push(literal.text);
        ts.forEachChild(node, visit);
      }
      visit(source);
      for (const reference of references) {
        try { await fs.access(path.resolve(path.dirname(file), reference)); }
        catch { missing.push(path.relative(root, file) + ' → ' + reference); }
      }
    }
  }
  await walk(root);
  if (missing.length) throw new Error('Missing runtime imports:\n' + missing.join('\n'));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await verifyRuntimeImports(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist'));
  console.log('Runtime imports verified.');
}
