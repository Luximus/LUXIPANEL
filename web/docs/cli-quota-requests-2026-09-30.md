<!-- documentation-status-20261013 -->
> **Documento histórico o de planificación.** Conserva propuestas, resultados y límites de su fecha; no acredita el estado ni la publicación actuales. Consultar la [referencia vigente](../README.md) y el código antes de ejecutar sus instrucciones. Clasificado el 13 de octubre de 2026.

# CLI quota: reducción de solicitudes

## Causa

`CliUsageBars` acumulaba consulta al montar, hasta cuatro reintentos automáticos ante `quota:null`, otra secuencia de hasta cuatro por evento `usage-updated` y polling cada 30 segundos. Montaje del panel, selección de proveedor (dos disparos), apertura de conversación y nuevo chat emitían ese evento aunque no cambiara el consumo. Cancelar timers no cancelaba secuencias ya ejecutándose: podían solaparse. La API JSON compartía solo solicitudes simultáneas (TTL 0).

## Corrección publicada

- Eliminados los avisos de consumo al montar/navegar/abrir chats; el nuevo proveedor carga por su propio montaje. El engine sigue emitiendo el evento al completar un turno.
- Una lectura inicial y una actualización por componente en vuelo. Cuota no disponible ya no dispara reintentos rápidos: conserva última cuota válida o usa estimación/estado desconocido existente.
- Lecturas de cuota compartidas durante 60 s en memoria, incluido `quota:null`, por proveedor/servidor/bridge/CSRF/usuario/idioma. Sin localStorage/sessionStorage. Invalidación existente por logout, permisos, cambio de target o mutación; respuestas de otro ámbito descartadas.
- Eventos de final de turno agrupados con debounce de 2,5 s y refresco explícito. Reintento manual realiza una sola actualización explícita.
- Polling de cuota y serie diaria pasa de 30 a 60 s, suspendido con pestaña oculta. Al volver visible reutiliza lectura reciente o consulta si venció.

## Validación

Build Astro aislado satisfactorio. 3 archivos / 6 pruebas pasan: disponibilidad Codex/rail, proveedor seleccionado, cuota no disponible sin retry, eventos agrupados, pausa en segundo plano, caché de cuota nula, concurrencia, vencimiento, refresco explícito y separación por servidor/logout.

QA del candidato, bloqueo de mutaciones y tokens temporales revocados: carga, scroll a segunda página y apertura de conversación mantienen **una sola solicitud CLI quota** durante unos 29 s; diez eventos sintéticos consecutivos generan **una** actualización más, 2,5 s después. Mismo resultado confirmado después de publicar sobre HTTPS: una consulta inicial y una adicional después de diez avisos; sin errores JavaScript. Bootstrap/historial/cursor/apertura agrupada/iconos siguen correctos. Los eventos sintéticos también despiertan otros listeners de contexto, por lo que esa ráfaga artificial de lecturas de mensajes no representa navegación normal ni se interpreta como efecto del polling de cuota.

Publicación selectiva de 27 assets/chunks sobre dist existente; no se publican las otras modificaciones de arquitectura pendientes. No hay commits/push ni builds nativos.

Evidencia `.cache/cli-quota-fix/{tests.log,build.log,qa-functional.json,qa-public.json,web-publication.json}`. Backup: /var/www/LUXIPANEL/.cache/cli-quota-fix/web-backup-1790823464061. Para revertir, restaurar solo archivos con `before` no nulo del manifiesto desde el backup y reiniciar luxipanel-frontend; conservar assets nuevos sin referencias.
