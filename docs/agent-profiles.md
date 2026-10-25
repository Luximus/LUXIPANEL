# Perfiles globales y adaptaciones privadas

Un perfil global describe conocimientos, tecnologías, especialidad, instrucciones
generales, avatar y herramientas. Su contrato estricto no acepta proveedor,
modelo, credenciales, rutas, servidores, equipos ni jerarquías de un proyecto.
Las herramientas son capacidades solicitadas; importarlas no concede permisos.

El usuario puede crear borradores globales desde cualquier proyecto. Los
borradores pertenecen a su identidad en el target; el bazar muestra versiones
públicas aprobadas de LP-LICENSE-SERVER, disponibles entre instalaciones.
Publicar desde el panel exige administrar la cuenta vinculada; también existe el
portal de creadores con su propia sesión. Se revisa el contenido exacto de cada
versión antes de hacerlo público. Ningún agente privado se publica al migrar.

## Importación y ejecución

Importar requiere un proyecto autorizado y crea una adaptación independiente con
la versión, huella y contenido global de origen. El proveedor inicial se toma de
la configuración del asistente; el usuario adapta modelo, instrucciones, recursos,
equipo y relaciones en el editor privado. La jerarquía y el equipo raíz del
proyecto conservan sus reglas contextuales existentes.

Cada asignación guarda `privateConfig`, `sourceProfile` y una revisión para
detectar ediciones concurrentes. Los datos se guardan mediante el datastore del
target, fuera del código versionado. Las respuestas del catálogo privado no
incluyen adaptaciones de otros proyectos; los secretos se censuran también en
objetos anidados. El bazar recibe exclusivamente el manifiesto global.

El runtime resuelve el proyecto antes de seleccionar modelo, instrucciones,
herramientas y recursos. Conserva las intersecciones de permisos, rutas y
servidores y el aislamiento por identidad, sesión y target. Un perfil heredado se
edita en su proyecto de origen; una asignación explícita a un subproyecto conserva
la adaptación heredada como punto de partida.

## Actualizaciones y compatibilidad

Las actualizaciones son manuales. La vista previa compara el origen importado,
la adaptación actual y la nueva versión global. Solo cambian campos que el
usuario no modificó; modelo, credenciales y recursos privados se conservan.
Se comprueban versión, huella y revisión de la adaptación al aplicar.
Retirar o suspender un perfil público no borra agentes importados. Estos pueden
seguir trabajando cuando el catálogo no está disponible.

Los agentes anteriores siguen siendo privados. La migración copia su
configuración por proyecto y conserva un respaldo en el datastore. Se ejecuta
al editar o mediante la operación protegida de migración; los agentes con
trabajo pendiente se posponen. No escribe en los directorios de los proyectos
ni incorpora datos a Git.

## Superficie y clientes

Las rutas bajo `/api/ai/agent-profiles` ofrecen borradores, catálogo, importación,
comparación, actualización, migración y operaciones de autor. Las rutas
`/api/ai/agents/:id/project-profile/:projectId` leen y guardan una adaptación.
Usan el router protegido y los permisos de creación/actualización existentes.
Las operaciones del panel se descubren por el catálogo de módulos vigente.

Web y móvil presentan «Bazar de agentes», «Mis perfiles globales» y «Agentes
privados». El editor global solo contiene General y Herramientas. El editor
privado conserva la configuración de ejecución. Los textos nuevos están en
español e inglés, con inglés como alternativa para otros idiomas.

Escritorio utiliza la web del panel dentro de sus vistas aisladas y recibe esta
experiencia al actualizar el panel. No se añade otro almacén de perfiles ni se
duplica la interfaz en el shell Electron.

## Comprobación y entrega

Las pruebas de contrato, servicio y controladores cubren campos públicos,
credenciales anidadas, aislamiento, migración, jerarquía, importaciones repetidas
y actualizaciones que conservan cambios privados. Web prueba navegación,
edición y cambios de target; móvil prueba el transporte con cambio de sesión.
La política de navegación del escritorio mantiene sus pruebas existentes.

La entrega necesita primero el esquema aditivo y los endpoints del catálogo
en LP-LICENSE-SERVER, después los clientes del panel. Una respuesta de catálogo
ausente o inaccesible no deshabilita los agentes privados. Publicar código,
instalar una versión del panel y distribuir un cliente móvil son operaciones
distintas; las pruebas de código no acreditan esas entregas.
