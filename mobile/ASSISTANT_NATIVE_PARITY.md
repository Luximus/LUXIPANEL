<!-- documentation-status-20261013 -->
> **Documento histórico o de planificación.** Conserva propuestas, resultados y límites de su fecha; no acredita el estado ni la publicación actuales. Consultar la [referencia vigente](../INFRA_LUXIPANEL.md) y el código antes de ejecutar sus instrucciones. Clasificado el 13 de octubre de 2026.

# Asistente IA — Réplica nativa exacta (app móvil LP-LS)

Objetivo: que el botón **"Empezar conversación"** (y **"Nueva terminal"**) abran
una experiencia **100% nativa** en la app que sea **réplica exacta** del módulo
asistente IA web de LUXIPANEL (`frontend/src/components/floating-assistant/`),
en vez de abrir la WebView SSO del panel.

## Decisiones tomadas (congeladas)

- **Chat + Terminal: nativos** (ambos botones dejan de abrir WebView).
- **CLI / terminal: render ANSI nativo** (parser ANSI → `<Text>` con spans de
  color). **Sin WebView, sin xterm.js.**
- **Voz + conectores Office: incluidos** (paridad total, no se difieren).
- **Ajustes y lista de conversaciones: en drawers laterales de la app.**
  - **Drawer IZQUIERDO** (`ServerDrawer`, tab `chat`) → conversaciones + proyectos + agentes.
  - **Drawer DERECHO** (`BlogDrawer`, tab nuevo `assistant-settings`) → Proveedores/Agentes/Dashboard/Access/General.
- **Indicadores del header** (tokens, ventana de contexto, Compactar, estado de
  stream, "en background", Session ID, modo aprobación) → **navbar SUPERIOR**
  (no una barra nueva en el centro).

## Criterio visual

Réplica **estructural y de comportamiento 1:1** usando los tokens nativos de la
app (no Tailwind/violet-glass). Mismas burbujas, bloques, colores semánticos
(emerald/amber/red/violet), iconos `ti-*` → equivalentes nativos. El efecto
*backdrop-blur* glass de la web no se replica 1:1 en RN; todo lo demás sí.

## Mapeo de superficies

| Web (LUXIPANEL `ChatPane.tsx`) | Destino nativo |
|---|---|
| Sidebar izq (proyectos/agentes/conversaciones) | Drawer IZQ — `ServerDrawer` tab `chat` |
| `AssistantSettingsModal` (Proveedores/Agentes/Dashboard/Access/General) | Drawer DER — `BlogDrawer` tab `assistant-settings` (nuevo) |
| Área central de conversación (`TurnView`) | `screens/ChatScreen.tsx` (pantalla `Chat` del stack, fase A5) |
| Header con indicadores | cabecera propia de `ChatScreen` (USO CLI + `ChatHeaderPills`) |
| Composer | franja inferior de `ChatScreen` (`components/assistant/ChatComposer.tsx`) |
| Terminal CLI (xterm.js) | `AnsiTerminalView.tsx` (nuevo, ANSI nativo) |

## Componentes nativos reutilizables (ya existen)

`MarkdownView.tsx` (+ `CodeBlockView`), `ProviderIcon.tsx`, `ui/*`
(Button/Chip/Avatar/SegmentedControl/Input/Select/Toast/Modal/Skeleton),
`useEnterAnimation`, infra de drawers (`Animated` 300ms cúbico,
`PanGestureHandler`), `features/assistant/{chat-store,chat-controller,hooks}.ts`, `streamServerAssistant`
(`api/client.ts`, SSE por XHR sobre el gateway).

---

## Fases

### Fase 0 — Recableo de los botones  ✅ (chat) / ⬜ (terminal)
- ✅ `ServerAssistantPane.tsx` botón "Empezar conversación": `onOpenTool("assistant")`
  → `setStarted(true)` (chat nativo). El botón solo se renderiza con conexión SSH
  disponible (gating arriba). `tsc app = 0`. Hecho 2026-06-29.
- ⬜ Botón "Nueva terminal": sigue en WebView hasta que la Fase 2 construya el
  terminal nativo interactivo (no romper lo que funciona hoy).

### Fase 1 — Conversación a paridad (centro)  ⬜
`ServerAssistantPane.tsx` + `MarkdownView.tsx`. Componentes nuevos por turno:
- `PermissionView` mid-run (Aprobar / Aprobar siempre / Rechazar) + SSE `permission_request` + POST respuesta por gateway.
- `AskView` (texto / única / multi + "otra respuesta").
- `ModifiedFilesView` (modificados/eliminados, contadores, colapsable).
- Inputs de tools (params JSON) en el `ToolBlock`.
- Quick-replies por turno (Reescribe/Resúmelo/Continúa/Reintentar).
- Estados: detenido, interrumpido, "en background", error con Reintentar/Nuevo chat, error de traducción.
- Compaction divider + badge de agente.
- `MarkdownView`: tablas GFM + Mermaid.

### Fase 2 — Orquestador/subagentes + CLI ANSI nativo  ⬜
- `AnsiTerminalView.tsx` (nuevo): parser ANSI SGR → spans de color, fondo
  terminal, monospace, autoscroll. Reemplaza `xterm.js`.
- Lanes Orquestador + subagentes con dots de estado (emerald/amber/red).
- `CliHistoryView` + `CliUsageBars` (CPU/mem/contexto).
- **Terminal nativo interactivo** (botón "Nueva terminal"): WS del gateway →
  `AnsiTerminalView` + input. (La parte más cara; comparte el renderer ANSI.)

### Fase 3 — Drawer IZQ: conversaciones + proyectos  ⬜
`ServerDrawer.tsx` tab `chat` + `ConversationsDrawer`:
- Árbol proyectos/subproyectos + paginador, lista de agentes.
- Filas con indicadores (respondiendo/aprobación/sin-revisar/pin/preview/fecha) + pin/editar/eliminar.
- Búsqueda debounce + "Cargar anteriores".

### Fase 4 — Drawer DER: ajustes del asistente  ⬜
`BlogDrawerContent.tsx` tab nuevo `assistant-settings` con sub-tabs:
Proveedores · Agentes (roles/jerarquía) · Dashboard (stats/costo) · Access
(MCP/skills) · General (modo aprobación/toggles). Contra endpoints del gateway.

### Fase 5 — Composer a paridad (navbar inferior)  ⬜
`TitleBarTabs.tsx` + nuevos:
- Slash-commands autocomplete, alerta MCP expirada, mensajes en cola.
- Selector modo aprobación.
- Adjuntos: pegar imagen, navegador de adjuntos, carrusel/lightbox.
- Voz: grabación + waveform + transcripción.
- Conectores Office (Drive/OneDrive): manager + browse.

### Fase 6 — Header en navbar SUPERIOR  ⬜
Integrar en el navbar superior (contexto chat): tokens Σ, medidor de ventana de
contexto + botón Compactar, conteo adjuntos, estado de stream, "en background",
Session ID copiable (CLI), modo aprobación.

### Fase 7 — i18n + pulido + despliegue  ✅ (i18n + tsc) / ⬜ (build EAS + E2E)
11 locales, `tsc app = 0`, build EAS, E2E en dispositivo.
- ✅ Namespaces nuevos traducidos a los 11 locales (es/en/fr/pt/it/ru/zh/ko/ja/hi/ar):
  `assistant-settings` (87 claves), `assistant-composer`, `assistant-header`.
  Antes solo tenían `es` (resto = `base` español); ahora cada locale es real.
- ✅ `STR` interno de `ServerAssistantPane.tsx`: las claves de las Fases 0/1/3
  añadidas a `en/pt/fr/it` (antes solo en `es`; los demás caen a `es` por diseño).
- ✅ Etiquetas ANSI (`AnsiTerminalView`) y barras CLI (`CliUsageBars`): mapas por
  locale + selector (`ansiTerminalLabels`/`cliUsageBarsLabels`); `ServerAssistantPane`
  cablea `ansiTerminalLabels(language)` (antes hardcoded `…_ES`).
- ✅ `npx tsc --noEmit -p tsconfig.json` = 0 errores. Hecho 2026-06-29.
- ⬜ Build EAS + E2E en dispositivo.

---

## Dependencias fuera de la app (a verificar)
- **Gateway LP-LS** (`/portal/ssh/assistant*`): exponer evento SSE
  `permission_request` y el POST de respuesta del gate de permisos para la app.
- **Endpoints de ajustes** (proveedores/agentes/access): confirmar proxy por el
  gateway para el drawer derecho.
- **WS de terminal** por el gateway para el terminal nativo interactivo.

## Orden de entrega (incrementos desplegables)
0 → 1 → 2 → 3 → 6 → 5 → 4 → 7. (Todas se completan; el orden solo prioriza el
valor visible temprano.)

## Estado (2026-06-29 — workflow 7 agentes + 3 pasadas de cierre, tsc app=0 verificado)
- [✅] Fase 0 (chat ✅ `setStarted(true)` / terminal ✅ recableado a `onNewTerminal` nativo)
- [✅] Fase 1 conversación (PermissionView, AskView, ModifiedFiles, tool inputs, quick-replies, estados, compaction, agent badge, tablas GFM, Mermaid best-effort, CLI→AnsiTerminalView)
- [✅] Fase 2 (renderer ANSI ✅ en *.cli; **terminal interactivo nativo ✅** — emulador VT100/xterm completo, 30/30 pruebas humo, reemplaza la webview xterm)
- [✅] Fase 3 drawer izq (proyectos/subproyectos+pager, agentes, ConvoRow con indicadores, pin/rename/delete, búsqueda+paginación)
- [✅] Fase 4 drawer der (tab assistant-settings: 5 sub-tabs; backend DESPLEGADO → todas las superficies activas)
- [✅] Fase 5 composer (slash, MCP, cola, modo aprobación, adjuntos+lightbox, conectores Office; **VOZ cableada con expo-audio@1.1.1** — requiere build EAS para correr)
- [✅] Fase 6 header navbar superior (tokens Σ, ctx%, Compactar, adjuntos, estado stream, Session ID)
- [~] Fase 7 (i18n 11 locales ✅, tsc app=0 ✅; **build EAS + E2E dispositivo ⬜** — único pendiente)

### Pasadas de cierre (2026-06-29, post-workflow)
- **Backend DESPLEGADO + verificado**: build (heap 6GB por OOM del host) + `pm2 restart license-backend` +
  `pm2 save`. Online, restarts=1 estable, :3300 LISTEN, `/health` 200, log sin errores.
  Allowlist gateway ampliada (fix cross-fase): `agent/permission` + `connectors` + `voice`.
- **VOZ cableada**: `npx expo install expo-audio` → `expo-audio@~1.1.1` (SDK 54); nuevo
  `src/lib/voice-recorder.ts` (implementa `VoiceRecorderHandle` con permiso mic + grabar m4a →
  base64 → `/api/ai/voice/transcribe`); `voiceCaptureSupported` ios/android; plugin en app.json. tsc=0.
- **TERMINAL nativo**: nuevos `src/lib/terminal-emulator.ts` (núcleo VT100/xterm: buffer, cursor,
  alt-screen, scroll region, CSI completo, scrollback) + `terminal-emulator.test.ts` (30/30) +
  `NativeTerminalView.tsx` (renderer RN, memo por fila) + `NativeTerminalSession.tsx` (WS
  `/portal/ssh/terminal` + input + toolbar teclas + reconexión). MainScreen monta la sesión nativa;
  botón "Nueva terminal" → `onNewTerminal()`. `ServerTerminalView` (webview xterm) queda huérfano
  intacto. tsc=0.

## Pendiente real (único bloqueante: no se puede hacer desde aquí)
- **Build EAS** del app (dev-client/preview) — obligatorio para que corra la VOZ (módulo nativo
  expo-audio) y para probar todo en dispositivo. El terminal nativo es JS+WS puro (no necesita
  módulo nativo nuevo, pero igual entra en el build).
- **E2E en dispositivo**: chat nativo, permisos mid-run, drawers izq/der, conectores, voz,
  terminal (teclado/IME Android es el riesgo conocido).

### Limitaciones conocidas (aceptadas)
- Terminal: sin respuestas DSR/DA, sin reflow al redimensionar, sin doble-ancho CJK/emoji,
  métrica de fuente aproximada (~0.6·fontSize), scrollback en núcleo pero sin gesto de scroll.
- Mermaid = bloque etiquetado (no SVG). STR de ServerAssistantPane completo solo en es/en/pt/fr/it.
