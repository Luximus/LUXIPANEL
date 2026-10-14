# security-audit — auditoría de seguridad del servidor conectado

Escanea el **servidor conectado** (la propia caja o un target remoto por SSH)
con las herramientas de seguridad instaladas, agrega los hallazgos y les añade
un análisis con IA. Todo corre vía el `Executor` del request (nunca en el host
del panel). Sin DB: los informes se persisten como sidecar por-servidor.

En la UI forma parte del set **Firewall** (por eso las rutas se protegen con
`requireModule("firewall")`, no con un módulo `security-audit` propio).

## Estructura

```
models/audit-report.model.ts   AuditReport, ScanFinding (tipos)
services/
  scanners.service.ts          corre bitninja/lynis/rkhunter/chkrootkit + install
  ai-analyzer.service.ts       análisis IA (piezas puras + orquestador)
  index.ts                     barrel de servicios
controllers/audit.controller.ts  start / report / reports / scanners / install
routes/index.ts                securityAuditRouter (requireAuth + firewall + CSRF)
middleware.ts                  registerSecurityAuditModule(app)  ← entry de server.ts
agent-capability.ts            tools IA (read-only): last_report, ssh_posture
```

> No hay `index.ts` barrel: `server.ts` importa `registerSecurityAuditModule`
> directamente de `middleware.ts`. El barrel anterior estaba huérfano (0
> importadores) y se eliminó.

## Endpoints (`/api/security-audit`, todos requieren auth + módulo `firewall`)

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/start` | Lanza una auditoría (fire-and-forget); devuelve `auditId`. CSRF. |
| GET  | `/reports` | Últimos 20 informes (más reciente primero). |
| GET  | `/report/:id` | Un informe por id (404 tipado si no existe). |
| GET  | `/scanners` | Mapa `{scanner: instalado?}`. |
| POST | `/scanners/:name/install` | Instala un scanner (bitninja requiere licenseKey). CSRF. |

Errores: siempre tipados desde `shared/errors` (`ValidationError`,
`NotFoundError`); nunca `res.status().json` crudo.

## Persistencia

`remoteConfig` bajo el módulo **`security-audit-reports`** como
`{ reports: AuditReport[] }` (más reciente al frente, cap 20). Las fechas se
re-hidratan a `Date` tras el round-trip JSON. Un informe SIEMPRE termina en un
estado terminal (`completed`/`failed`) — nunca se queda colgado en `running`.

## Análisis IA (`ai-analyzer.service.ts`)

`analyzeFindings()` **orquesta**; la lógica testeable vive en helpers puros:

- `neutralize(value, max)` — la salida de los scanners es UNTRUSTED: quita el
  marcador de fence ` ``` `, tira caracteres de control C0/C1, colapsa espacios y
  trunca. Evita prompt-injection y prompts inflados.
- `deterministicFloor(findings)` — piso de riesgo derivado SOLO de las
  severidades de los scanners (fuente confiable). La IA puede SUBIR el riesgo
  global, nunca bajarlo por debajo de este piso.
- `buildAnalysisPrompt(findings, serverInfo)` — arma el prompt con el bloque
  UNTRUSTED envuelto en marcadores `<<<DATA>>>`/`<<<END_DATA>>>`.
- `parseAnalysisResponse(text)` — extrae el JSON del texto del modelo y lo valida
  con Zod (claves extra descartadas; enum fuera de rango → throw).

El proveedor IA sale del módulo **Agentes IA** del usuario (API key o CLI login),
nunca de una clave hardcodeada; sin proveedor usable, degrada con un informe
`medium`. El run se fija a `approvalMode: "manual"` para que una auditoría
(read-only) nunca herede un modo "auto" con permisos de mutación.

## Agent capability (IA, read-only)

- `security-audit.last_report` — último informe (score, resumen, hallazgos).
- `security-audit.ssh_posture` — lee `sshd_config` (PermitRootLogin,
  PasswordAuthentication, PubkeyAuthentication).

## Tests

`services/ai-analyzer.service.test.ts` — caracterización de las 4 piezas puras
(`neutralize`, `deterministicFloor`, `buildAnalysisPrompt`,
`parseAnalysisResponse`). Las deps pesadas del Assistant están mockeadas.
