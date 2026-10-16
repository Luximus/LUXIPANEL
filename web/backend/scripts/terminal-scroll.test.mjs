// Run separately from Vitest's threads: node --import tsx --test scripts/terminal-scroll.test.mjs
// Uses an isolated tmux server and a local terminal fixture; no accounts or APIs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { tmuxSessionArgs } from '../src/modules/terminal/services/tmux-command.ts';

const available = spawnSync('tmux', ['-V']).status === 0;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const quoteShell = (value) => `'${value.replaceAll("'", "'\\''")}'`;

test('lost mouse tracking retains wheel coordinates and never pages Codex', { skip: !available, timeout: 10000 }, async () => {
  const pty = createRequire(import.meta.url)('node-pty');
  const dir = mkdtempSync(join(tmpdir(), 'lxp-scroll-test-'));
  const socket = join(dir, 'tmux.sock');
  const session = 'lxp_scroll_test';
  const tmux = (...args) => execFileSync('tmux', ['-S', socket, ...args], { encoding: 'utf8' }).trim();
  const log = join(dir, 'input.jsonl');
  const app = join(dir, 'terminal.cjs');
  writeFileSync(log, '');
  writeFileSync(app, `
    process.title = 'codex';
    process.stdin.setRawMode(true);
    process.stdout.write('\\x1b[?1049h\\x1b[2J\\x1b[HREADY');
    process.stdin.on('data', data => {
      require('node:fs').appendFileSync(${JSON.stringify(log)}, JSON.stringify(data.toString())+'\\n');
      if (data.toString() === 'other') process.title = 'other-tui';
    });
  `);
  let client;
  try {
    client = pty.spawn('tmux', ['-S', socket, ...tmuxSessionArgs(session, '/bin/bash', true)], {
      name: 'xterm-256color', cols: 90, rows: 30, env: { ...process.env, TERM: 'xterm-256color' },
    });
    client.onData(() => {});
    await wait(300);
    const rootBindings = tmux('list-keys', '-T', 'root');
    client.write(`${quoteShell(process.execPath)} ${quoteShell(app)}\r`);
    for (let i = 0; i < 30; i++) {
      if (tmux('capture-pane', '-p', '-t', session).includes('READY')) break;
      await wait(50);
    }
    assert.match(tmux('capture-pane', '-p', '-t', session), /READY/);
    assert.equal(tmux('display-message', '-p', '-t', session, '#{alternate_on} #{mouse_any_flag}'), '1 0');
    const input = () => readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((s) => JSON.parse(s)).join('');
    const up = '\x1b[<64;15;10M';
    const down = '\x1b[<65;30;12M';
    client.write(up);
    client.write(down);
    client.write('draft');
    for (let i = 0; i < 30 && input().length < up.length + down.length + 5; i++) await wait(50);
    assert.equal(input(), up + down + 'draft');
    assert.equal(tmux('display-message', '-p', '-t', session, '#{pane_in_mode}'), '0');
    assert.equal(tmux('list-keys', '-T', 'root'), rootBindings);

    // Do not inject mouse escape sequences into an unrelated fullscreen app.
    client.write('other');
    for (let i = 0; i < 30; i++) {
      if (tmux('display-message', '-p', '-t', session, '#{pane_current_command}') === 'other-tui') break;
      await wait(50);
    }
    client.write(up);
    for (let i = 0; i < 30 && !input().endsWith('\x1b[5~'); i++) await wait(50);
    assert.ok(input().endsWith('other\x1b[5~'));
  } finally {
    client?.kill();
    try { tmux('kill-server'); } catch { /* already exited */ }
    rmSync(dir, { recursive: true, force: true });
  }
});
