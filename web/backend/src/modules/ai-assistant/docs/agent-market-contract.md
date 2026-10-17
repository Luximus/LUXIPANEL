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
- GET /agents?q=&technology=&projectId= → {ok:true,agents}. q busca nombre/descripción/especialidad/tecnologías; technology etiqueta exacta sin distinguir mayúsculas; projectId filtra miembros efectivos. Cada agente añade specialty,technologies,assignments (solo proyectos autorizados). project de compatibilidad solo si hay un vínculo único.
- GET /agents/:id → {ok:true,agent}, credencial redactada.
- GET /agents/:id/assignments?projectId= → {ok:true,assignments,effective}. Directas visibles con source; effective:null o {...assignment,projectId,inheritedFrom:string|null}.
- PUT /agents/:id/assignments/:projectId con campos configurables anteriores, sin projectId/status/timestamps → {ok:true,assignment}. Incorpora/reincorpora/actualiza idempotentemente, sin duplicar ni iniciar trabajo.
- DELETE /agents/:id/assignments/:projectId → {ok:true}; retirada idempotente que conserva agente, historial y tareas.
- POST/PUT /agents conservan shape y añaden specialty/technologies. projectIds se autoriza y pasa por los mismos controles de retirada. assignments no admite escritura libre.
- POST/PUT /projects conservan shape y añaden profile/technologies.

Errores según middleware {ok:false,error,code}:
400 ASSISTANT_PROJECT_REQUIRED (seleccionar projectId);
403 ASSISTANT_PROJECT_FORBIDDEN (acceso denegado, sin detalles ajenos);
404 ASSISTANT_AGENT_NOT_FOUND / ASSISTANT_PROJECT_NOT_FOUND;
409 ASSISTANT_ASSIGNMENT_BUSY (run, tarea pending/running, cola, pregunta/aprobación);
409 ASSISTANT_ASSIGNMENT_INHERITED (retirar desde la asignación de origen);
409 ASSISTANT_ASSIGNMENT_REMOVED (reincorporar antes de ejecutar);
409 ASSISTANT_CONTEXT_MISMATCH (el chat conserva agente/proyecto).

## Herencia y runtime
Padre asignado habilita descendientes autorizados. La asignación activa más cercana define cargo/contexto. No se crean exclusiones ocultas: retirar un vínculo que conserva herencia activa devuelve INHERITED; gestionar origen.
Target y projectId se fijan al ejecutar. Si falta projectId solo se resuelve un vínculo directo único; varios devuelven REQUIRED. Sin vínculos actuales ni retirados continúa el chat libre.
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
