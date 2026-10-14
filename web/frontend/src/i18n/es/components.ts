const components = {
  "setupWizardFooter": {
    "rights": "Todos los derechos reservados.",
    "madeBy": "Hecho por LUXISOFT",
    "termsAndConditions": "Términos y condiciones",
    "privacyPolicy": "Política de privacidad",
    "documentation": "Documentación",
    "refundPolicy": "Política de reembolso"
  },
  "dataTable": {
    "boolTrue": "Sí",
    "boolFalse": "No",
    "selectPage": "Seleccionar página",
    "selectRow": "Seleccionar fila",
    "actions": "Acciones",
    "configure": "Configurar tabla",
    "empty": "No hay resultados para {title}.",
    "total": "Total",
    "selectedSummary": "{selected} seleccionados • mostrando {shown} de {pageSize} resultados, total resultados: {total}",
    "summary": "mostrando {shown} de {pageSize} resultados, total resultados: {total}",
    "prev": "Anterior",
    "next": "Siguiente",
    "pageOf": "Página {currentPage} de {totalPages}",
    "configureTitle": "Configurar tabla",
    "columnsAndOrder": "Columnas visibles y orden",
    "resultsPerPage": "Resultados por página",
    "moveUp": "Mover {col} hacia arriba",
    "moveDown": "Mover {col} hacia abajo",
    "defaultTitle": "tabla",
    "dragHandle": "Arrastrar para reordenar",
    "moveUpAria": "Mover {col} hacia arriba",
    "moveDownAria": "Mover {col} hacia abajo",
    "emptyCell": "-"
  },
  "confirmModal": {
    "title": "Confirmar",
    "cancel": "Cancelar",
    "confirm": "Confirmar",
    "alertTitle": "Aviso",
    "alertOk": "Entendido",
    "promptTitle": "Introduce un valor",
    "promptCancel": "Cancelar",
    "promptOk": "Aceptar"
  },
  "modalNavbar": {
    "back": "Volver",
    "close": "Cerrar"
  },
  "viewSettingsModal": {
    "buttonLabel": "Configuración",
    "description": "Configuración específica de este módulo",
    "close": "Cerrar"
  },
  "floatingTerminal": {
    "newSnippet": "Nuevo snippet",
    "close": "Cerrar",
    "name": "Nombre",
    "namePlaceholder": "ej. Reiniciar Postfix",
    "category": "Categoría",
    "tags": "Tags",
    "tagsHelp": "Los tags dependen de la categoría seleccionada",
    "command": "Comando",
    "monacoHelp": "Monaco para sintaxis de shell. Usa Ctrl+Enter para guardar desde el editor.",
    "cancel": "Cancelar",
    "save": "Guardar"
  },
  "installModal": {
    "running": "Instalando… puede tardar unos minutos.",
    "success": "Instalación completada.",
    "failed": "La instalación falló. Revisa el registro."
  },
  "enterPage": {
    "pageTitle": "Entrar con código",
    "heading": "Entrar con código de acceso",
    "subtitle": "Introduce el código que recibiste para acceder al panel.",
    "codeLabel": "Código de acceso",
    "codePlaceholder": "p.ej. a1b2c3d4e5f6g7",
    "continue": "Continuar",
    "useAnotherCode": "Usar otro código",
    "codeShort": "Código",
    "terminalAi": "Terminal / IA",
    "enter": "Entrar",
    "willBeRedirected": "Serás llevado al inicio de sesión del panel.",
    "featuresAvailable": "Disponibles",
    "featuresUnavailable": "No disponibles",
    "invalidCode": "Código de acceso no válido.",
    "verifyError": "No se pudo verificar el código. Intenta de nuevo.",
    "networkError": "Error de red. Intenta de nuevo.",
    "guestSessionError": "No se pudo iniciar la sesión de invitado."
  },
  "dragHandle": "Arrastrar para reordenar",
  "logoAlt": "LUXIPANEL",
  "default": " (default)",
  "emptyCell": "-",
  "loginEffects": {
    "defaultSuffix": " (predeterminado)",
    "webGpuHint": "Requiere WebGPU. Si el navegador no lo admite, se mostrará el fondo predeterminado."
  },
  "tableSettings": {
    "pagination": "Paginación",
    "rowsPerPage": "Filas por página en esta tabla.",
    "visibleActions": "Acciones a mostrar",
    "actionsHint": "Elige qué acciones aparecen en el menú «···» de cada fila."
  }
} as const;

export default components;
