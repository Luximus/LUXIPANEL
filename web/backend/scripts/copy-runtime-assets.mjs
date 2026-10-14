import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export async function copyRuntimeAssets(source, destination) {
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || ['node_modules', '__fixtures__'].includes(entry.name) || /\.(?:test|spec)\./.test(entry.name)) continue;
    if (entry.isSymbolicLink()) throw new Error('Linked runtime asset: ' + entry.name);
    const from = path.join(source, entry.name), to = path.join(destination, entry.name);
    if (entry.isDirectory()) await copyRuntimeAssets(from, to);
    else if (/\.(?:mjs|cjs|js|json|sh|py)$/.test(entry.name)) {
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.copyFile(from, to);
    }
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  await copyRuntimeAssets(path.join(root, 'src'), path.join(root, 'dist'));
}
