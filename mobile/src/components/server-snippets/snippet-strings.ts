// ── i18n local (es + en, fallback es), patrón de ServerAssistantPane.strings ──
// Extraído de `ServerSnippetsTab.tsx` (refactor conservador: código movido tal cual).
export type SnippetStrings = {
  title: string;
  tabSnippets: string; tabCategories: string; tabTags: string;
  tabConsolas: string; tabHistorial: string; tabConfig: string;
  newConsole: string; consolesEmpty: string; consolesEmptyHint: string; consoleActive: string; console: string;
  histEmpty: string; histEntries: string; histLoadError: string; confirmDeleteConversation: string; histCommandsNote: string;
  prevPage: string; nextPage: string;
  filterCommands: string; filterConversations: string; commandsEmpty: string; histRunHint: string;
  searchPlaceholder: string;
  newSnippet: string; runHint: string;
  name: string; namePlaceholder: string;
  category: string; selectCategory: string; allCategories: string;
  tags: string; tagsHelp: string; pickCategoryForTags: string; categoryNoTags: string;
  command: string; commandPlaceholder: string;
  save: string; cancel: string; delete: string;
  emptyList: string; noResults: string; noCategories: string;
  newCategoryPlaceholder: string; addCategory: string;
  newTagPlaceholder: string; addTag: string;
  confirmDeleteSnippet: string; confirmDeleteCategory: string; confirmDeleteTag: string;
  deleteTitle: string;
  requireNameCategory: string; saveError: string; loadError: string;
  editSnippet: string;
};

const STR: Record<string, SnippetStrings> = {
  es: {
    title: "Snippets",
    tabSnippets: "Snippets", tabCategories: "Categorías", tabTags: "Tags",
    tabConsolas: "Consolas", tabHistorial: "Historial", tabConfig: "Configuración",
    newConsole: "Nueva consola", consolesEmpty: "No hay consolas abiertas.", consolesEmptyHint: "Abre una con el botón de arriba o desde “Nueva terminal”.", consoleActive: "Activa", console: "Consola",
    histEmpty: "Sin conversaciones", histEntries: "entradas", histLoadError: "No se pudo cargar el historial.", confirmDeleteConversation: "¿Eliminar esta conversación del historial?", histCommandsNote: "Toca para ejecutar en la consola: reanuda la conversación o reejecuta el comando.",
    prevPage: "Anterior", nextPage: "Siguiente",
    filterCommands: "Comandos", filterConversations: "Conversaciones", commandsEmpty: "Sin comandos ejecutados", histRunHint: "Toca para ejecutar en la consola.",
    searchPlaceholder: "Buscar snippet…",
    newSnippet: "Nuevo snippet", runHint: "Toca un snippet para ejecutarlo en el terminal.",
    name: "Nombre", namePlaceholder: "Ej. Reiniciar Postfix",
    category: "Categoría", selectCategory: "Selecciona una categoría", allCategories: "Todas las categorías",
    tags: "Tags", tagsHelp: "Los tags dependen de la categoría seleccionada.",
    pickCategoryForTags: "Selecciona una categoría para filtrar por tags.", categoryNoTags: "Esta categoría no tiene tags.",
    command: "Comando", commandPlaceholder: "ej. sudo systemctl restart postfix",
    save: "Guardar", cancel: "Cancelar", delete: "Eliminar",
    emptyList: "Sin snippets. Crea uno con +", noResults: "Sin resultados", noCategories: "Sin categorías",
    newCategoryPlaceholder: "Nueva categoría…", addCategory: "Crear categoría",
    newTagPlaceholder: "Nuevo tag…", addTag: "Crear tag",
    confirmDeleteSnippet: "¿Eliminar este snippet?",
    confirmDeleteCategory: "¿Eliminar esta categoría? Se borrarán sus tags y snippets.",
    confirmDeleteTag: "¿Eliminar este tag?",
    deleteTitle: "Eliminar",
    requireNameCategory: "Indica nombre y categoría.", saveError: "No se pudo guardar.", loadError: "No se pudieron cargar los snippets.",
    editSnippet: "Editar snippet",
  },
  en: {
    title: "Snippets",
    tabSnippets: "Snippets", tabCategories: "Categories", tabTags: "Tags",
    tabConsolas: "Consoles", tabHistorial: "History", tabConfig: "Settings",
    newConsole: "New console", consolesEmpty: "No open consoles.", consolesEmptyHint: "Open one with the button above or from “New terminal”.", consoleActive: "Active", console: "Console",
    histEmpty: "No conversations", histEntries: "entries", histLoadError: "Could not load history.", confirmDeleteConversation: "Delete this conversation from history?", histCommandsNote: "Tap to run in the console: resume the conversation or re-run the command.",
    prevPage: "Previous", nextPage: "Next",
    filterCommands: "Commands", filterConversations: "Conversations", commandsEmpty: "No executed commands", histRunHint: "Tap to run in the console.",
    searchPlaceholder: "Search snippet…",
    newSnippet: "New snippet", runHint: "Tap a snippet to run it in the terminal.",
    name: "Name", namePlaceholder: "e.g. Restart Postfix",
    category: "Category", selectCategory: "Select a category", allCategories: "All categories",
    tags: "Tags", tagsHelp: "Tags depend on the selected category.",
    pickCategoryForTags: "Select a category to filter by tags.", categoryNoTags: "This category has no tags.",
    command: "Command", commandPlaceholder: "e.g. sudo systemctl restart postfix",
    save: "Save", cancel: "Cancel", delete: "Delete",
    emptyList: "No snippets. Create one with +", noResults: "No results", noCategories: "No categories",
    newCategoryPlaceholder: "New category…", addCategory: "Create category",
    newTagPlaceholder: "New tag…", addTag: "Create tag",
    confirmDeleteSnippet: "Delete this snippet?",
    confirmDeleteCategory: "Delete this category? Its tags and snippets will be removed.",
    confirmDeleteTag: "Delete this tag?",
    deleteTitle: "Delete",
    requireNameCategory: "Provide a name and category.", saveError: "Could not save.", loadError: "Could not load snippets.",
    editSnippet: "Edit snippet",
  },
};

export function snippetStrings(lang?: string): SnippetStrings {
  return STR[(lang ?? "es").slice(0, 2)] ?? STR.es;
}
