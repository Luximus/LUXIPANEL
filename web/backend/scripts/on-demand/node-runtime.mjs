// SPDX-License-Identifier: AGPL-3.0-only
// Shared infrastructure preload; no application routes, credentials or models.
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { channel } from 'node:diagnostics_channel';
import { readFileSync, fstatSync } from 'node:fs';
import { promisify } from 'node:util';

export class IdleController {
  constructor({ idleMs = 60_000, onIdle, now = Date.now } = {}) {
    if (!Number.isFinite(idleMs) || idleMs < 1) throw new Error('invalid_idle_timeout');
    this.idleMs = idleMs;
    this.onIdle = onIdle;
    this.now = now;
    this.leases = new Set();
    this.stopped = false;
    this.arm();
  }
  arm() {
    clearTimeout(this.timer);
    if (!this.stopped && !this.leases.size) {
      this.timer = setTimeout(() => {
        if (this.stopped || this.leases.size) return;
        this.stopped = true;
        this.onIdle?.();
      }, this.idleMs);
      this.timer.unref();
    }
  }
  hold(label = 'work') {
    if (this.stopped) throw new Error('runtime_stopping');
    const lease = { label };
    this.leases.add(lease);
    clearTimeout(this.timer);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.leases.delete(lease);
      this.arm();
    };
  }
  close() {
    this.stopped = true;
    clearTimeout(this.timer);
  }
}

/** Track response lifetime, including streaming and client cancellation. */
export function trackServer(server, activity) {
  const leases = new Set();
  const hold = label => {
    const release = activity.hold(label);
    const done = () => { release(); leases.delete(done); };
    leases.add(done);
    return done;
  };
  const request = (req, res) => {
    const done = hold('http');
    res.once('finish', done);
    res.once('close', done);
  };
  const upgrade = (req, socket) => {
    const done = hold('websocket');
    socket.once('close', done);
    socket.once('end', done);
    socket.once('error', done);
  };
  // Gate before EventEmitter dispatch: a prepend listener cannot prevent
  // application handlers from accepting work after shutdown has begun.
  const emit = server.emit;
  function gatedEmit(event, ...args) {
    if (activity.stopped && event === 'request') {
      const [, res] = args;
      res.writeHead(503, { 'Connection': 'close', 'Retry-After': '1', 'Content-Type': 'application/json' });
      res.end('{"error":"runtime_stopping"}');
      return true;
    }
    if (activity.stopped && event === 'upgrade') {
      args[1].end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\nRetry-After: 1\r\nContent-Length: 0\r\n\r\n');
      return true;
    }
    return emit.call(this, event, ...args);
  }
  server.emit = gatedEmit;
  server.prependListener('request', request);
  server.prependListener('upgrade', upgrade);
  return () => {
    if (server.emit === gatedEmit) server.emit = emit;
    server.off('request', request);
    server.off('upgrade', upgrade);
    for (const done of [...leases]) done();
  };
}

/** Preserve Node's Promise result shape and .child while tracking its lifetime. */
export function trackChildOperation(original, activity) {
  const wrap = (operation, childFromResult) => function (...args) {
    const done = activity.stopped ? () => {} : activity.hold('child');
    try {
      const result = operation.apply(this, args);
      const child = childFromResult(result);
      child.once('close', done);
      child.once('error', done);
      return result;
    } catch (error) { done(); throw error; }
  };
  const wrapped = wrap(original, result => result);
  // exec/execFile's custom promisifiers resolve { stdout, stderr }, not stdout.
  // Copying their function alone would bypass activity tracking in Promise use.
  if (original[promisify.custom]) {
    Object.defineProperty(wrapped, promisify.custom, {
      value: wrap(original[promisify.custom], result => result.child),
      configurable: true,
    });
  }
  return wrapped;
}

export function activateRuntime(env = process.env) {
  if (env.DEMAND_RUNTIME_ENABLED !== '1') return null;
  if (env.DEMAND_ENV_FILE) {
    const vars = JSON.parse(readFileSync(env.DEMAND_ENV_FILE, 'utf8'));
    for (const [key, value] of Object.entries(vars)) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || typeof value !== 'string') continue;
      // systemd's socket identity and the trusted launcher configuration win.
      if (key.startsWith('LISTEN_') || key.startsWith('DEMAND_') || key === 'NODE_OPTIONS') continue;
      env[key] = value;
    }
  }
  if (Number(env.LISTEN_PID) !== process.pid || Number(env.LISTEN_FDS) !== 1 || !fstatSync(3).isSocket()) {
    throw new Error('demand_runtime_requires_one_systemd_socket');
  }
  const port = Number(env.DEMAND_SOCKET_PORT);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('invalid_demand_port');
  const idleMs = Number(env.DEMAND_IDLE_MS || 60_000);
  let primary;
  let activated = false;
  const activity = new IdleController({ idleMs, onIdle() {
    process.stdout.write('demand_runtime_idle\n');
    primary?.closeIdleConnections?.();
    if (process.listenerCount('SIGTERM')) process.emit('SIGTERM');
    else primary?.close(() => process.exit(0));
    // Only reached with zero tracked work. Ensure idle DB pools cannot pin RAM.
    setTimeout(() => process.exit(0), 10_000).unref();
  } });
  // Application bootstrap must finish before its idle clock starts.
  const bootDone = activity.hold('bootstrap');
  const bootDeadline = setTimeout(() => {
    process.stderr.write('demand_runtime_start_timeout\n');
    process.exit(1);
  }, Number(env.DEMAND_START_MS || 30_000));
  bootDeadline.unref();
  const originalListen = net.Server.prototype.listen;
  net.Server.prototype.listen = function (...args) {
    const arg = args[0];
    const requested = typeof arg === 'object' ? Number(arg?.port) : Number(arg);
    if (!activated && requested === port) {
      activated = true;
      primary = this;
      if (!(this instanceof http.Server) && !(this instanceof https.Server)) throw new Error('demand_socket_requires_http_server');
      trackServer(this, activity);
      this.once('listening', () => {
        clearTimeout(bootDeadline);
        bootDone();
        process.stdout.write('demand_runtime_ready\n');
      });
      const callback = typeof args.at(-1) === 'function' ? args.at(-1) : undefined;
      return originalListen.call(this, { fd: 3 }, ...(callback ? [callback] : []));
    }
    return originalListen.apply(this, args);
  };
  // Detached work started by an HTTP handler must also finish before shutdown.
  for (const name of ['spawn', 'fork', 'exec', 'execFile']) {
    childProcess[name] = trackChildOperation(childProcess[name], activity);
  }
  for (const library of [http, https]) {
    const original = library.request;
    library.request = function (...args) {
      const done = activity.stopped ? () => {} : activity.hold('outbound_http');
      try {
        const request = original.apply(this, args);
        request.once('close', done);
        request.once('error', done);
        return request;
      } catch (error) { done(); throw error; }
    };
  }
  const requests = new WeakMap();
  channel('undici:request:create').subscribe(({ request }) => requests.set(request, activity.stopped ? () => {} : activity.hold('fetch')));
  const finish = ({ request }) => { requests.get(request)?.(); requests.delete(request); };
  channel('undici:request:trailers').subscribe(finish);
  channel('undici:request:error').subscribe(finish);
  globalThis[Symbol.for('luxisoft.demand.runtime')] = activity;
  syncBuiltinESMExports();
  return activity;
}

activateRuntime();
