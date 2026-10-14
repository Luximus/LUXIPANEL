<!-- documentation-status-20261013 -->
> **Documento histórico o de planificación.** Conserva propuestas, resultados y límites de su fecha; no acredita el estado ni la publicación actuales. Consultar la [referencia vigente](../README.md) y el código antes de ejecutar sus instrucciones. Clasificado el 13 de octubre de 2026.

# Expo: carga de cuenta, builds y datos asociados

El usuario reportó cuenta, historial de builds y demás información sin cargar. Diagnóstico con lectura de los endpoints reales: configuración, cuenta, quota, build-list, env-list y store-credentials devolvían200. La entrada directa dejaba «Comprobando cuenta…» y no solicitaba account/quota tras una cancelación de contexto durante hidratación. Las tablas de builds/credenciales carecían de `data-table-id` en el artefacto activo, por lo que el aislamiento del controlador descartaba sus eventos READY. Variables/secrets mantenía un placeholder sin componente DataTable. Al volver a Expo, un prop `data=[]` nuevo borraba las filas entregadas por eventos.

Cambios:

- `expo/read.ts` recupera hasta dos veces solo lecturas con TARGET_SCOPE_CHANGED, mientras se mantengan root, generación, destino y selección. Cuenta/configuración GET y quota POST (lectura) lo utilizan. No reintenta builds, submit, OTA, guardado de tokens, credenciales ni cambios de sesión.
- Expo incluye la tabla de variables con builders existentes, traducciones, acciones y valores secretos enmascarados.
- El DataTable activo de Expo incluye su identificador y conserva filas recibidas por feed al rerenderizar con props vacíos. Un feed explícitamente vacío sí limpia filas. La fuente compartida ya tenía estos arreglos; se trasladaron selectivamente al artefacto usado por Expo, conservando React Bits y los demás consumidores.

Publicación selectiva de seis archivos: controlador Expo, vista Expo, su DataTable, builders de variables, host importador y entrada SSR. Assets nuevos e inmutables. Solo restart frontend, sin build global ni backend. Mantiene topbar centrado, logos circulares, Monitor, Correos y QR inline/Detener.

Validación: pruebas de recuperación y límites, cambios de servidor/generación/root/proyecto, descarte de respuestas viejas, aislamiento de controladores y persistencia del feed de tablas. Tipos dirigidos de los tres archivos de fuente sin errores. QA Chromium candidato/público en1440/390 y ambos temas: cuenta/cuota, builds, credenciales, variables enmascaradas, cambio de proyecto con respuesta tardía, regreso al módulo y QR inline. Lecturas reales candidato/público por entrada directa y navegación desde Chatbox: cuenta luxisoft, plan/cuota reales y tres tablas con filas. No se imprimen tokens ni valores de env; el fallback de mutaciones se bloquea en QA.

Evidencia `.cache/expo-data-repair/verification.json` y manifiesto con SHA. Rollback `node /var/www/LUXIPANEL/.cache/expo-data-repair/publish.mjs --rollback`, después de retirar publicaciones posteriores. No repetir stage/publish una vez publicado.

Verificación final: publicado, SHA de los seis archivos coincidentes,19pruebas y tipos dirigidos sin errores. Las matrices candidato/público y las dos entradas de lectura real pasaron sin pageerrors ni mutaciones de builds, tokens o sesiones.
