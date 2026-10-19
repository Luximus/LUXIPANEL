# Proyectos y contexto de agentes

LUXIPANEL contiene el panel web autohospedado y sus clientes móvil y de
escritorio. Cada cliente mantiene sus dependencias y su arquitectura. El
servicio comercial LP-LICENSE-SERVER es un proyecto externo: sus antiguas
carpetas de clientes no son las rutas de trabajo de este monorepo.

## Áreas de trabajo

| Área | Directorio | Responsabilidad y referencia |
| --- | --- | --- |
| WEB | [web](../web) | Coordinación de API, interfaz e instalación. |
| BACKEND | [web/backend](../web/backend/ARCHITECTURE.md) | API Express/TypeScript, login Linux y ejecución contextual. |
| MODULOS | [web/backend/src/modules](../web/backend/src/modules) | Un dominio por carpeta; consultar su README y registro activo. |
| Servicios compartidos | [web/backend/src/shared](../web/backend/src/shared) | Executor, permisos, caché, contratos y servicios transversales. |
| Motores y scripts | [web/backend/scripts](../web/backend/scripts) | Collectors, workers, auxiliares de despliegue y activos del backend. |
| FRONTEND | [web/frontend](../web/frontend/ARCHITECTURE.md) | Astro SSR, islas React y navegación persistente. |
| Componentes UI | [web/frontend/src/components](../web/frontend/src/components) | Primitivas y componentes de cada dominio. |
| Rutas y páginas | [web/frontend/src/pages](../web/frontend/src/pages) | Entradas Astro y proxy API; revisar también middleware y layouts. |
| Cliente y sesión | [web/frontend/src/lib](../web/frontend/src/lib) | Transporte, contexto y utilidades compartidas de la interfaz. |
| Traducciones | [web/frontend/src/i18n](../web/frontend/src/i18n) | Catálogos fuente por idioma y namespace. |
| Navegación y scripts | [web/frontend/src/scripts](../web/frontend/src/scripts) | Inicialización, limpieza y comportamiento cliente durante navegación SPA. |
| Instalación y versiones | [web/scripts](../web/scripts) | Instaladores y preparación y revisión de entregas. |
| Compatibilidad y capacidades | [web/security](../web/security) | Comprobaciones de compatibilidad y capacidades de módulos. |
| APP | [mobile](../mobile/ARCHITECTURE.md) | Cliente React Native/Expo que consume las APIs directas del panel. |
| DESKTOP | [desktop](../desktop/ARCHITECTURE.md) | Shell Electron que abre la interfaz web en vistas aisladas. |

En el catálogo del asistente, MODULOS pertenece a BACKEND. No debe duplicar la
ruta de WEB. Los componentes `floating-assistant`, `panel-files`,
`floating-terminal`, `panel-mail`, `messenger` y `panel-releases` pueden tener
subproyectos bajo Componentes UI, conservando sus directorios reales. Registrar
un subproyecto no crea otro checkout, proceso ni módulo instalado.

La existencia de una carpeta no prueba que el módulo esté habilitado o que una
pantalla antigua forme parte del runtime. Comprobar los registradores, entradas
y catálogo vigente. Desktop usa `electron/panel-preload.cjs` y una
`WebContentsView` remota sin privilegios Node; mobile entra por
`src/screens/DirectPanelApp.tsx`. No exigir una copia de las pantallas móviles
en Electron ni restaurar el login del antiguo portal comercial.

## Directorio de trabajo y contexto permanente

`project.path` identifica el código y el directorio de ejecución. `storagePath`
identifica los documentos y preferencias privados del proyecto en el target.
Cambiar el directorio de trabajo no selecciona otro documento de contexto.
Las instrucciones del repositorio siguen aplicándose junto con el contexto del
panel. Consultar [la arquitectura del backend](../web/backend/ARCHITECTURE.md)
para el contrato de almacenamiento y migración.

Actualizar proyectos por las operaciones descubiertas del módulo Assistant.
Usar `expectedPath` al cambiar rutas y la revisión devuelta por la lectura del
documento al guardar contexto. Conservar documentos anteriores antes de
sustituir instrucciones históricas. Las guías de otros proveedores pueden
referenciar el documento vigente para evitar versiones contradictorias. Las
notas históricas no acreditan una publicación, disponibilidad ni prueba actual.

## Perfiles, asignaciones y skills

El perfil global de un agente puede pertenecer a varios proyectos. Mantener
identidad, proveedor, modelo, credenciales, herramientas autorizadas y vínculos
ajenos al encargo. Una asignación concreta especializa función, instrucciones y
rutas; el contexto efectivo puede heredarse de un padre. Comprobar la
configuración efectiva del catálogo antes de añadir vínculos redundantes.
Las asignaciones protegidas por trabajo, preguntas o aprobaciones pendientes
se conservan; no cancelar ese trabajo ni editar sidecars para eludir el bloqueo.

Separar coordinación, backend, interfaz, operación, QA web, desarrollo y QA
móvil, y desarrollo y QA de escritorio. El responsable del área necesita
referencias a entradas activas, contratos e invariantes, no estadísticas de
pruebas o despliegues antiguos. Consultar el
[contrato del Market](../web/backend/src/modules/ai-assistant/docs/agent-market-contract.md)
al editar perfiles compartidos o asignaciones.

Las skills del proyecto se combinan con las de sus padres; las preferencias del
agente pueden especializarlas. Seleccionar skills relacionadas con la tarea y
las tecnologías reales: por ejemplo, React Native/Expo para mobile, Vitest para
pruebas existentes, accesibilidad para interfaz y Redis para sus servicios.
Una skill no otorga permisos ni inicia instalaciones, auditorías o despliegues.
Las guías de revisión deben describir criterios concretos del área y preservar
las preferencias del proveedor y los canales protegidos del panel.

## Comprobación de una actualización de contexto

Releer proyectos, documentos, perfiles y estructura mediante el módulo.
Comprobar que las rutas existen, los hijos están dentro de sus padres, no hay
ciclos ni duplicados, las skills pertenecen al catálogo y los especialistas
apropiados reciben un contexto efectivo. Preservar índices del grafo existentes
sin declarar listos índices que no se han construido o verificado.

Los cambios de contexto, perfiles y Markdown no requieren build, reinicio,
paquetes nativos ni publicación en tiendas. Para cambios de código, elegir
pruebas pertinentes a partir de los scripts de cada paquete. Cuando se requiera
despliegue, serializar builds, compilar Astro con salida limpia y el límite de
memoria documentado, reiniciar el proceso correspondiente y verificar su
respuesta. La publicación de un aporte y la instalación son resultados
distintos.
