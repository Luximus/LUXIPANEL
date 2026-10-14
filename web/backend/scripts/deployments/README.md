# Runtime de repositorios de hosting

Fuente directa del supervisor root y runner rootless, publicada en este repo.
El contrato HTTP permanece en `../../src/modules/hosting/REPOSITORY_DEPLOYMENTS_API.md`.
No aplicar una copia local ni reconstruir todo el panel para instalar el runtime.

Validar `python3 deployment_policy_test.py`, `python3 -m py_compile deployment-helper.py`
y `node --check deployment-tenant.mjs`. Instalar `sudo bash install.sh` desde el
commit publicado, conservar el respaldo generado y verificar hashes instalados.
El instalador rechaza sobrescribir una barrera de red activa; esa actualización
requiere un release coordinado. No habilita operaciones ni ejecución de Luxisoft.

El supervisor recibe únicamente tareas privadas del proveedor con UUID/rutas e
identidad hosting comprobados. El runner recibe fuente y variables propias por
stdin con entorno vacío, sin credenciales del panel. Podman rootless compila y
ejecuta el código, con contenedores, imágenes inmutables y recursos/volúmenes por
entorno. Solo publica puertos en loopback. La barrera externa del consumidor
debe impedir conexiones iniciadas por clientes hacia host, LAN, metadata e IPv6,
permitiendo respuestas a conexiones abiertas por el proxy del host.

El supervisor verifica HTTP desde el host, exige 2xx y nunca sigue redirects.
Si falla el health, descarta solo los servicios candidatos de ese trabajo;
conserva la producción activa y los datos. Los workers se verifican por estado
y la publicación usa activate/cleanup para conservar el HTTP anterior hasta
que el consumidor confirme su ruta. Los builds comparten un lock global.

La admisión no rechaza trabajos por sumar reservas teóricas de 512 MiB por
contenedor ni por exigir 2 GiB de RAM libre. Este comportamiento es común a
todos los manifiestos de repositorios (formularios, herramientas interactivas,
aplicaciones, APIs, servicios y workers). Los cgroups limitan el consumo real
de contenedores/builds y cuenta; el supervisor serializa compilaciones.
La validación de identidad, red, rutas, fuente, cuotas de disco/base de datos,
salud y publicación permanece vigente. Web y Expo conservan sus rutas propias.
También se retira el umbral fijo de 2 GiB libres en disco: se comprueba la
cuota propia y los errores reales de escritura/compilación se reportan sin
afirmar que una versión fallida está lista.

Validar también `node --experimental-vm-modules --test deployment-admission.test.mjs`.
Para actualizar solo el runner con una barrera de red ya instalada, sustituir
atómicamente `deployment-tenant.mjs` desde el commit publicado, comprobando su
hash anterior y conservando un respaldo. No ejecutar el instalador completo
ni sobrescribir el supervisor protegido por la barrera.

Datos privados: ver el contrato /data y install-data.py; este instalador
coordinado conserva la barrera de red y exige ambos checkouts publicados y limpios.
