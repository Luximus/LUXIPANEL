# mcp — integración de servidores MCP externos

Instala, configura, prueba y ejecuta **servidores MCP externos** (extensiones)
desde el panel: guarda sus credenciales cifradas, arranca su runtime, lista sus
tools y las ejecuta bajo una política de autorización. Endpoints de administración
(`requireModule("admin")`).

## Estructura

```
models/mcp.types.ts              tipos de request/response
repositories/
  secrets.repository.ts          CRUD de config cifrada (settings, base64)
  audit.repository.ts            registro de tool-calls (log observable)
services/
  extension-registry.service.ts  catálogo de extensiones + estado/enable/config
  secret-manager.service.ts      AES-256-GCM + KDF scrypt (async)
  mcp-runtime.service.ts         arranque/parada del runtime MCP + getTools/callTool
  mcp-connection.service.ts      health-check
  mcp-policy.service.ts          canUseExtension / canCallTool / filterTools
controllers/extensions.controller.ts   install/test/uninstall/tools/call-tool
routes/mcp.routes.ts             router /api/mcp/* (auth + admin + CSRF)
index.ts                         registerMCPModule(app)  ← entry de server.ts
```

## Endpoints (`/api/mcp`, requieren auth + módulo `admin`, todos POST + CSRF)

| Ruta | Qué hace |
|---|---|
| `/:id/install` | Instala y configura una extensión MCP (guarda secrets cifrados). |
| `/:id/test-connection` | Arranca el runtime y hace health-check. |
| `/:id/uninstall` | Deshabilita la extensión y borra sus secrets. |
| `/:id/tools` | Lista las tools disponibles (filtradas por política). |
| `/:id/call-tool/:toolName` | Ejecuta una tool con `arguments`. |

Todos comparten el mismo preámbulo (`resolveExtension`): resuelve la extensión
(404 tipado), opcionalmente exige `kind === "mcp_server"` y deriva el
`AuthContext` de la sesión (`res.locals.user`, admin = `kind "admin"`). La
autorización queda por handler: 4 gatean con `canUseExtension`, `call-tool` con
`canCallTool`. Los formatos de id/tool-name se validan con regex antes.

Errores tipados de `shared/errors`; los mensajes de error crudos se mapean a
genéricos seguros (`sanitizeErrorMessage`) para no filtrar rutas/estado interno.

## Cifrado de credenciales (`secret-manager.service.ts`)

AES-256-GCM autenticado. La clave se deriva de `ENCRYPTION_KEY` (env,
≥32 chars) + salt aleatorio por payload con **scrypt** (`N=16384, r=8, p=1`,
keylen 32). El paquete en reposo es `[salt | iv | authTag | ciphertext]` en
base64 dentro de settings (`mcp.<id>.secrets` + `mcp.<id>.keyId`).

> **`encrypt`/`decrypt` son async:** el KDF (deliberadamente pesado) corre en el
> threadpool de libuv para **no bloquear el event-loop**. Los params son
> idénticos al `scryptSync` anterior → las claves derivadas son byte-a-byte las
> mismas (los ciphertexts viejos siguen descifrando). Cualquier caller nuevo debe
> `await`.

`maskSecrets()` enmascara campos sensibles (`password`/`token`/`key`/`secret`,
o una lista dada) antes de loguear argumentos de tool-calls.

## Auditoría de tool-calls (`audit.repository.ts`)

`logToolCall()` emite una línea `log.debug` estructurada (greppable en
`pm2 logs`) con id/tool/usuario/duración/error, con input/output ya
enmascarados por el controlador. **No persiste**: LUXIPANEL no tiene DB y hoy no
hay lector del historial. El array in-memory previo era un sink write-only (nadie
lo leía) y se eliminó; re-añadir persistencia real el día que haya un consumidor
que LEA el trail, conservando la firma.

## Agent capability

Este módulo no expone `agent-capability.ts` (administración de extensiones, no
una superficie para el asistente).

## Tests

- `secret-manager.service.test.ts` — encrypt/decrypt roundtrip (prueba que el KDF
  deriva la misma clave), ciphertexts distintos por IV/salt, fallo con clave
  errónea, `maskSecrets`.
- `secrets.repository.test.ts` — save/get/errores (deps mockeadas).
- `mcp-runtime.service.test.ts`, `mcp-policy.service.test.ts` — runtime y política.
