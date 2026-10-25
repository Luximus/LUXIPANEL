const es = {
  bazaar: "Bazar de agentes", mine: "Mis perfiles globales", project: "Agentes privados",
  intro: "Conocimiento y herramientas que puedes incorporar a tus proyectos.",
  privateHint: "Adaptación privada de este proyecto. Se conserva al actualizar el perfil global.",
  globalHint: "Perfil general compartible. Los modelos, las rutas y la jerarquía se configuran al importarlo a un proyecto.",
  new: "Crear perfil global", general: "General", tools: "Herramientas", name: "Nombre", description: "Descripción",
  specialty: "Especialidad", technologies: "Tecnologías (separadas por comas)", knowledge: "Conocimientos", systemPrompt: "Instrucciones generales",
  allowedTools: "Herramientas", allTools: "Todas las herramientas permitidas", toolHint: "La importación conserva esta lista. Solo se podrán usar las herramientas disponibles y autorizadas en el proyecto.",
  save: "Guardar", cancel: "Cerrar", edit: "Editar", import: "Importar al proyecto", choose: "Selecciona un proyecto",
  search: "Buscar por nombre, tecnología o especialidad", empty: "No hay perfiles para mostrar.", loading: "Cargando…",
  retry: "Volver a consultar", saved: "Guardado.", imported: "Importado. Configura ahora su adaptación privada.",
  preview: "Vista previa pública", submit: "Enviar a revisión", version: "Versión", publishHint: "Solo se enviará este perfil general. Revisa que su texto sea público.",
  sent: "Enviado a revisión. La publicación depende de la aprobación del catálogo.", history: "Estado y revisiones",
  unpublish: "Retirar del bazar", republish: "Volver a publicar", update: "Revisar actualización",
  apply: "Actualizar conservando mi adaptación", preserved: "Campos privados conservados", current: "Versión importada", incoming: "Versión disponible",
  upToDate: "El perfil ya está actualizado.", updated: "Versión actualizada; adaptación privada conservada.", changed: "Cambios",
  avatar: "Cambiar avatar", private: "Privado", public: "Público", createPrivate: "Crear agente privado",
};
const en: typeof es = {
  bazaar: "Agent bazaar", mine: "My global profiles", project: "Private agents",
  intro: "Knowledge and tools you can import into your projects.",
  privateHint: "Private project adaptation. Preserved when updating the global profile.",
  globalHint: "Shareable general profile. Configure models, paths and hierarchy after importing into a project.",
  new: "Create global profile", general: "General", tools: "Tools", name: "Name", description: "Description",
  specialty: "Specialty", technologies: "Technologies (comma separated)", knowledge: "Knowledge", systemPrompt: "General instructions",
  allowedTools: "Tools", allTools: "All permitted tools", toolHint: "Import preserves this list. Only available and authorized project tools can run.",
  save: "Save", cancel: "Close", edit: "Edit", import: "Import into project", choose: "Choose a project",
  search: "Search by name, technology or specialty", empty: "No profiles to show.", loading: "Loading…",
  retry: "Check again", saved: "Saved.", imported: "Imported. Configure its private adaptation.",
  preview: "Public preview", submit: "Submit for review", version: "Version", publishHint: "Only this general profile will be submitted. Check that its text is public.",
  sent: "Submitted for review. Publication requires catalog approval.", history: "Status and reviews",
  unpublish: "Unpublish", republish: "Republish", update: "Review update",
  apply: "Update and keep my adaptation", preserved: "Private fields preserved", current: "Imported version", incoming: "Available version",
  upToDate: "Profile is up to date.", updated: "Version updated; private adaptation preserved.", changed: "Changes",
  avatar: "Change avatar", private: "Private", public: "Public", createPrivate: "Create private agent",
};
export function profileCopy(locale?: string) { return (locale ?? "es").startsWith("es") ? es : en; }

export function profileStatus(value: string, locale?: string): string {
  const labels: Record<string, [string, string]> = {
    published: ["Publicado", "Published"], unpublished: ["Sin publicar", "Unpublished"],
    submitted: ["En revisión", "In review"], corrections: ["Cambios solicitados", "Changes requested"],
    suspended: ["Suspendido", "Suspended"], publish: ["Aprobado y publicado", "Approved and published"],
    suspend: ["Suspensión", "Suspension"], restore: ["Suspensión retirada", "Suspension lifted"],
  };
  return labels[value]?.[(locale ?? "es").startsWith("es") ? 0 : 1] ?? value;
}
