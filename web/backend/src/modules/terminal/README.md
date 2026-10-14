# Terminal Module

WebSocket-based PTY terminal — runs a real shell on the server, streamed to the browser.

## Requirements

- `TERMINAL_ENABLED=true` in `.env`
- `node-pty` npm package (native — requires build tools at install time)
- Admin-kind users only (requires `kind: "admin"` in JWT payload)

## WebSocket Protocol

Connect to `ws://host/api/terminal/ws?token=<jwt>` (or pass token as cookie).

### Client → Server messages (JSON)

```json
{ "type": "input", "data": "ls -la\n" }
{ "type": "resize", "cols": 120, "rows": 35 }
{ "type": "ping" }
```

### Server → Client messages (JSON)

```json
{ "type": "connected", "sessionId": "uuid", "pid": 12345 }
{ "type": "output", "data": "total 48\n..." }
{ "type": "pong" }
{ "type": "exit", "code": 0, "reason": "process-exit" }
{ "type": "error", "message": "Authentication required" }
```

## Frontend Integration

```javascript
const ws = new WebSocket(`wss://panel.example.com/api/terminal/ws?token=${jwt}`);
const term = new Terminal(); // xterm.js
term.open(document.getElementById("terminal"));

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === "output") term.write(msg.data);
  if (msg.type === "exit") ws.close();
};

term.onData((data) => {
  ws.send(JSON.stringify({ type: "input", data }));
});

// Send resize when terminal dimensions change
const fitAddon = new FitAddon();
term.loadAddon(fitAddon);
fitAddon.fit();
ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
```

## HTTP Endpoints (admin management)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/terminal/sessions` | List active PTY sessions |
| DELETE | `/api/terminal/sessions/:sessionId` | Force-close a session |

## Security

- **Admin only** — `kind: "admin"` checked before spawning PTY
- **Shell allowlist** — only `/bin/bash`, `/bin/sh`, `/usr/bin/bash`, `/usr/bin/sh` are accepted
- **Session limit** — max `TERMINAL_MAX_SESSIONS` concurrent sessions (default: 5)
- **Idle timeout** — sessions inactive for `TERMINAL_IDLE_TIMEOUT_MS` (default: 30min) are killed
- **Graceful cleanup** — all sessions killed on server shutdown via `stopTerminalModule()`

## Config

| Env var | Default | Description |
|---------|---------|-------------|
| `TERMINAL_ENABLED` | `false` | Must be `true` to activate |
| `TERMINAL_MAX_SESSIONS` | `5` | Max concurrent PTY sessions |
| `TERMINAL_IDLE_TIMEOUT_MS` | `1800000` | 30-minute idle timeout |
| `TERMINAL_SHELL` | `/bin/bash` | Shell to spawn (must be in allowlist) |

## Architecture

```
HTTP upgrade request → server.ts "upgrade" event handler
  → url pathname check (/api/terminal/ws)
  → ws.handleUpgrade()
  → handleTerminalConnection(ws, req)
      → extractToken() → tokenService.verify()
      → kind === "admin" check
      → spawnPty() → node-pty.spawn()
      → sessionManagerService.add()
      → pty.onData → ws.send({ type: "output" })
      → ws.on("message") → pty.write / pty.resize
      → ws.on("close") → sessionManagerService.close()
      → pty.onExit → ws.send({ type: "exit" })
```

## Nginx configuration

The WebSocket endpoint requires `Upgrade` header forwarding in Nginx (handled by `setup-nginx.sh`):

```nginx
location /api/terminal/ws {
    proxy_pass http://luxipanel_backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
}
```
