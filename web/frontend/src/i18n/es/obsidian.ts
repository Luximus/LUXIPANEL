const obsidian = {
  "workspace": {
    "settingsTitle": "Configuración de Obsidian",
    "settingsDescription": "Vista personal y gestión de vaults",
    "appearance": "Apariencia",
    "shortcuts": "Atajos",
    "vaults": "Bóvedas",
    "aiIntegration": "Integración IA",
    "personalHint": "Se guarda para tu cuenta en este servidor.",
    "defaultView": "Vista Markdown predeterminada",
    "edit": "Editar",
    "preview": "Vista previa",
    "split": "Dividir",
    "fontSize": "Tamaño de texto",
    "saved": "Guardado",
    "shortcutsHint": "Atajos de teclado de este espacio de trabajo.",
    "saveShortcut": "Guardar nota",
    "searchShortcut": "Enfocar búsqueda",
    "vaultsHint": "Registra y administra vaults de este servidor.",
    "aiHint": "Prepara archivos de contexto y sincroniza contenedores.",
    "today": "Nota de hoy",
    "quickEntry": "Entrada rápida",
    "quickEntryHint": "Añade texto al final de la nota de hoy.",
    "append": "Añadir entrada",
    "editorPane": "Editor",
    "mobileView": "Vista del espacio de trabajo",
    "clearSearch": "Limpiar",
    "askAdmin": "Pide a un administrador que registre un vault en este servidor.",
    "available": "Disponible",
    "missing": "No disponible",
    "notesCount": "notas",
    "noVault": "Sin vault",
    "readOnly": "Solo lectura",
    "entryRequired": "Escribe una entrada antes de añadirla.",
    "entryError": "No se pudo añadir la entrada.",
    "previewError": "No se pudo cargar la vista previa.",
    "entryAdded": "Entrada añadida."
  },
  "pageTitle": "Obsidian",
  "header": {
    "heading": "Vaults de Obsidian",
    "subheading": "Gestiona vaults, notas markdown y enlaces [[wikilink]] del servidor conectado."
  },
  "toolbar": {
    "newVault": "Nuevo vault",
    "unregister": "Desregistrar",
    "prepareAi": "Preparar para agentes IA",
    "searchPlaceholder": "Buscar en las notas...",
    "syncContainers": "Sincronizar contenedores"
  },
  "tree": {
    "title": "Notas",
    "newNote": "Nueva nota",
    "newFolder": "Nueva carpeta"
  },
  "editor": {
    "emptyTitle": "Selecciona una nota",
    "emptyDescription": "El contenido de la nota aparecerá aquí para editarlo.",
    "save": "Guardar",
    "links": "Enlaces",
    "analyzeAi": "Analizar con IA",
    "unsavedChanges": "Cambios sin guardar"
  },
  "vaultDialog": {
    "title": "Nuevo vault",
    "labelName": "Nombre",
    "placeholderName": "Mi vault",
    "labelPath": "Ruta absoluta en el servidor",
    "placeholderPath": "/home/usuario/vaults/mi-vault",
    "btnBrowse": "Explorar",
    "modeCreate": "Crear carpeta nueva",
    "modeCreateHint": "Crea la carpeta del vault (y su marcador .obsidian) en el servidor.",
    "modeRegister": "Registrar carpeta existente",
    "modeRegisterHint": "Usa una carpeta de vault que ya existe en el servidor.",
    "btnCancel": "Cancelar",
    "btnSave": "Guardar"
  },
  "pathBrowserDialog": {
    "title": "Seleccionar carpeta",
    "btnUp": "Subir",
    "btnCancel": "Cancelar",
    "btnSelect": "Usar esta carpeta"
  },
  "inputDialog": {
    "btnCancel": "Cancelar",
    "btnOk": "Aceptar"
  },
  "search": {
    "title": "Resultados de búsqueda"
  },
  "empty": {
    "noVaultsTitle": "Sin vaults registrados",
    "noVaultsDescription": "Crea o registra un vault de Obsidian para empezar a trabajar tus notas en el servidor.",
    "noVaultsCta": "Nuevo vault",
    "treeNoNotes": "El vault no tiene notas todavía.",
    "searchNoResults": "Sin resultados para \"{q}\"."
  },
  "confirm": {
    "discardDirtyBody": "Hay cambios sin guardar en la nota actual. ¿Descartarlos?",
    "discardDirtyTitle": "Cambios sin guardar",
    "discardDirtyConfirm": "Descartar",
    "discardDirtyCancel": "Seguir editando",
    "unregisterBody": "¿Desregistrar el vault \"{name}\"? Los archivos del servidor NO se borran.",
    "unregisterTitle": "Desregistrar vault",
    "unregisterConfirm": "Desregistrar",
    "overwriteContextBody": "Los archivos de contexto ya existen ({skipped}). ¿Sobrescribirlos?",
    "overwriteContextTitle": "Sobrescribir contexto",
    "overwriteContextConfirm": "Sobrescribir",
    "deleteNoteBody": "¿Eliminar la nota \"{path}\"? Esta acción no se puede deshacer.",
    "deleteNoteTitle": "Eliminar nota",
    "deleteNoteConfirm": "Eliminar"
  },
  "actions": {
    "retry": "Reintentar",
    "rename": "Renombrar",
    "delete": "Eliminar",
    "newNoteInputTitle": "Nueva nota",
    "newFolderInputTitle": "Nueva carpeta",
    "renameInputTitle": "Renombrar nota",
    "analyzeAiPrompt": "Estoy trabajando en mi vault de Obsidian \"{vaultName}\" (ruta del vault en el servidor: {vaultPath}) desde el módulo Obsidian de LUXIPANEL, y quiero trabajar la nota \"{notePath}\".\n\nUsa tus herramientas obsidian.* (leer/buscar/crear/enlazar notas del vault) para:\n1. Leer la nota y resumir sus puntos clave.\n2. Revisar sus enlaces [[wikilink]] salientes y sus backlinks.\n3. Proponer mejoras de contenido, estructura y nuevos enlaces hacia otras notas relacionadas del vault.\n\nPregúntame antes de aplicar cualquier cambio sobre las notas."
  },
  "errors": {
    "loadVaults": "No se pudieron cargar los vaults",
    "vaultMissing": "La carpeta del vault no existe en el servidor ({path}). Desregístralo o restaura la carpeta.",
    "nameAndPathRequired": "Nombre y ruta son obligatorios",
    "pathMustBeAbsolute": "La ruta debe ser absoluta (empezar por /)",
    "createVault": "No se pudo crear el vault",
    "unregisterVault": "No se pudo desregistrar el vault",
    "prepareContext": "No se pudo preparar el contexto IA",
    "syncContainers": "No se pudieron sincronizar los contenedores",
    "loadTree": "Error al cargar el árbol",
    "openNote": "No se pudo abrir la nota",
    "saveNote": "No se pudo guardar la nota",
    "noVaultSelected": "Selecciona un vault primero",
    "createNote": "No se pudo crear la nota",
    "createFolder": "No se pudo crear la carpeta",
    "renameNote": "No se pudo renombrar la nota",
    "deleteNote": "No se pudo eliminar la nota",
    "loadLinks": "Error al cargar enlaces",
    "wikilinkNotFound": "Nota \"{name}\" no encontrada en el vault",
    "search": "Error en la búsqueda",
    "listPath": "No se pudo listar esta ruta (¿permisos?)."
  },
  "labels": {
    "noteCount": " · {count} notas",
    "loading": "Cargando…",
    "noSubfolders": "(sin subcarpetas)",
    "loadingLinks": "Cargando enlaces…",
    "noOutgoingLinks": "Sin enlaces salientes.",
    "outgoing": "Salientes",
    "backlinks": "Enlaces entrantes",
    "noBacklinks": "Sin backlinks.",
    "searching": "Buscando…",
    "newNoteInputLabel": "Ruta relativa dentro del vault (ej: Ideas/Mi nota.md)",
    "newFolderInputLabel": "Ruta relativa dentro del vault (ej: Proyectos/2026)",
    "renameInputLabel": "Nueva ruta relativa"
  },
  "toasts": {
    "vaultCreated": "Vault creado",
    "vaultRegistered": "Vault registrado",
    "vaultUnregistered": "Vault desregistrado",
    "contextWritten": "Contexto IA escrito: {written}",
    "contextNoChanges": "Sin cambios (ya existían: {skipped})",
    "containersSynced": "Creados {created} · existentes {existing} · repos {repos} · proyectos {projects} · chats {chats}",
    "containersBasic": "Contenedores sincronizados",
    "noteSaved": "Nota guardada",
    "noteCreated": "Nota creada",
    "folderCreated": "Carpeta creada",
    "noteRenamed": "Nota renombrada",
    "noteDeleted": "Nota eliminada"
  }
} as const;

export default obsidian;
