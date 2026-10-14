#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const metadata = path.basename(root) === 'web' ? path.dirname(root) : root;
const require = createRequire(path.join(root, 'frontend/package.json'));
const { build } = require('esbuild');
const verify = process.argv.includes('--verify');
const lock = JSON.parse(await fs.readFile(path.join(metadata, 'modules.lock.json'), 'utf8'));
const manifestPath = path.join(metadata, 'release.manifest.json');
const release = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
if (lock.format !== 1 || release.format !== 1 || !Array.isArray(lock.modules)) throw new Error('Invalid release metadata');
const modules = [];
const forbidden = /(^|\/)(?:\.env(?:\.|$)|\.git|node_modules|dist)|\.(?:pem|key|log|ndjson)$/i;
async function copyAssets(source, destination) {
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    if (entry.isSymbolicLink() || forbidden.test(entry.name)) throw new Error('Private or linked module asset');
    const from = path.join(source, entry.name); const to = path.join(destination, entry.name);
    if (entry.isDirectory()) { await fs.mkdir(to, { recursive: true }); await copyAssets(from, to); }
    else { if ((await fs.stat(from)).size > 2 * 1024 * 1024) throw new Error('Oversized module asset'); await fs.copyFile(from, to); }
  }
}
async function hashes(directory, prefix = '') {
  const result = {};
  for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((a,b)=>a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    if (entry.isSymbolicLink()) throw new Error('Linked module artifact');
    const name = prefix + entry.name; const file = path.join(directory, entry.name);
    if (entry.isDirectory()) Object.assign(result, await hashes(file, name + '/'));
    else result[name] = createHash('sha256').update(await fs.readFile(file)).digest('hex');
  }
  return result;
}
for (const approved of lock.modules) {
  if (!/^[a-z][a-z0-9-]{2,38}$/.test(approved.id) || !/^[a-f0-9]{40}$/.test(approved.commit) || !/^\d+\.\d+\.\d+$/.test(approved.version)) throw new Error('Unverified module provenance');
  const source = path.join(root, 'modules', approved.id);
  const moduleManifest = JSON.parse(await fs.readFile(path.join(source, 'module.manifest.json'), 'utf8'));
  if (moduleManifest.id !== approved.id || !moduleManifest.chat || !moduleManifest.entry?.backend) throw new Error('Invalid SDK manifest');
  const entry = path.resolve(source, moduleManifest.entry.backend);
  if (!entry.startsWith(source + path.sep) || forbidden.test(path.relative(source, entry)) || (await fs.lstat(entry)).isSymbolicLink()) throw new Error('Module entry outside approved source');
  const destination = path.join(root, 'backend/dist/modules/community/installed', approved.id);
  await fs.rm(destination, { recursive: true, force: true }); await fs.mkdir(path.join(destination, 'backend'), { recursive: true });
  const output = path.join(destination, 'backend/index.js');
  await build({ entryPoints: [entry], absWorkingDir: root, outfile: output, bundle: true, platform: 'node', target: 'node22', format: 'esm', sourcemap: false, external: ['@luxipanel/module-sdk'] });
  const sdk = path.relative(path.dirname(output), path.join(root, 'backend/dist/shared/module-sdk/index.js')).split(path.sep).join('/');
  await fs.writeFile(output, (await fs.readFile(output, 'utf8')).replaceAll('"@luxipanel/module-sdk"', JSON.stringify(sdk.startsWith('.') ? sdk : './' + sdk)));
  const stamped = { ...moduleManifest, ...approved.manifest, id: approved.id, version: approved.version, entry: { ...moduleManifest.entry, backend: 'backend/index.js' } };
  await fs.writeFile(path.join(destination, 'module.manifest.json'), JSON.stringify(stamped, null, 2) + '\n');
  try { await fs.mkdir(path.join(destination, 'frontend'), { recursive: true }); await copyAssets(path.join(source, 'frontend'), path.join(destination, 'frontend')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const files = await hashes(destination);
  if (verify) {
    const expected = release.modules.find((module) => module.id === approved.id);
    if (!expected || expected.version !== approved.version || expected.commit !== approved.commit || JSON.stringify(Object.entries(expected.files).sort()) !== JSON.stringify(Object.entries(files).sort())) throw new Error('Built module differs from approved release');
  }
  modules.push({ id: approved.id, version: approved.version, versionId: approved.versionId, commit: approved.commit, prNumber: approved.prNumber, files });
}
if (verify && release.modules.length !== modules.length) throw new Error('Release module set mismatch');
if (!verify) await fs.writeFile(manifestPath, JSON.stringify({ ...release, modules }, null, 2) + '\n');
console.log(`Verified ${modules.length} official modules in LUXIPANEL ${release.version}`);
