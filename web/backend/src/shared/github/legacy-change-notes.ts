// SPDX-License-Identifier: AGPL-3.0-only
import type { PublicChangeNote } from "./change-notes.js";
/** Reviewed descriptions of public changes made before explicit update notes existed.
 * Keys match exact commits; notes are shown only if that commit belongs to the selected history.
 * Empty entries are test-only changes, without a new user-facing feature.
 */
export const legacyChangeNotes: Record<string, PublicChangeNote[]> = {
  "def82b35ca0555f7882a460fca0a22de224cd4b9": [{ title: "Avisos centrados en las actualizaciones", changes: ["El botón de versiones deja de mostrar avisos de actividad de la comunidad y señala únicamente versiones o cambios pendientes de instalar."] }],
  "633781680c7635d6cb4f6510ba8206b32ab135b5": [{ title: "Versiones y ramas en un mismo lugar", changes: ["Puedes elegir una rama desde el panel de versiones, revisar sus novedades y actualizar cuando lo decidas.", "Los avisos usan un color por rama y disponen de una ayuda para identificarlo.", "Las notificaciones de nuevos cambios abren directamente la rama correspondiente."] }],
  "81a66b21fddedcbc796c6737531357d318846de5": [{ title: "Aportes del asistente sobre el proyecto original", changes: ["Los nuevos turnos trabajan en el proyecto original sin crear una copia separada para cada conversación.", "El envío automático conserva los cambios de cada tarea y detecta conflictos entre trabajos simultáneos."] }],
  "ac5483e1bd765dd1e476c6f43bc68a44e6fa3b25": [{ title: "Acceso directo a tus servidores", changes: ["Las sesiones que acceden directamente a un servidor pueden administrarlo sin vincular una cuenta de GitHub.", "Publicar aportes sigue requiriendo una identidad verificada."] }],
  "2163c3bdddd94735704b79d6f04722a1c05cfaf9": [{ title: "Elegir al agente desde el chat", changes: ["El selector del compositor muestra el puesto y el nombre de cada miembro del equipo.", "Al elegir un agente, el menú lateral filtra sus conversaciones y mantiene la organización por proyectos y subproyectos."] }],
  "8a7d858cc01b515390c28a4207bec8c6db3f5378": [{ title: "Delegaciones que respetan el contexto del trabajo", changes: ["Los agentes delegados conservan el directorio de trabajo y el modo de aprobación de la tarea original."] }],
  "8bb9c1cc925ca76018997579ba8c87f4d77678bc": [],
  "d6ace09523bd0c47148305ce5a3e877d85e0aaab": [],
  "840c171bc4a26135f5079c74ab9f205201110bdc": [{ title: "Continuidad de las conversaciones con agentes", changes: ["Se mejora el cambio entre conversaciones de los agentes y la conservación de su contexto.", "Los aportes de tareas delegadas esperan la verificación del trabajo antes de publicarse."] }],
  "b972eb68014cbe750b62887b4f23fe9d6b018dc9": [{ title: "Mejoras del asistente y los aportes automáticos", changes: ["Se incorporan mejoras del chat y la interacción por voz en los clientes de LUXIPANEL.", "Los cambios del propietario pueden guardarse y enviarse automáticamente, conservando su atribución y las comprobaciones de publicación."] }],
  "b82d457e0fa432c6073bb6e99fba1c1d40758423": [{ title: "Correcciones al publicar sitios estáticos", changes: ["Se corrige la preparación y entrega de las vistas previas de sitios estáticos.", "Se refuerzan las comprobaciones previas a publicar una versión."] }],
  "ace8036dc94c98fefcbe09038b42da3b595fb4c5": [{ title: "Configuración de GitHub más fiable", changes: ["Se reconocen correctamente las operaciones de configuración que GitHub confirma sin devolver contenido."] }],
  "fd37105899fbc3d89f97a613d65ad46f7d3e4198": [],
  "e4d59c9aad8cfcecb86b11cae5617216bfb004db": [{ title: "Primera versión pública de LUXIPANEL", changes: ["La versión 2.0.3 reúne el panel web, el cliente de escritorio y la aplicación móvil.", "Las actualizaciones manuales conservan la configuración del servidor y el estado de sus módulos."] }],
  "9b720342c416ce6e581dd5ff6d30cd7c5e2defd1": [{ title: "Editor de credenciales disponible", changes: ["La distribución incluye los componentes necesarios para mostrar el editor de credenciales."] }],
  "1480e04e21d4dacc34b2763c2d00a50b2b0f491e": [{ title: "Instalaciones completas desde una compilación limpia", changes: ["Se incluyen los archivos auxiliares que necesitan las funciones del panel para ejecutarse correctamente."] }],
  "016f7f555f4a434b4d039fa2e0754e75d26b8219": [],
  "bb5a6449b3a4578d609d5540eec71ed7ed627bc6": []
};
