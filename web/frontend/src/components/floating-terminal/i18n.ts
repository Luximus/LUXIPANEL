// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * i18n del Terminal para los componentes React (TerminalPanel, drawer, vista).
 *
 * El namespace "terminal" se sirve desde `src/i18n/<l>/terminal.ts` (fuente).
 * Aquí mantenemos un fallback tipado en español verbatim para que los
 * componentes rendericen correctamente antes de que `getClientMessages`
 * resuelva el slice, y para tipar las referencias. Mismas claves que el delta
 * devuelto bajo la raíz "terminal".
 */

export type TerminalMessages = {
  pageTitle: string;
  drawerTitle: string;
  fab: {
    openTerminal: string;
  };
  console: {
    firstTab: string;
    newTab: string;
    connecting: string;
    reconnect: string;
    closeDrawer: string;
    closeDrawerTitle: string;
  };
  sidebar: {
    tabSnippets: string;
    tabHistory: string;
    tabConfig: string;
    closePanel: string;
    closePanelTitle: string;
  };
  snippets: {
    heading: string;
    newSnippet: string;
    searchPlaceholder: string;
    searchAria: string;
    filterByCategoryAria: string;
    allCategories: string;
  };
  tables: {
    name: string;
    category: string;
    searchCategory: string;
    searchTag: string;
    edit: string;
    delete: string;
    deleteSelectedCategories: string;
    deleteSelectedTags: string;
  };
  history: {
    commandsLabel: string;
    clearHistory: string;
    loading: string;
    emptyCommands: string;
    emptyConversations: string;
    loadMore: string;
    loadingMore: string;
    titleCommands: string;
    titleCodex: string;
    titleClaude: string;
    colCommand: string;
    colTitle: string;
    colProject: string;
    colMessages: string;
    star: {
      addFavoriteTitle: string;
      removeFavoriteTitle: string;
      addFavoriteAria: string;
      removeFavoriteAria: string;
    };
    run: string;
    copyCodexCommand: string;
    deleteConversation: string;
    delete: string;
  };
  config: {
    regionAria: string;
    fontSizeTitle?: string;
    fontSizeDescription?: string;
    tabGeneral: string;
    tabCategories: string;
    tabTags: string;
    themeTitle: string;
    themeDescription: string;
    activeCli: string;
    installableTitle: string;
    installableDescription: string;
    install: string;
    previous: string;
    next: string;
    pageInfo: string;
    historyOrderTitle: string;
    historyOrderDescription: string;
    historyShow:string;
    historyShowCli:string;
    historyDrag:string;
    historyMoveUp:string;
    historyMoveDown:string;
    historyOrderHint:string;

    visibleOrder: string;
    consoleLabel: string;
    categoryNamePlaceholder: string;
    cancel: string;
    save: string;
    tableCategories: string;
    tableTags: string;
    categoryLabel: string;
    noCategories: string;
    selectCategory: string;
    tagNamePlaceholder: string;
    /** Descripción por CLI (clave = id del CLI). Vive DENTRO de `config`,
     *  igual que en los ficheros de idioma. */
    cliDescriptions: Record<string, string>;
  };
  mobileKeys: {
    toolbarAria: string;
    escAria: string;
    escTitle: string;
    tabAria: string;
    tabTitle: string;
    ctrlAria: string;
    ctrlTitle: string;
    altAria: string;
    altTitle: string;
    pgUpAria: string;
    pgUpTitle: string;
    pgDnAria: string;
    pgDnTitle: string;
    slashAria: string;
    slashTitle: string;
    homeAria: string;
    homeTitle: string;
    leftAria: string;
    leftTitle: string;
    upAria: string;
    upTitle: string;
    downAria: string;
    downTitle: string;
    rightAria: string;
    rightTitle: string;
    endAria: string;
    endTitle: string;
  };
};

export const terminalMessagesFallback: TerminalMessages = {
  pageTitle: "Terminal",
  drawerTitle: "Terminal",
  fab: {
    openTerminal: "Abrir terminal",
  },
  console: {
    firstTab: "Consola 1",
    newTab: "Nueva pestaña",
    connecting: "Conectando...",
    reconnect: "Reconectar",
    closeDrawer: "Cerrar drawer",
    closeDrawerTitle: "Cerrar (terminales se mantienen activos)",
  },
  sidebar: {
    tabSnippets: "Snippets",
    tabHistory: "Historial",
    tabConfig: "Configuración",
    closePanel: "Cerrar panel lateral",
    closePanelTitle: "Cerrar panel",
  },
  snippets: {
    heading: "Snippets",
    newSnippet: "Nuevo snippet",
    searchPlaceholder: "Buscar snippet...",
    searchAria: "Buscar snippets",
    filterByCategoryAria: "Filtrar por categoría",
    allCategories: "Todas las categorías",
  },
  tables: {
    name: "Nombre",
    category: "Categoría",
    searchCategory: "Buscar categoría...",
    searchTag: "Buscar tag...",
    edit: "Editar",
    delete: "Eliminar",
    deleteSelectedCategories: "Eliminar seleccionadas",
    deleteSelectedTags: "Eliminar seleccionados",
  },
  history: {
    commandsLabel: " comandos",
    clearHistory: "Borrar historial",
    loading: "Cargando historial...",
    emptyCommands: "Sin historial aún",
    emptyConversations: "Sin conversaciones de {cli}",
    loadMore: "Cargar más resultados",
    loadingMore: "Cargando...",
    titleCommands: "historial de comandos",
    titleCodex: "conversaciones de Codex",
    titleClaude: "conversaciones de Claude",
    colCommand: "Comando",
    colTitle: "Título",
    colProject: "Proyecto",
    colMessages: "Msgs",
    star: {
      addFavoriteTitle: "Marcar como favorito",
      removeFavoriteTitle: "Quitar de favoritos",
      addFavoriteAria: "Marcar favorito",
      removeFavoriteAria: "Quitar favorito",
    },
    run: "Ejecutar",
    copyCodexCommand: "Copiar comando de Codex",
    deleteConversation: "Eliminar conversación",
    delete: "Eliminar",
  },
  config: {
    regionAria: "Configuración de terminal",
    tabGeneral: "General",
    tabCategories: "Categorías",
    tabTags: "Tags",
    themeTitle: "Tema consola",
    themeDescription: "Selecciona qué CLI lanzar al abrir una terminal nueva.",
    activeCli: "CLI activo",
    installableTitle: "CLIs disponibles para instalar",
    installableDescription: "Al instalar, el comando se inyecta en la terminal activa.",
    install: "Instalar",
    previous: "Anterior",
    next: "Siguiente",
    pageInfo: "Página {page} de {pageCount} · {count} CLIs",
    historyOrderTitle: "Orden del historial",
    historyOrderDescription:
      "Arrastra las filas para ordenar el historial y marca los que quieres mostrar.",
    historyShow: "Mostrar",
    historyShowCli: "Mostrar {name} en el historial",
    historyDrag: "Arrastrar {name} para reordenar",
    historyMoveUp: "Subir {name}",
    historyMoveDown: "Bajar {name}",
    historyOrderHint: "También puedes usar las flechas. Mantén al menos un historial visible.",

    visibleOrder: "Orden visible",
    consoleLabel: "Consola",
    categoryNamePlaceholder: "Nombre de categoría",
    cancel: "Cancelar",
    save: "Guardar",
    tableCategories: "categorías",
    tableTags: "tags",
    categoryLabel: "Categoría",
    noCategories: "Sin categorías",
    selectCategory: "Selecciona una categoría",
    tagNamePlaceholder: "Nombre del tag",
    cliDescriptions: {
      default: "Bash sin autostart de ningún CLI.",
      opencode: "Agente terminal opensource compatible con varios modelos.",
      claude: "Claude Code de Anthropic.",
      codex: "OpenAI Codex CLI.",
      grok: "Agente de codificación en terminal de xAI (Grok); soporta modo headless.",
      gemini: "Google Gemini CLI.",
      copilot: "Asistente de GitHub Copilot en terminal.",
      cursor: "Agente CLI de Cursor.",
      aider: "Pair programming en terminal con LLMs.",
      qwen: "Qwen Code CLI de Alibaba.",
      continue: "Continue.dev en terminal.",
      goose: "Goose de Block — agente open source.",
      crush: "Crush de Charm — agente terminal cool.",
      amp: "Amp de Sourcegraph.",
      openhands: "OpenHands CLI (All Hands AI).",
      codebuff: "Codebuff CLI.",
      minimax: "MiniMax CLI (mmx) — texto, visión, imagen, vídeo y voz.",
    },
  },
  mobileKeys: {
    toolbarAria: "Teclas para programadores",
    escAria: "Escape",
    escTitle: "Escape",
    tabAria: "Tab",
    tabTitle: "Tab (autocompletar)",
    ctrlAria: "Ctrl (sticky)",
    ctrlTitle: "Ctrl — sticky: aplica a la siguiente tecla",
    altAria: "Alt (sticky)",
    altTitle: "Alt — sticky: aplica a la siguiente tecla",
    pgUpAria: "Página arriba",
    pgUpTitle: "Page Up",
    pgDnAria: "Página abajo",
    pgDnTitle: "Page Down",
    slashAria: "Barra inclinada",
    slashTitle: "/ (barra inclinada)",
    homeAria: "Home",
    homeTitle: "Inicio de línea",
    leftAria: "Flecha izquierda",
    leftTitle: "Flecha izquierda",
    upAria: "Flecha arriba",
    upTitle: "Flecha arriba",
    downAria: "Flecha abajo",
    downTitle: "Flecha abajo",
    rightAria: "Flecha derecha",
    rightTitle: "Flecha derecha",
    endAria: "End",
    endTitle: "Fin de línea",
  },
};
