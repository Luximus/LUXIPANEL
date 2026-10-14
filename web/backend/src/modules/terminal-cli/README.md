# Módulo `terminal-cli` — CLI de agente autostart en la terminal

Estado **por-usuario** de qué CLI de agente (Claude, Codex, Grok, …) se
autolanza en shells interactivos del **servidor conectado**, más la persistencia
del asistente de onboarding. Al activar un CLI se regenera un bloque gestionado
en el `~/.bashrc` del usuario PTY que hace `exec <cli>` al abrir una shell.

## Contrato

Todas las rutas: `requireAuth` + `requireModule("admin")` +
`requireViewPermission("panel.settings")` + `requireActionPermission("terminal.view")`.

| Método | Ruta | Permiso extra | Acción |
|---|---|---|---|
| GET  | `/api/terminal-cli/state` | `terminal.open` | Estado persistido (onboarding + installed/active) |
| GET  | `/api/terminal-cli/probe` | `terminal.open` | Sondea qué CLIs del catálogo están en PATH |
| POST | `/api/terminal-cli/installed` | `terminal.manage` | Marca/desmarca un CLI como instalado |
| POST | `/api/terminal-cli/active` | `terminal.manage` | Activa un CLI (reescribe `~/.bashrc`) |
| POST | `/api/terminal-cli/onboarding/complete` | `terminal.manage` | Cierra el wizard con `{ installed[], active }` |
| POST | `/api/terminal-cli/onboarding/skip` | `terminal.manage` | Salta el wizard |

## Invariantes de comportamiento

- **`default` siempre presente** en `installed`; si el CLI activo se desinstala,
  `active` cae a `"default"`.
- **Fail-closed (aislamiento por-servidor):** `setActive`/`completeOnboarding`
  exigen un `Executor` explícito — sin él lanzan `NoServerExecutorError` (nunca
  `localExecutor`, que mutaría el `~/.bashrc` del **host del panel**). Ver
  CLAUDE.md §"Aislamiento total por servidor".
- **Self-heal:** activar un CLI cuyo binario no está en PATH resetea el estado a
  `default` (dropeando ese CLI) y lanza `ValidationError` — nunca deja un
  `~/.bashrc` roto.
- **Whitelist:** solo ids del catálogo (`isValidCliId`) y comandos
  `^[A-Za-z0-9_.-]+$` tocan la shell (sin metacaracteres).
- **`skipOnboarding` degrada:** si la persistencia falla (p.ej. rate-limit),
  devuelve el estado en memoria en vez de un 500.

## Anatomía / capas

`models/` (`CliId`/`TerminalCliState`) → `repositories/` (`cli-state` en
`kv(executor)`, colección namespaced por usuario Linux) → `services/`
(`terminal-cli.service` orquesta estado + `bashrc-manager`; `cli-catalog` es el
registro puro, **debe seguir en sync** con
`frontend/.../floating-terminal/cli-registry.ts`) → `controllers/` → `routes/`.
**Sin agent-capability (MCP):** no expone herramientas al asistente IA.

## Tests

- `services/cli-catalog.test.ts` — whitelist, lookup de comando e invariante
  catálogo↔modelo.
- `services/terminal-cli.service.test.ts` — lógica de installed/active,
  fail-closed del executor, self-heal de PATH, onboarding y degradación de skip.
