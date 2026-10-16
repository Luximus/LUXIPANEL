import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { copyRuntimeAssets, writeBuildRevision } from './copy-runtime-assets.mjs';
import { verifyRuntimeImports } from './verify-runtime-imports.mjs';
test('a fresh distribution includes handwritten JavaScript helpers and module manifests', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lxp-runtime-'));
  try {
    const src = path.join(root, 'src'), dist = path.join(root, 'dist');
    await fs.mkdir(src); await fs.mkdir(dist);
    await fs.writeFile(path.join(src, 'provider.mjs'), 'export const provider = {};');
    await fs.writeFile(path.join(src, 'module.manifest.json'), '{"id":"example"}');
    await fs.writeFile(path.join(src, '.env'), 'PRIVATE=private-test-value');
    await fs.writeFile(path.join(dist, 'route.js'), 'import {provider} from "./provider.mjs"; import("./provider.mjs");');
    await assert.rejects(verifyRuntimeImports(dist), /Missing runtime imports/);
    await copyRuntimeAssets(src, dist);
    await verifyRuntimeImports(dist);
    assert.equal(await fs.readFile(path.join(dist, 'module.manifest.json'), 'utf8'), '{"id":"example"}');
    await assert.rejects(fs.access(path.join(dist, '.env')));
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('a built revision stays pinned when the checkout advances', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lxp-revision-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  try {
    git('init'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.test');
    await fs.writeFile(path.join(root, 'source'), 'old'); git('add', 'source'); git('commit', '-m', 'initial');
    const built = git('rev-parse', 'HEAD'); await fs.mkdir(path.join(root, 'dist'));
    await writeBuildRevision(root, path.join(root, 'dist'));
    await fs.writeFile(path.join(root, 'source'), 'new'); git('add', 'source'); git('commit', '-m', 'new');
    assert.notEqual(git('rev-parse', 'HEAD'), built);
    assert.equal(JSON.parse(await fs.readFile(path.join(root, 'dist/build-info.json'), 'utf8')).commit, built);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
