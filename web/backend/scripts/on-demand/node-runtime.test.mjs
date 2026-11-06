import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { once } from 'node:events';
import { exec, execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { IdleController, trackServer, trackChildOperation } from './node-runtime.mjs';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

for (const [name, operation, args] of [
  ['exec', exec, ["printf 'account'; printf 'diagnostic' >&2"]],
  ['execFile', execFile, [process.execPath, ['-e', "process.stdout.write('account'); process.stderr.write('diagnostic')"]]],
]) {
  test(`${name} preserves promisified stdout/stderr and tracks the child until close`, async () => {
    const activity = new IdleController({ idleMs: 1000 });
    try {
      // Node may already have cached a self-referential custom promisifier.
      promisify(operation);
      const promise = promisify(trackChildOperation(operation, activity))(...args);
      assert.ok(promise.child?.pid);
      assert.equal(activity.leases.size, 1);
      const closed = once(promise.child, 'close');
      assert.deepEqual(await promise, { stdout: 'account', stderr: 'diagnostic' });
      await closed;
      assert.equal(activity.leases.size, 0);
    } finally { activity.close(); }
  });
}

test('promisified command failure preserves exit code and both output streams', async () => {
  const activity = new IdleController({ idleMs: 1000 });
  try {
    const promise = promisify(trackChildOperation(execFile, activity))(process.execPath,
      ['-e', "process.stdout.write('partial'); process.stderr.write('failed'); process.exitCode=7"]);
    const closed = once(promise.child, 'close');
    await assert.rejects(promise, error => error.code === 7 && error.stdout === 'partial' && error.stderr === 'failed');
    await closed;
    assert.equal(activity.leases.size, 0);
  } finally { activity.close(); }
});

test('callback commands and spawned children retain tracking and their return values', async () => {
  const activity = new IdleController({ idleMs: 1000 });
  try {
    let child;
    const result = new Promise((resolve, reject) => {
      child = trackChildOperation(execFile, activity)(process.execPath, ['-e', "process.stdout.write('callback')"],
        (error, stdout) => error ? reject(error) : resolve(stdout));
    });
    const closed = once(child, 'close');
    assert.equal(await result, 'callback');
    await closed;
    const spawned = trackChildOperation(spawn, activity)(process.execPath, ['-e', '']);
    assert.equal(activity.leases.size, 1);
    await once(spawned, 'close');
    assert.equal(activity.leases.size, 0);
  } finally { activity.close(); }
});

test('synchronous spawn errors release their activity reservation', () => {
  const activity = new IdleController({ idleMs: 1000 });
  try {
    assert.throws(() => trackChildOperation(execFile, activity)(null));
    assert.equal(activity.leases.size, 0);
  } finally { activity.close(); }
});

test('idle deadline waits for all work and idempotent releases', async () => {
  let stops = 0;
  const activity = new IdleController({ idleMs: 20, onIdle: () => stops++ });
  const first = activity.hold('first'), second = activity.hold('second');
  await pause(35);
  assert.equal(stops, 0);
  first(); first();
  await pause(35);
  assert.equal(stops, 0);
  second();
  await pause(35);
  assert.equal(stops, 1);
  activity.close();
});

test('streaming response prevents stop until the response completes', async () => {
  let stops = 0, finish;
  const activity = new IdleController({ idleMs: 25, onIdle: () => stops++ });
  const server = http.createServer((req, res) => { res.write('start'); finish = () => res.end('end'); });
  const untrack = trackServer(server, activity);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const request = http.get(`http://127.0.0.1:${server.address().port}`);
  const [response] = await once(request, 'response'); response.resume();
  await pause(60); assert.equal(stops, 0);
  finish(); await once(response, 'end');
  await pause(40); assert.equal(stops, 1);
  untrack(); activity.close(); server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
});

test('websocket lifetime prevents idle shutdown even without messages', async () => {
  let stops = 0, upgraded;
  const activity = new IdleController({ idleMs: 25, onIdle: () => stops++ });
  const server = http.createServer();
  const untrack = trackServer(server, activity);
  server.on('upgrade', (_req, socket) => { upgraded = socket; socket.write('HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: test\r\n\r\n'); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const client = net.connect(server.address().port, '127.0.0.1');
  client.write('GET /socket HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: test\r\n\r\n');
  await once(client, 'data'); await pause(60); assert.equal(stops, 0);
  upgraded.destroy(); client.destroy(); await pause(50); assert.equal(stops, 1);
  untrack(); activity.close(); await new Promise(resolve => server.close(resolve));
});

test('client cancellation releases work without retaining timers', async () => {
  let stops = 0;
  const activity = new IdleController({ idleMs: 20, onIdle: () => stops++ });
  const server = http.createServer((_req, res) => res.write('pending'));
  const untrack = trackServer(server, activity);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const request = http.get(`http://127.0.0.1:${server.address().port}`);
  const [response] = await once(request, 'response');
  response.destroy(); await pause(50); assert.equal(stops, 1);
  untrack(); activity.close(); server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
});


test('late HTTP requests during shutdown are rejected before application handlers', async () => {
  const activity = new IdleController({ idleMs: 60000 });
  let handled = 0;
  const server = http.createServer((_req, res) => { handled++; res.end('accepted'); });
  const untrack = trackServer(server, activity);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  activity.close();
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/`);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('retry-after'), '1');
    assert.deepEqual(await response.json(), { error: 'runtime_stopping' });
    assert.equal(handled, 0);
  } finally { untrack(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
