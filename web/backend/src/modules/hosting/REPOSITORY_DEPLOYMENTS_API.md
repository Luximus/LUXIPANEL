# Hosting de repositorios: extensión del proveedor

Luxisoft consume HTTP; LUXIPANEL fija el servidor por la configuración del
proveedor y comprueba la propiedad de la cuenta en cada operación. No se usa
LP-LICENSE-SERVER como gateway ni se aceptan destinos elegidos por el cliente.

Base: `/api/hosting/v1/accounts/:account/deployments/:project`, UUIDs de cuenta y
proyecto externos. Autenticación Bearer existente, cuatro permisos adicionales:
`deployments.read`, `deployments.write`, `deployments.build`, `deployments.publish`.

| Método | Ruta | Permiso / función |
|---|---|---|
| PUT | base | write; registrar y comprobar instalación del runtime |
| PUT | /versions/:version | write; manifiesto + sourceDigest SHA256 inmutables |
| PUT | /versions/:version/source | write; ZIP octet-stream, máximo 32 MB |
| POST | /jobs | build para preview / publish para production; requestId idempotente |
| GET | /jobs/:job | read; estado, logs depurados, resultado sin datos privados |
| POST | /jobs/:job/activate | publish; verificar workers nuevos, conservar HTTP anteriores |
| POST | /jobs/:job/cleanup | publish; retirar anteriores después del cambio de ruta |
| PUT | /jobs/:job/static/:component/retained | publish; restaurar un ZIP inmutable verificado para una versión histórica |
| PUT | /routes/production | publish; reemplazar atómicamente hosts y componentes de la versión activa |
| DELETE | /routes/production | publish; retirar solo el enrutamiento público del proyecto |
| DELETE | base | write; detener procesos propios, conservar imágenes y volúmenes |

Manifiesto v1: components (context, Dockerfile o recipe generada, surface
http/worker/mobile, port, healthPath, volúmenes nombrados, routePrefix opcional),
resources postgres/mysql/redis/mongo/sqlite y digest canónico. Producción exige
imágenes existentes de la versión validada: no recompila la fuente. Recursos y
volúmenes se separan por preview/production. Solo se mantiene un preview activo.

Estado privado bajo `hosting/deployments/<sha256 proveedor/cuenta/proyecto>` en
el servidor asignado, archivos de entrada 0600. El supervisor instalado root
valida política/propietarios/rutas y lanza el runner como el usuario hosting.
Podman y los scripts del cliente no corren como root. systemd/Quadlet conserva
puertos loopback al reiniciar; cada cuenta tiene slice de 4096 MiB y unidades de
propiedad comprobada. Los cgroups limitan el consumo real y los builds se serializan; no se bloquean
trabajos por sumar reservas teóricas de memoria ni por umbrales de RAM libre.
Datos del cliente permanecen en su home/volúmenes. Un nuevo registro autorizado
puede reanudar un proyecto retirado después de reconectar GitHub; no elimina datos.

El gateway de producción lee únicamente `routes.json`, los puertos loopback y
los ZIP retenidos del proveedor. No consulta la API, Redis, IA ni la base central
de Luxisoft durante una solicitud. Conserva en memoria el último catálogo válido
si falla una recarga y omite un host si dos proyectos intentan reclamarlo. Los
ZIP se verifican por tamaño y SHA-256 antes de extraerse; las rutas estáticas se
validan contra traversal, enlaces y límites de expansión. Las previews siguen en
el flujo de control anterior y no comparten el puerto de producción.

Instalar **en el servidor asignado**:
`sudo bash web/backend/scripts/deployments/install.sh`.
Configura el usuario con LUXISOFT_DEPLOY_SERVICE_USER. El config root predeterminado es /etc/luxipanel;
se pueden especificar al instalar. La política vive fuera del directorio que el
usuario de servicio puede escribir. El instalador verifica sudoers y deja el
lock compartido de builds mediante tmpfiles.d. Después conceder los cuatro
permisos al proveedor y validar un canario real antes de activar usuarios.
El instalador habilita `luxisoft-project-gateway.service` en `:3460`; el acceso
de red debe limitarse al frontend público, como el servicio histórico de previews.

Expo importado usa `sourceMode: "repository"` en el contrato Expo existente.
Permite entrada propia, npm registry y configuración estática, pero impide
app.config dinámico, plugins locales y rutas que puedan leer secretos del
broker. El código se compila/exporta bajo el usuario hosting, sin EXPO_TOKEN;
solo el broker ejecuta EAS con la credencial. init usa metadatos mínimos sin
plugins. Los perfiles son gestionados; enviada a tienda no significa publicada.

`GITHUB_DEPLOYMENTS.patch` contiene la extensión sobre las fuentes del proveedor
existentes, sin incluir cambios locales ajenos ni reconstruir su base. Incluye
los scripts de instalación y pruebas específicas de aislamiento/configuración.

## Datos privados del proyecto

POST base/data exige deployments.read para metadata/rows/one/stats/replay,
y deployments.write para edit/trash/restore. Recibe versionId, environment,
resource y descriptor tipado de colección; valida la cuenta propia, manifiesto
inmutable y recurso PostgreSQL de ese proyecto. El ejecutor nunca es elegido
por el solicitante. El navegador solo usa la API autorizada de Luxisoft.

No acepta SQL, destinos ni credenciales. El helper protegido ejecuta el adaptador
rootless dentro del contenedor de datos del entorno. Las tablas compatibles
tienen id UUID, created_at timestamptz y data JSONB; formularios conservan
form_id/schema_version/definition/answers. .luxisoft/data.json registra
colecciones personalizadas bajo ese contrato. Los eventos son solo lectura.

Las escrituras usan revisión MD5 del registro completo, actor/requestId/hash,
bloqueo de fila y transacción; conservan UUID, timestamps, esquema y campos
históricos. Papelera y operaciones quedan en la misma base privada, sin caducidad
automática. Restauración conserva reglas SQL y cupos actuales de reservas.
Las estadísticas consultan todas las filas filtradas; CSV usa cursor estable
por fecha/id con fecha superior fijada al iniciar la exportación.

Validación: node --test backend/scripts/deployments/data-query.test.mjs,
incluye PostgreSQL aislado real y concurrencia. Con barrera instalada, actualizar
desde ambos commits publicados mediante sudo python3 backend/scripts/deployments/install-data.py /ruta/worktree/STORE.
Conserva wrapper de red, política, runtime de builds y respaldos; cambia solo
su hash del supervisor y habilita entradas privadas data/UUID.json. Instalar
también la ruta publicada y el módulo ESM del backend del proveedor.
