# Expo API para proveedores

Extensión de `/api/hosting/v1`, autenticada por la credencial del proveedor y sus permisos `expo.read/write/build/submit`. El target procede del proveedor y la cuenta del mapping hosting; ningún request puede elegir usuario, home, target ni token Expo.

Base: `/accounts/:externalAccountId/apps/:appId` (UUIDs).

- `PUT/GET /`: registrar/consultar vínculo Expo.
- `PUT /versions/:versionId`: `{files,sourceDigest}`. Fuentes inmutables, paths/tamaños limitados, config JSON, sin hooks/scripts arbitrarios ni plugins nativos.
- `PUT /connections/:google|apple`: `{config}`. Google: `serviceAccount` JSON. Apple: `privateKey,keyId,issuerId,teamId,teamType,storeAppId`. Verifica acceso al package/bundle vinculado antes de cifrar en la bóveda.
- `POST /jobs`: `{requestId,versionId,kind,platform,profile,easBuildId,track,storeAppId}`. Tipos validate/build/submit. Idempotente por ID+payload. Validate exporta Expo Web sin token; build usa lockfile de esa validación y Expo central; submit exige build EAS terminado de esa misma app, versión y plataforma, más conexión propia verificada.
- `GET /jobs/:id`, `GET /jobs/:id/preview`, `GET /builds/:id`: estado/artefactos del proyecto asignado. Preview solo tras exportación terminada.

El módulo Expo registra un resolver de token por Executor mediante `shared/expo-provider-bridge.ts`. El token no se devuelve al proveedor ni se entrega a código cliente. El runner conserva manifest/credenciales temporales con modo 0600, elimina claves al terminar y limpia logs. El broker instala dependencias aprobadas con `--ignore-scripts`; TypeScript y Expo Web ejecutan el código como usuario hosting, sin secretos ni salida de red. Builds usan configuración estática, dependencias aprobadas y no ejecutan hooks del cliente. Runner serializado por target.

La cuenta Expo debe estar configurada en el target y la bóveda habilitada para conexiones Google/Apple. Android de prueba produce APK; producción AAB. iOS requiere Apple configurado y firma remota válida. El primer build puede requerir resolver acuerdos/permisos/firma desde la cuenta Apple.

Submit Google usa `releaseStatus:draft`. Submit Apple termina en TestFlight. El proveedor debe conservar la aprobación del propietario y completar la ficha/revisión en las consolas. Esta API no declara publicada una app ni promueve automáticamente un borrador a producción.

## Entrega de fuente e integración

La base de API de proveedores (`provider.model.ts`, `provider.service.ts`, `provider.routes.ts`) tiene trabajo previo aún sin seguimiento Git. Para preservar ese trabajo, `APP_STUDIO_EXPO.patch` contiene únicamente esta extensión: servicios nuevos, puente Expo y hooks mínimos a esa base. El parche se publica como artefacto de integración; no se incorpora el trabajo previo ajeno ni se presenta el checkout limpio como compilable con la API de proveedores todavía pendiente.

Después de incorporar la base hosting en un checkout nuevo: `git apply --check backend/src/modules/hosting/APP_STUDIO_EXPO.patch`, luego `git apply backend/src/modules/hosting/APP_STUDIO_EXPO.patch`, typecheck, pruebas dirigidas y build. En este host la extensión ya está aplicada y desplegada; no aplicar el parche otra vez.

`POST /jobs/:id/cancel` cancela validaciones locales. Las versiones nuevas conservan los datos de prueba separados; un build preview/development lleva entorno preview y versión exacta en el runtime. No reutilizar ese binario como producción.

El runner elimina fuentes/dependencias temporales y caché HOME al terminar, incluso si falla. Conserva fuentes de versión, lockfile, estado y exportación web. Verificación real: Expo Web y cambio por texto/contador en iframe Chromium; APK Android terminado en EAS. No se hicieron envíos Google/Apple por falta de credenciales de una tienda de prueba.
