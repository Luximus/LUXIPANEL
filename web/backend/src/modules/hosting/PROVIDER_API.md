# API de proveedores de hosting — LUXIPANEL v1

LUXIPANEL **publica** esta API desde HOSTING. Luxisoft y cualquier otro gestor de
hosting son clientes de ella. Cada proveedor se configura en **Panel → HOSTING →
Configuración → Proveedores API** y se fija a un único servidor administrado.
LP-LICENSE-SERVER no autentica, retransmite ni ejecuta estas llamadas.

## Preparación y seguridad

1. Un administrador crea el proveedor, elige el servidor (local o target SSH con
   huella aprobada), el origen HTTPS del panel, el upstream HTTP loopback del
   motor de sitios, módulos de cliente, cupos y operaciones permitidas.
2. HOSTING devuelve una clave `lhp_…` **una sola vez**. El gestor la guarda solo
   en su backend. LUXIPANEL almacena su SHA-256, no el texto claro. Rotar la
   clave invalida de inmediato la anterior; revocar el proveedor bloquea todas
   sus llamadas. Los navegadores nunca reciben la clave.
3. El gestor llama directamente al panel por HTTPS con
   `Authorization: Bearer lhp_…` y `Content-Type: application/json`.
   Una cookie de panel o una clave genérica `lxp_…` no sirve en `/api/hosting/v1`.
4. Cada referencia externa está aislada por `providerId`. La API no acepta
   target, comandos, rutas de archivos, upstream ni configuración NGINX del
   cliente. El administrador fija esos límites al crear el proveedor.

La API devuelve `{ "ok": true, "data": … }` o el error estándar del panel
`{ "ok": false, "error": "…", "code": "…" }`. Códigos principales: `400`
entrada inválida, `401` clave ausente/inválida, `403` operación no concedida o
cuenta inactiva, `404` referencia ajena o inexistente, `409` conflicto o
operación concurrente, `5xx` fallo del panel/servidor. Reintentar `409` de
operación concurrente con espera; no interpretar `5xx` como éxito.

## Contrato HTTP

Base: `https://<panel>/api/hosting/v1`. Los identificadores externos aceptan
1–128 caracteres `[A-Za-z0-9_.:-]` y se codifican como segmento URL.

| Operación concedible | Método y ruta | Efecto |
|---|---|---|
| cualquiera | `GET /capabilities` | Versión, permisos, módulos y servidor asignado. |
| `accounts.write` | `PUT /accounts/{externalAccountId}` | Crea o recupera la cuenta; cuerpo `{ "displayName"?: string, "email"?: string }`. |
| `accounts.read` | `GET /accounts/{externalAccountId}` | Cuenta, home, estado, módulos y cupos; nunca hash de contraseña. |
| `accounts.status` | `PATCH /accounts/{externalAccountId}` | `{ "status"?: "active"\|"suspended", "displayName"?: string, "email"?: string }`. |
| `accounts.delete` | `DELETE /accounts/{externalAccountId}` | Termina la cuenta solo si ya no tiene sitios vinculados. No se concede por defecto. |
| `usage.read` | `GET /accounts/{externalAccountId}/usage` | Cupos y consumo medido; `warnings` indica métricas incompletas. |
| `sites.write` | `PUT /accounts/{externalAccountId}/sites/{externalSiteId}` | `{ "domain": "ejemplo.com" }`; vincula NGINX al upstream fijo. |
| `sites.write` | `DELETE /accounts/{externalAccountId}/sites/{externalSiteId}` | Elimina únicamente el vhost marcado como propiedad de ese proveedor. |
| `access.issue` | `POST /accounts/{externalAccountId}/access-ticket` | `{ "url", "ticket", "expiresInSeconds": 60 }` para entrar al panel. |

`PUT` de cuenta y de sitio es idempotente con la misma referencia y contenido.
Si el mismo ID de sitio se usa para otro dominio o cuenta, responde `409`. El
panel deriva un usuario Linux estable de `(proveedor, referencia)`; el gestor no
elige ni recibe su contraseña. La cuenta vive en `/home/<username>` y sus
permisos iniciales se asignan a su grupo Linux. Los permisos efectivos de acceso
se resuelven desde el usuario del panel y sus grupos actuales, administrados en
Usuarios → Grupos. Un proveedor no puede operar cuentas
creadas por otro o por un administrador.

La vinculación de sitio acepta un dominio válido, comprueba el cupo y escribe
solo un proxy NGINX generado por el panel hacia el upstream loopback
preconfigurado. Usa la validación `nginx -t`, restauración y recarga existentes.
El proveedor debe publicar su motor de sitios en ese puerto y enrutar el dominio
desde su borde TLS hasta el origen administrado por LUXIPANEL. La API no
modifica DNS, certificados del borde ni el contenido de la aplicación.

### Ejemplo

```sh
curl -fsS -X PUT "https://panel.example.org/api/hosting/v1/accounts/cuenta-42" \
  -H "Authorization: Bearer $LUXIPANEL_HOSTING_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Empresa 42","email":"owner@example.com"}'
```

### Acceso de un solo uso

El backend del gestor verifica primero que el solicitante es propietario de la
cuenta. Pide `access-ticket` con su clave de servidor y devuelve el ticket al
navegador autenticado. El navegador envía un **formulario POST** de navegación
superior a `url`, con campo `ticket`; el ticket nunca va en la URL. El endpoint
`/api/auth/sso/handoff` consume el ticket atómicamente en Redis (`GETDEL`),
establece una cookie del propio panel y abre `/panel`. Reutilizarlo o esperar
más de 60 segundos no crea sesión. Una política global de segundo factor
impide este acceso directo hasta que se configure un flujo compatible; la API
responde `403` en vez de saltarse esa política.

El ticket autentica al **usuario real ya aprovisionado en LUXIPANEL** mediante
el mismo emisor de sesiones que el login normal (ID de `auth/users`, tipo
`user`/`admin`, permisos de grupos y duración configurada). No crea una identidad
ni una interfaz alternativa de hosting. Una cuenta sin usuario del panel o con
usuario deshabilitado no recibe ticket. El segundo factor individual también
bloquea este acceso directo. El ámbito de archivos, propietario y cupos de la
cuenta se conserva independientemente de los permisos de navegación.

## Administración desde HOSTING

Estas rutas exigen **sesión admin y CSRF**, nunca clave de proveedor:

| Método y ruta | Efecto |
|---|---|
| `GET /api/hosting/providers` | Lista proveedores sin hashes ni claves. |
| `POST /api/hosting/providers` | Crea proveedor y muestra `data.key` una vez. |
| `PATCH /api/hosting/providers/{id}` | Cambia permisos, módulos, cupos para altas futuras o `enabled`; el target no cambia. |
| `POST /api/hosting/providers/{id}/rotate` | Invalida la clave anterior y muestra `data.key` una vez. |

El cuerpo de alta contiene `name`, `targetId`, `panelUrl` (origen HTTPS),
`upstreamUrl` (`http://127.0.0.1:<puerto>` o IPv6 loopback), `operations`,
`allowedModules`, `plan`, cuotas y `jailEnabled`. El servidor asignado debe
estar activo y, si es SSH, tener la huella aprobada. Los permisos de API
controlan al gestor; `allowedModules` controla lo que podrá usar el propietario
dentro del panel.

## Operación y límites

- Crear la cuenta en el gestor y registrar un trabajo duradero de provisión;
  reintentar `PUT` hasta obtener la cuenta. No bloquear el login del gestor si
  LUXIPANEL está temporalmente caído.
- No incluir la clave `lhp_…` ni tickets en logs, errores, URLs, commits o
  respuestas públicas. Rotar la clave desde HOSTING y actualizar el secreto en
  el backend consumidor.
- La baja de una cuenta elimina el usuario Linux y su home mediante el servicio
  de HOSTING. Revisar los recursos externos antes de conceder `accounts.delete`.
- `bandwidthUsedMb` no se promete: el panel aún no tiene medición de ancho de
  banda fiable. El campo `warnings` de uso advierte las mediciones degradadas.

## Plantilla de permisos para usuarios creados por API

En **Hosting → Configuración → Proveedores API → Editar proveedor**, el administrador configura los módulos, menús, vistas, acciones, rutas de archivos, comandos y límites para las cuentas nuevas. Cada cuenta mantiene su grupo dedicado `h-<usuario>`: la plantilla se copia al grupo al aprovisionar la cuenta. No se comparte un grupo entre clientes.

`POST /api/hosting/providers` y `PATCH /api/hosting/providers/:id` aceptan `groupTemplate` con `sidebar`, `views`, `actions`, `fileAccess` y `commandPolicy`. `GET /api/hosting/providers/permission-catalog` ofrece el catálogo editable; las rutas requieren una sesión administrativa y las mutaciones requieren CSRF. La clave Bearer del consumidor no permite modificar esta configuración.

Las listas de rutas de `fileAccess` son relativas a la carpeta de cada cuenta, por ejemplo `.` o `sites/public`. HOSTING rechaza rutas absolutas y segmentos `..`, y convierte las rutas a `/home/<usuario>/...` antes de crear el grupo. `allowAll` de archivos siempre es falso. Los permisos deben pertenecer a los módulos seleccionados; el privilegio `admin` no está disponible en esta plantilla. Para mostrar el chat se necesitan el menú `assistant` y la vista `panel.assistant`.

Sin `groupTemplate`, los proveedores existentes conservan los valores anteriores derivados de `allowedModules`. Una lista explícita de permisos vacía no restaura los módulos predeterminados. Guardar el proveedor cambia las cuentas futuras: repetir `PUT /v1/accounts/:externalId` sobre una cuenta existente no sobreescribe su grupo. Para modificar cuentas existentes, se editan sus grupos desde Usuarios. Las sesiones SSO siguen autenticando al usuario real y leyendo sus permisos actuales desde su grupo.
