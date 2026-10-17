# Market interno de agentes — contrato v1

Backend del target conectado, sin pagos/publicación, agentes duplicados ni migración masiva. Se conservan ids, proveedor/configuración y persistencia contextual existente.

## Perfil y proyecto
El catálogo sigue siendo /api/ai/agents. Al perfil actual (name, avatarConfig, description, systemPrompt, providerId, model, allowedTools, roleId, etc.) se añaden specialty:string (200) y technologies:string[] (40 etiquetas de 60). AssistantProject añade profile?:string (2000) y technologies?:string[] por POST/PUT existentes. Son datos declarados por el usuario, sin inspección del código. Editar el perfil se refleja en todas sus asignaciones; editar X no cambia Y.

## Asignación
En el mismo agente: assignments:AgentProjectAssignment[], cada elemento:
{projectId,status:"active"|"removed",jobTitle?,instructions?,parentAgentId?,connections?,roleId?,allowedTools?,canSpawnChats?,projectPaths?,serverIds?,graphProjectIds?,createdAt?,updatedAt?,removedAt?}.
jobTitle/instructions vacíos por defecto; roleId:null hereda el perfil. allowedTools/projectPaths/serverIds/graphProjectIds:null heredan; [] permite ninguno. canSpawnChats:null hereda; true nunca concede supervisión si el perfil/rol base no la concede. El equipo efectivo pertenece al proyecto raíz; solo relaciona agentes habilitados en el mismo ámbito.
projectIds sigue conteniendo vínculos directos activos. Legado se adapta en lectura a asignaciones virtuales source:"legacy", sin reescribir sidecars. Nuevas/actualizadas: source:"explicit". La marca removed impide que un agente retirado se vuelva un agente originalmente libre.

## HTTP
Prefijo /api/ai; permisos/autenticación actuales. Mutar el perfil o sus vínculos requiere propiedad del agente; los perfiles legados sin propietario requieren administrador. El proyecto y todos sus ancestros deben ser del usuario (legados sin propietario: administrador). El catálogo conserva la lectura compartida existente, pero filtra referencias a proyectos no autorizados.
- GET /agents?q=&technology= → {ok:true,agents}, catálogo completo de perfiles visibles del target.
- GET /agents?projectId=P → mismo envelope, solo miembros efectivos de P, incluidos heredados; cada fila lleva contexto P.
- GET /agents?contextProjectId=P → catálogo completo con contexto P, también no miembros, retirados y compartidos de solo lectura. No filtra por pertenencia.
- q busca una subcadena en nombre, descripción, especialidad y tecnologías; technology exige una etiqueta exacta; ambos ignoran mayúsculas y espacios exteriores y se combinan por AND en los tres modos. q admite hasta 500 caracteres y technology hasta 60; projectId/contextProjectId son strings no vacíos de hasta 64. Un query repetido/array es 400 VALIDATION_ERROR. projectId y contextProjectId juntos e iguales aplican filtro de miembros; si son distintos devuelven 400 VALIDATION_ERROR. Cada agente añade el DTO indicado abajo. project de compatibilidad solo si hay un vínculo directo visible único.
- GET /agents/:id → {ok:true,agent}, credencial redactada.
- GET /agents/:id/assignments?projectId= → {ok:true,assignments,effective}. Directas visibles con source; effective:null o {...assignment,projectId,inheritedFrom:string|null}.
- PUT /agents/:id/assignments/:projectId con campos configurables anteriores, sin projectId/status/timestamps → {ok:true,assignment}. Incorpora/reincorpora/actualiza idempotentemente, sin duplicar ni iniciar trabajo.
- DELETE /agents/:id/assignments/:projectId → {ok:true}; retirada idempotente que conserva agente, historial y tareas.
- POST/PUT /agents conservan shape y añaden specialty/technologies. projectIds se autoriza y pasa por los mismos controles de retirada. assignments no admite escritura libre.
- POST/PUT /projects conservan shape y añaden profile/technologies.

Errores según middleware {ok:false,error,code}:
400 VALIDATION_ERROR (query/body inválido o projectId/contextProjectId distintos);
400 ASSISTANT_PROJECT_REQUIRED (seleccionar projectId al iniciar una conversación nueva);
403 ASSISTANT_PROJECT_FORBIDDEN (acceso denegado, sin detalles ajenos);
404 ASSISTANT_AGENT_NOT_FOUND / ASSISTANT_PROJECT_NOT_FOUND;
409 ASSISTANT_ASSIGNMENT_BUSY (run, tarea pending/running, cola, pregunta/aprobación);
409 ASSISTANT_ASSIGNMENT_INHERITED (retirar desde la asignación de origen);
409 ASSISTANT_ASSIGNMENT_REMOVED (reincorporar antes de ejecutar);
409 ASSISTANT_CONTEXT_MISMATCH (el chat conserva agente/proyecto).

## DTO exacto del catálogo contextual

Tipos de fuente: `models/agent-market.types.ts` y `models/assistant-agent.types.ts`.
La API conserva los campos del perfil existente y sustituye `credential` por
`null | {label?:string,username:string,hasSecret:true}`; nunca devuelve `secret`.
Los campos base de jerarquía/configuración siguen describiendo el perfil global.
Para P, consumir `context.effectiveConfig`, no inferir jerarquía por nombres,
teamId global ni coincidencias de rutas.

```ts
type AssignmentView = {
  projectId: string;
  status: "active" | "removed";
  source: "legacy" | "explicit";
  jobTitle?: string;
  instructions?: string;
  parentAgentId?: string | null;
  connections?: string[] | null;
  roleId?: string | null;
  allowedTools?: string[] | null;
  canSpawnChats?: boolean | null;
  projectPaths?: string[] | null;
  serverIds?: string[] | null;
  graphProjectIds?: string[] | null;
  createdAt?: string;
  updatedAt?: string;
  removedAt?: string;
};
type EffectiveAssignment = AssignmentView & { inheritedFrom: string | null };
type MarketFields = {
  specialty: string; // siempre, default ""
  technologies: string[]; // siempre, default []
  assignments: AssignmentView[]; // directas, activas o retiradas; cadena autorizada completa
  projectIds: string[]; // solo directas activas visibles; no incluye descendientes implícitos
  graphProjectIds: string[]; // filtra también los ancestros
  capabilities: {
    canEditProfile: boolean;
    canDeleteProfile: boolean;
    canAssign: boolean;
    canUpdateAssignment: boolean;
    canRemoveAssignment: boolean;
    canExecute: boolean;
  };
  execution: {
    projectId: string | null;
    error: { code: string; statusCode: number; message: string } | null;
  };
  context: null | {
    projectId: string;
    membership: "none" | "direct" | "inherited" | "removed";
    directAssignment: AssignmentView | null;
    effectiveAssignment: EffectiveAssignment | null;
    effectiveConfig: null | {
      systemPrompt: string;
      roleId: string | null;
      allowedTools: string[] | null;
      canSpawnChats: boolean;
      projectPaths: string[];
      serverIds: string[];
      graphProjectIds: string[];
      teamId: string | null;
      parentAgentId: string | null;
      connections: string[];
    };
  };
};
// GET /agents agrega a cada perfil estos campos de compatibilidad:
type ListAnnotations = {
  ownerId: number | null;
  relation: "owner" | "shared";
  ownerName: string | null;
  isTeamLeader: boolean;
  subordinateIds: string[];
  project: { id: string; name: string } | null;
};
```

`GET /agents/:id` y `PUT /agents/:id` también presentan MarketFields sin contexto
(`context:null`); las anotaciones ListAnnotations son exclusivas del listado.
`POST /agents` mantiene su respuesta de creación anterior (perfil redactado);
recargar el catálogo para obtener las capacidades. No persistir los campos de
presentación al editar el perfil.

`effectiveAssignment.projectId` es P, e `inheritedFrom` es el id del origen o
null si es directa. `directAssignment` conserva el vínculo directo, incluso
retirado; si sigue habiendo un padre activo, membership es inherited. Sin
asignación efectiva, membership es removed si hay una marca retirada en la
cadena, y none en otro caso. Un ancestro ajeno, ausente o cíclico no autoriza
la hoja: la referencia se omite del catálogo general; pedir ese contexto
produce 403 y pedir un proyecto inexistente produce 404.

`canEditProfile/canDeleteProfile` exigen propiedad o administrador para legado
sin propietario. Los perfiles de otro propietario siguen visibles como shared,
pero no se convierten en autorización para ejecutar, editar ni asignar. Los
legados sin dueño siguen disponibles para el administrador. No se amplían los
permisos por aparecer en el catálogo. Para un contexto autorizado:

- canAssign: puede modificar perfil y no hay vínculo directo activo; admite reincorporar y crear una personalización de una herencia.
- canUpdateAssignment: puede modificar perfil y existe vínculo directo activo.
- canRemoveAssignment: además, no quedaría ninguna herencia activa después de retirar la directa. Para gestionar una heredada, usar el proyecto de origen.
- canExecute: el mismo `resolveAgentContext` de admisión acepta perfil, proyecto, ancestros y roles; execution.error es null. Si falla, devuelve el mismo status/code/message y effectiveConfig es null. Sin contexto explícito, execution.projectId es el único vínculo resuelto o null para chat libre/error; un perfil multiproyecto requiere seleccionar contexto.

Sin contexto, las tres capacidades de asignación son false. Son capacidades
al momento de leer; los endpoints vuelven a autorizarlas. Trabajo pendiente
puede bloquear una mutación con 409 BUSY; sesión expirada, proveedor sin
configurar, permisos de herramientas/módulos y cuotas se verifican en su fase
habitual. canExecute no es un permiso para eludir esas comprobaciones.

`effectiveConfig` refleja el resolver del runtime: intersección de herramientas
perfil/rol base/rol local/asignación, recursos del árbol activo acotados por el
perfil/asignación, equipo raíz y superior/conexiones contextuales. allowedTools
null significa sin restricción adicional; [] ninguna herramienta de módulo.
El catálogo no enumera permisos efectivos de sesión/módulos: esos filtros
siguen aplicándose en cada despacho. systemPrompt contiene las instrucciones
de rol y luego perfil/asignación, sin prompt base, secretos ni contexto dinámico.
isTeamLeader/subordinateIds se calculan sobre el roster efectivo ejecutable del
contexto completo antes de aplicar q/technology, para que filtrar no cambie
la jerarquía. Sin contexto conservan la jerarquía global de compatibilidad.

## Gestión de asignaciones

`GET /agents/:id/assignments?projectId=P` devuelve
`{ok:true,assignments:AssignmentView[],effective:EffectiveAssignment|null}`.
Sin projectId, effective es null. No filtra las directas por P: devuelve todas
las directas visibles y calcula la efectiva pedida por separado.

`PUT /agents/:id/assignments/:projectId` crea, reincorpora o actualiza el vínculo
sin duplicar el perfil; acepta exclusivamente jobTitle (trim, hasta 200),
instructions (hasta 20000), parentAgentId (hasta 64 o null), connections
(hasta 20 ids de 64 o null), roleId (hasta 64 o null), allowedTools (hasta 500
nombres de 120 o null), canSpawnChats (boolean o null), projectPaths (hasta 20
rutas absolutas de 500 o null), serverIds (hasta 50 ids de 1–128 o null) y
graphProjectIds (hasta 100 ids de 1–64 o null). Campos ausentes se conservan.
Body `{}` es válido. projectId/status/source/timestamps y otros campos extra
se rechazan con 400. Respuesta 200 `{ok:true,assignment:AssignmentView}`.

`DELETE /agents/:id/assignments/:projectId` devuelve 200 `{ok:true}` al retirar
una directa o repetir una retirada. No borra perfil, mensajes, conversaciones
ni tareas. PUT idéntico conserva los timestamps y no crea otra fila; reincorporar
reutiliza la fila, conserva createdAt y elimina removedAt. Un vínculo legado
sin cambios puede seguir devolviendo source:legacy; editarlo lo hace explícito.
No hay jobId ni respuesta 202: estas mutaciones terminan antes del 200, no
inician agentes ni builds. Trabajo asíncrono ya existente (run, cola, tarea,
pregunta, aprobación, mensaje o job durable) bloquea cambios con 409 BUSY.
Una retirada heredada o una directa que dejaría otra herencia activa devuelve
409 INHERITED y no aplica cambios; debe retirarse desde su origen.

## Herencia y runtime
Padre asignado habilita descendientes autorizados. La asignación activa más cercana define cargo/contexto. No se crean exclusiones ocultas: retirar un vínculo que conserva herencia activa devuelve INHERITED; gestionar origen.
Target y projectId se fijan al ejecutar. Solo para una conversación nueva, si falta projectId se resuelve un vínculo directo único; varios devuelven REQUIRED. Toda conversación persistida conserva agentId/projectId, incluso vacía o con projectId:null: no puede adoptar agente/proyecto nuevos ni inferir una asignación incorporada después. Devuelve CONTEXT_MISMATCH y exige abrir otra conversación. Un input null/omitido reanuda el vínculo persistido; no lo elimina. Sin vínculos actuales ni retirados continúa el chat libre. La misma validación se aplica antes de admitir cola, voz y respuestas de aprobación; no se modifica historial al rechazar.
Contexto del proyecto activo + ancestros autorizados, hijos autorizados anunciados; nunca unión de otros projectIds raíz. Rutas/servidores/grafos se acotan al árbol activo y restricciones de asignación. Sesión/módulos/perfil/roles/asignación se intersectan, nunca se amplían.
Chat, delegación, equipo y cola recuperada revalidan antes del despacho. Retirada y admisión comparten exclusión target/agente; trabajo durable pendiente bloquea tras reinicio.
Historial se conserva consultable; no autoriza nuevos runs después de retirada.

## Límites
Controles del panel (despacho, contexto, canales protegidos), NO sandbox del sistema operativo de los CLI. Se conservan proveedores y acceso Linux existente. Compatibilidad tecnológica informativa/manual; sin incorporación automática.
UI debe elegir proyecto explícitamente, conservar status/code y mostrar herencia/retirada. Build/restart/QA desplegado quedan para el responsable de despliegue.

Jerarquía local: parentAgentId y connections son opcionales por asignación. Una incorporación nueva hereda el líder raíz si no fija superior; al configurar o retirar un vínculo legado se conserva su superior. parentAgentId:null desvincula del superior; connections:null hereda el perfil y [] desactiva conexiones. Las conexiones solo se habilitan entre miembros autorizados del proyecto activo. Rutas y grafos se toman del proyecto activo y descendientes; los ancestros aportan instrucciones/skills/servidores, sin añadir sus rutas amplias.

## Compatibilidad y límites operativos
La reparación antigua del workspace no elige un primer proyecto ni transforma perfiles multiproyecto o con assignments. El borrado de un proyecto con miembros efectivos (también heredados) devuelve 409 ASSISTANT_ASSIGNMENT_BUSY: requiere retirarlos antes; los chats de agente conservan su projectId histórico incluso si luego se elimina ese proyecto.
La exclusión de admisión/retirada es por target/agente dentro de un proceso. El ecosystem actual usa fork/instances:1; no es un bloqueo distribuido entre instancias. La cola además serializa despacho por target/conversación y consume solo el elemento validado. Preguntas y jobs durables se comprueban en los namespaces del mismo target, incluidos otros usuarios de un perfil legado compartido, devolviendo solo estado de bloqueo. Un job sin metadatos bloquea conservadoramente hasta recuperar su identidad.
Los límites de rutas del dispatcher son comparaciones normalizadas de parámetros de rutas; no inspeccionan comandos shell, enlaces simbólicos ni accesos nativos del CLI. Las restricciones de herramientas y servidores se revalidan en los canales protegidos, conservando autenticación y permisos existentes. Una lista vacía limita esos canales; no crea una jaula de Linux.
La voz mantiene la admisión de la asignación mientras su sesión está activa. Recuperar un CLI puede conservar la lectura de sus logs/historial sin restablecer herramientas si su asignación ya no es válida.

allowedTools conserva su significado existente: herramientas registradas de módulos, normalizando aliases legados antes de intersectar. La coordinación (equipo/mensajes/delegación) mantiene sus controles de jerarquía, pertenencia al proyecto y supervisión; no se añaden permisos globales al catálogo.


## Evidencia focalizada (2026-10-17)

Desde `web/backend`, en el checkout original `developer`:

```sh
NODE_OPTIONS=--max-old-space-size=2560 npm run typecheck
```

Salida 0; el script ejecuta `tsc --noEmit`. Sin build ni reinicio.

```sh
NODE_OPTIONS=--max-old-space-size=2560 npm test -- \
  src/modules/ai-assistant/services/agent-market.service.test.ts \
  src/modules/ai-assistant/controllers/agents.controller.test.ts \
  src/modules/ai-assistant/repositories/agent-activity.repository.test.ts \
  src/modules/ai-assistant/services/module-tools.service.test.ts \
  src/modules/ai-assistant/services/team-tools.test.ts \
  src/modules/ai-assistant/services/team-tasks.service.test.ts \
  src/modules/ai-assistant/services/turn-queue.service.test.ts \
  src/modules/ai-assistant/services/realtime.service.test.ts \
  src/modules/ai-assistant/services/agent-messages.service.test.ts \
  src/modules/ai-assistant/services/project-workspace.service.test.ts \
  src/modules/ai-assistant/services/cli-run-recovery.service.test.ts \
  --pool=threads --maxWorkers=2 --minWorkers=1
```

Salida 0; **11 archivos, 278 pruebas aprobadas**, sin fallos ni omitidas.
Incluye X/Y con un perfil, otro propietario, ancestros ajenos/ausentes/cíclicos,
herencia y personalización, idempotencia, retirada con historial, conflicto de
admisión, colas/jobs/preguntas pendientes, chat null inmutable, filtros/capacidades,
credenciales redactadas y separación de targets. La regresión de voz distingue
metadatos de líder/trabajador y comprueba que una aprobación no recontextualiza
al trabajador. Durante la integración se corrigieron dos expectativas de voz
que asumían el comportamiento anterior; ninguna prueba se desactivó.

No acredita despliegue: build serial, reinicio, logs y HTTP quedan para la fase
de publicación coordinada. No se modificaron configuración real de usuarios,
login directo, contratos LP, frontend ni infraestructura en este aporte.
