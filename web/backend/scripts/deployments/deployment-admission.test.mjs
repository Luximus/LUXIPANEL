import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';

// Evaluate the actual runner with fake OS boundaries. No customer files,
// subprocesses, containers or resource limits are touched by these regressions.
const runner = await readFile(process.env.DEPLOYMENT_RUNNER_PATH ?? new URL('./deployment-tenant.mjs', import.meta.url), 'utf8');
const policy = await readFile(new URL('./runtime-policy.mjs', import.meta.url), 'utf8');
const missing = () => Object.assign(new Error('missing'), { code: 'ENOENT' });
async function admit({ resources = [{ name: 'database', engine: 'postgres' }],
  surface = 'http', disk = 10, maxDatabases = 4, digest, home = '/home/fixture' } = {}) {
  const commands = [], reads = [], archive = Buffer.from('owned source');
  const job = { projectId: 'a'.repeat(32), home, versionId: 'v1', requestId: 'r1',
    environment: 'preview', archive: archive.toString('base64'), limits: { diskMb: 100, maxDatabases },
    snapshot: { sourceDigest: digest ?? crypto.createHash('sha256').update(archive).digest('hex'),
      manifest: { resources, components: [{ name: 'application', surface, context: '.',
        recipe: 'FROM node:22', port: surface === 'http' ? 8080 : null }] } } };
  let output = '';
  const process = { getuid: () => 1003, env: { HOME: '/home/fixture' },
    stdin: (async function* () { yield JSON.stringify(job); })(),
    stdout: { write: value => { output += value; } }, exitCode: 0 };
  const fs = { mkdir: async () => {}, realpath: async value => value,
    stat: async () => { throw missing(); }, writeFile: async () => {},
    statfs: async () => ({ bavail: 1, bsize: 1 }),
    readFile: async file => {
      reads.push(file);
      if (file === '/proc/meminfo') return 'MemAvailable: 102400 kB\n';
      throw missing();
    } };
  const spawn = (bin, args) => {
    commands.push([bin, ...args]);
    if (bin === '/usr/bin/podman' && ['pull', 'build'].includes(args[0]))
      throw new Error('fixture_allocation_started');
    const child = new EventEmitter();
    child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
    child.kill = () => {}; child.stdin = { end: () => setImmediate(() => {
      const out = args.includes('/usr/bin/du') ? String(disk) :
        args[0] === 'ps' ? Array.from({ length: 4 }, (_, i) => 'running-' + i).join('\n') : '';
      if (out) child.stdout.emit('data', Buffer.from(out));
      child.emit('close', 0);
    }) };
    return child;
  };
  const context = createContext({ process, Buffer, setTimeout, clearTimeout, setImmediate });
  const modules = new Map();
  const dependencies = { 'node:fs/promises': { default: fs }, 'node:path': { default: path },
    'node:child_process': { spawn }, 'node:crypto': { createHash: crypto.createHash, randomBytes: crypto.randomBytes },
    'node:http': { default: {} }, 'node:net': { default: {} } };
  const main = new SourceTextModule(runner, { context });
  await main.link(async specifier => {
    if (!modules.has(specifier)) {
      if (specifier === './runtime-policy.mjs') modules.set(specifier, new SourceTextModule(policy, { context }));
      else {
        const exports = dependencies[specifier]; assert.ok(exports, specifier);
        modules.set(specifier, new SyntheticModule(Object.keys(exports), function () {
          for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
        }, { context }));
      }
    }
    return modules.get(specifier);
  });
  await main.evaluate();
  return { result: JSON.parse(output), commands, reads };
}

for (const [name, resources, surface] of [
  ['form with PostgreSQL', [{ name: 'database', engine: 'postgres' }], 'http'],
  ['interactive application', [], 'http'],
  ['API with MySQL', [{ name: 'database', engine: 'mysql' }], 'http'],
  ['service with Redis', [{ name: 'cache', engine: 'redis' }], 'http'],
  ['background worker', [], 'worker'],
  ['CLI with SQLite', [{ name: 'database', engine: 'sqlite' }], 'command'],
]) test(`${name}: starts allocation despite existing containers and low free-memory estimate`, async () => {
  const { result, commands, reads } = await admit({ resources, surface });
  assert.equal(result.error, 'fixture_allocation_started');
  assert.ok(commands.some(cmd => cmd[1] === 'pull' || cmd[1] === 'build'));
  assert.ok(!commands.some(cmd => cmd[1] === 'ps'));
  assert.ok(!reads.includes('/proc/meminfo'));
});

test('disk and database quotas still reject before allocation', async () => {
  assert.equal((await admit({ disk: 101 })).result.error, 'disk_quota_exceeded');
  assert.equal((await admit({ maxDatabases: 0 })).result.error, 'database_quota_exceeded');
});
test('source integrity and runtime identity still reject before allocation', async () => {
  assert.equal((await admit({ digest: '0'.repeat(64) })).result.error, 'source_digest_mismatch');
  await assert.rejects(admit({ home: '/home/another-account' }), /invalid_runtime_identity/);
});
