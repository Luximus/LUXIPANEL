# Módulo license: servicios locales y cliente de cuenta

Revisado el 2026-10-13. El nombre de la carpeta es histórico; no implica un flujo activo de activación/heartbeat managed.

- `branding-asset.service.ts` resuelve/cachea assets de marca según sus controles de URL.
- `panel-api.client.ts` es un cliente ACTIVO de servicios LP, usado por consumidores como desarrollo de módulos. Obtiene autorización mediante `lpApiAuthorization`; no debe describirse como inerte por ausencia de un antiguo license JWT.
- `shared/lp-api-key.ts` administra y valida la clave de cuenta con nombre, con prioridad del archivo de instancia sobre `LP_PANEL_CREDENTIAL`.

La clave vincula la cuenta: no registra IP, puerto ni credenciales SSH. El transporte local/SSH y su vault pertenecen a executor/servers. Las rutas `/panel-api/service/*` pueden exigir además contratos de servicio: comprobar el método cliente y guard remoto específico. No sustituirlos indiscriminadamente por un token de usuario.

No hay un registrador HTTP general de license que convierta automáticamente cada archivo en API pública. Para retirar un cliente buscar importadores y llamadas. La existencia de código de compatibilidad no autoriza anunciarlo como flujo de instalación ni borrarlo sin análisis.
