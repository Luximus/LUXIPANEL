const modules = {
  "pageTitle": "Módulos",
  "header": {
    "heading": "Módulos e integraciones",
    "subheading": "Activa u oculta los módulos preinstalados que aparecen en el menú lateral"
  },
  "search": {
    "placeholder": "Buscar módulo..."
  },
  "tabs": {
    "all": "Todos",
    "modules": "Módulos",
    "integrations": "Integraciones",
    "visible": "Visibles"
  },
  "stats": {
    "visible": "Visibles:",
    "hidden": "Ocultos:",
    "systemNote": "Los módulos del sistema se mantienen preinstalados"
  },
  "categories": {
    "label": "Categorías",
    "all": "Todas",
    "communication": "Comunicación",
    "infrastructure": "Infraestructura",
    "security": "Seguridad",
    "developer": "Desarrollador"
  },
  "statusFilter": {
    "label": "Estado",
    "all": "Todos",
    "visible": "Visibles",
    "hidden": "Ocultos"
  },
  "empty": {
    "title": "No se encontraron módulos",
    "subtitle": "Prueba con otro término de búsqueda o categoría"
  },
  "errors": {
    "loadTitle": "Error al cargar los módulos",
    "loadSubtitle": "No se pudo obtener la lista de módulos"
  },
  "labels": {
    "metaVersion": "Versión",
    "metaInstalls": "Instalaciones",
    "metaRating": "Valoración",
    "metaAuthor": "Autor",
    "metaCreatedAt": "Fecha de creación",
    "metaUpdatedAt": "Última actualización",
    "kindIntegration": "INTEGRACIÓN",
    "kindModule": "MÓDULO",
    "tagFree": "Gratis",
    "tagLicense": "Licencia requerida",
    "statusVisible": "Visible en el menú",
    "statusHidden": "Oculto",
    "dragHandle": "Arrastrar para reordenar",
    "menuToggle": "Mostrar en el menú lateral",
    "moduleToggle": "Activar módulo",
    "fabToggle": "Mostrar botón flotante"
  },
  "toasts": {
    "moduleVisible": "{name} visible",
    "moduleHidden": "{name} oculto",
    "moduleVisibleWithDeps": "{name} visible (también activado: {deps})",
    "moduleHiddenWithDeps": "{name} oculto (también activado: {deps})",
    "moduleUpdateError": "No se pudo actualizar {name}",
    "sidebarShown": "{name} aparece en el menú",
    "sidebarHidden": "{name} oculto del menú",
    "fabShown": "{name}: botón flotante activado",
    "fabHidden": "{name}: botón flotante desactivado",
    "orderSaved": "Orden actualizado",
    "orderError": "No se pudo guardar el orden",
    "orderHttpError": "No se pudo guardar el orden ({status})"
  }
} as const;

export default modules;
