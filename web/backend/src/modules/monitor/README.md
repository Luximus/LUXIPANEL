# Monitor Module

Real-time system metrics, SSE stream, and configurable alert rules.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/monitor/system` | Required | Current system info (hostname, CPU, RAM, disk) |
| GET | `/api/monitor/stats` | Required | Quick dashboard stats (accounts, users, memory, load) |
| GET | `/api/monitor/history` | Required | Historical snapshots (`?range=1h|6h|24h|7d` or `?from=<ms>&to=<ms>`); `?resolution=chart` returns aggregated intervals, exact summaries, peaks and coverage metadata |
| GET | `/api/monitor/services` | Required | systemctl status for key services |
| GET | `/api/monitor/stream` | Required | **SSE** — live stats push every 5s |
| GET | `/api/monitor/alerts/rules` | Required | List alert rules |
| POST | `/api/monitor/alerts/rules` | Required + CSRF | Create alert rule |
| PUT | `/api/monitor/alerts/rules/:id` | Required + CSRF | Update, pause or mute an alert rule |
| DELETE | `/api/monitor/alerts/rules/:id` | Required + CSRF | Delete alert rule |
| GET | `/api/monitor/alerts/events` | Required | Alert event history (fired/resolved) |
| GET | `/api/monitor/watchdog` | Required | Auto-reboot watchdog: stored config + live unit status |
| PUT | `/api/monitor/watchdog` | Required + CSRF (admin) | Save thresholds and install/disable the on-box watchdog |

## Resource watchdog (auto-reboot)

Per-server policy stored in the `monitor/watchdog` sidecar (kv-store) and
materialized as a **root systemd unit on the CLIENT server**
(`luxipanel-resource-watchdog`, script at
`/usr/local/lib/luxipanel/resource-watchdog.sh`). The on-box loop samples
`/proc/stat` + `/proc/meminfo` every `intervalSeconds`; when CPU and/or RAM
stays **at/above** the configured maximum for `sustainedSeconds`, it records
the reason in `/var/lib/luxipanel/resource-watchdog/state.json`, logs to
`/var/log/luxipanel-resource-watchdog.log` and runs `systemctl reboot`.
Because it runs on-box it keeps working with no panel session.

Safety rails: sustained window (min 2 samples), boot grace
(`bootGraceMinutes`, prevents reboot loops) and a persisted cooldown
(`cooldownMinutes`) between watchdog reboots. Thresholds are capped to
50–100 %. Mutation is admin-only (HTTP and the `monitor.watchdog_configure`
agent tool, which carries `permission: "admin"`); install/update goes through
`applyStepsLive` (SFTP-tmp + `sudo cp` + `systemctl` via sudo argv).
The Monitor settings drawer exposes sampling interval, boot grace and cooldown
in addition to the CPU/RAM thresholds on the main card.

## SSE Stream

Connect to `/api/monitor/stream` from the frontend:

```javascript
const sse = new EventSource("/api/monitor/stream", { withCredentials: true });

sse.addEventListener("stats", (e) => {
  const snapshot = JSON.parse(e.data);
  console.log(snapshot.cpu.usage); // e.g. 12.5 (%)
});

sse.addEventListener("alert:firing", (e) => {
  const alert = JSON.parse(e.data);
  console.log(`ALERT: ${alert.name} — ${alert.metric} = ${alert.value}`);
});

sse.addEventListener("alert:resolved", (e) => {
  // alert cleared
});
```

Events emitted: `connected`, `stats` (every 5s), `alert:firing`, `alert:resolved`

## Stats Snapshot Format

```typescript
{
  ts: number;             // Unix ms
  cpu: {
    usagePercent: number; // CPU usage % (delta between two /proc/stat reads)
    loadAvg1m: number;
    loadAvg5m: number;
    loadAvg15m: number;
  };
  memory: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usagePercent: number;
  };
  disk: {
    totalBytes: number;
    usedBytes: number;
    availableBytes: number;
    usagePercent: number;
  };
  network: {
    rxBytesPerSec: number;
    txBytesPerSec: number;
  };
  uptime: number;         // seconds
  topProcesses?: {        // audit captured with the sample
    cpu: Array<{ pid: number; name: string; cpu: number; mem: number }>;
    mem: Array<{ pid: number; name: string; cpu: number; mem: number }>;
  };
}
```

## History charts

History and Processes are tabs in one section above Service status and
Automatic restart. History offers 1h, 6h, 24h, and 7d ranges; CPU, RAM, disk,
and network filters; and a previous-period comparison. The chart uses exact
sample averages in 1-minute, 5-minute, 15-minute and 2-hour intervals,
respectively. Peak markers retain the original audited snapshot. Missing
intervals break the line, and a coverage strip shows which parts of the
requested period actually have samples. Summary cards use all stored samples
in the window, including those omitted from the chart payload. Network has its
own bytes-per-second scale.

Clicking an interval or peak opens the Processes tab at its nearest recorded
sample. A selector in that tab lets the operator choose another available
interval or return to live processes. Historical rows contain only the
processes audited with that sample (PID, name, CPU %, RAM %); they cannot be
terminated, and fields not captured historically are hidden. Older samples
audited the top 5 CPU and top 5 RAM processes; new samples audit the top 25 of
each. The live table continues to load up to 100 processes from the current
server.

The first column of both process views opens a new AI Assistant conversation
about that row. It includes the observed PID, process name, CPU/RAM use and
sample timestamp. Historical questions are labeled as past observations and
do not assume the PID still exists. The top overview groups CPU, RAM and
network in one card; disk stays separate, with additional server uptime/load
and top CPU/RAM process cards.

The collector refreshes live metrics every 10 seconds and persists at most one
history sample per minute per server scope. Redis retains history for 14 days,
allowing a 7-day period to be compared with the previous 7 days once enough
history has accumulated. The legacy snapshot response selects up to 1,200
points from long windows. The `resolution=chart` response returns bounded
aggregate intervals, exact summaries and up to six peak snapshots per metric.
Older history cannot be recovered retroactively after this retention change.

## Alert Rules

The Monitor settings drawer supports creating, editing, pausing and deleting
rules. A rule can mute delivery for one or 24 hours (`mutedUntil`) while its
condition and event history continue to be evaluated. The Webhooks module can
route `alert.firing` and `alert.resolved` events to configured destinations.
The background collector evaluates local rules with the explicit local executor;
remote rules use their connected target's executor. A paused/deleted rule's
firing state is cleared on the next collection.

Supported metrics:

| Metric | Description |
|--------|-------------|
| `cpu_usage_percent` | CPU usage % |
| `memory_usage_percent` | RAM usage % |
| `disk_usage_percent` | Disk usage % |
| `load_avg_1m` | 1-minute load average |
| `load_avg_5m` | 5-minute load average |
| `rx_bytes_per_sec` | Network receive rate |
| `tx_bytes_per_sec` | Network transmit rate |

Operators: `gt`, `lt`, `gte`, `lte`

`sustainedSamples` prevents false positives from transient spikes — the rule only fires after N consecutive samples exceed the threshold.

The settings drawer stores each user's view defaults separately per target:
history range, metric, period comparison and refresh cadence, plus live process
refresh cadence. History export is CSV of the aggregate chart intervals, not a
reconstruction of individual snapshots or missing periods. Diagnostics shows
the latest snapshot and process update alongside sample count/coverage for the
last hour.

### Example: alert when CPU > 90% for 3 consecutive minutes

```json
{
  "name": "CPU Critical",
  "metric": "cpu_usage_percent",
  "operator": "gt",
  "threshold": 90,
  "sustainedSamples": 3
}
```

## Architecture

> **Execution boundary (hard rule, CLAUDE.md):** the monitor module runs NO
> `node:child_process`. Every metric read goes through an `Executor` — SSH for
> a remote target, the panel-host `localExecutor` for the box the panel runs on.
> `systemStatsService.collect()` is a thin wrapper over `collectWithExecutor(
> localExecutor)`, so local and remote share ONE aggregated command and ONE set
> of pure parsers (`_sumNetDev`/`_parsePsLines`/`_parseProcStat`/`_parseDfLine`).
> `resolveMonitorExecutor` fails **closed**: a remote (direct) session whose SSH
> bridge expired throws `NO_SERVER_EXECUTOR` — it never falls back to sampling
> the panel host under the target's session (cross-tenant leak). Likewise the
> `processes`/`services` endpoints serve a remote target's empty result as-is,
> never back-filled from `localExecutor`.

```
Stats flow:
  statsCollectorService._collect()       ← runs every 10s (INTERVAL_MS)
    → systemStatsService.collect()       ← collectWithExecutor(localExecutor):
                                             one `sh -lc` reading /proc/stat,
                                             /proc/meminfo, df, /proc/net/dev, ps
    → Redis ZSET (monitor:snapshots:{scope}) ← 14d, at most 1 sample/minute
    → Redis STRING (monitor:latest:{scope})  ← refreshed every collection, 24h TTL
  collectWithExecutor(remote target)
    → same snapshot collection and persistence, under the target scope
    → alertEvaluatorService.evaluate()   ← evaluates that target's rules
        → alertRepository.createEvent()  ← on fire
        → eventBus.emit("alert:firing")
        → sseService.broadcastAlert()    ← pushes to SSE clients

SSE flow:
  sseService.attach(req, res)            ← called on /api/monitor/stream
    → sends "connected" event
    → sends current snapshot immediately
    → setInterval every 5s → sends "stats" event
    → client receives alert events via broadcastAlert()
```

## Bootstrap

The stats collector is started in `server.ts` **before** modules are registered:
```typescript
statsCollectorService.start();
```

The alert evaluator is wired after registration:
```typescript
// in modules/monitor/index.ts:
statsCollectorService.setAlertEvaluator(alertEvaluatorService);
```
