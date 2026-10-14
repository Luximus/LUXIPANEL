// Floating terminal — i18n slice reader + interpolation helper.
// Reads the injected `#terminal-i18n` JSON (emitted by FloatingTerminal.astro)
// and exposes the resolved message tree `I18N` plus the `tI18n` interpolator.

// ── i18n del script vanilla ────────────────────────────────────────────────
// El slice del namespace "terminal" lo emite FloatingTerminal.astro como
// <script type="application/json" id="terminal-i18n">. Aquí leemos su sub-objeto
// `script` con un fallback en español verbatim. `tI18n` interpola {placeholder}.
type TerminalScriptMessages = {
  tabLabel: string;
  renameTabTitle: string;
  closeTabTitle: string;
  modeTerminal: string;
  countCommands: string;
  countConversations: string;
  status: {
    connected: string;
    connectedWithPid: string;
    sessionEnded: string;
    error: string;
    connectionError: string;
    reconnecting: string;
    disconnected: string;
    codexCommandCopied: string;
  };
  banner: {
    sessionRecovered: string;
    sessionConnected: string;
    sessionExited: string;
    errorPrefix: string;
    wsError: string;
    wsErrorHint: string;
    interrupted: string;
    retry: string;
    connectionClosed: string;
    connectionClosedWithReason: string;
    reconnecting: string;
  };
  loading: {
    title: string;
    detail: string;
    takingLonger: string;
    installingBackground: string;
    waitingInstall: string;
    installFailed: string;
    installerMissing: string;
  };
  snippetList: {
    empty: string;
    noResults: string;
    selectCategoryToFilter: string;
    categoryNoTags: string;
    selectCategoryToSeeTags: string;
    editTitle: string;
    editAria: string;
    deleteTitle: string;
    deleteAria: string;
    prevPage: string;
    nextPage: string;
    prevPageAria: string;
    nextPageAria: string;
    pageInfo: string;
  };
  categorySelect: {
    selectCategory: string;
    noCategories: string;
    uncategorized: string;
  };
  rename: {
    promptLabel: string;
    promptTitle: string;
  };
  dialog: {
    newSnippetTitle: string;
    editSnippetTitle: string;
    saveSnippetAction: string;
  };
  errors: {
    loadConversations: string;
    loadSnippets: string;
    saveGeneric: string;
    saveSnippet: string;
    saveCategory: string;
    saveTag: string;
    copyCommand: string;
    deleteConversation: string;
    deleteConversations: string;
  };
  confirm: {
    deleteSnippetMsg: string;
    deleteSnippetTitle: string;
    deleteCategoryMsg: string;
    deleteCategoryTitle: string;
    deleteCategoriesMsg: string;
    deleteCategoriesTitle: string;
    deleteTagMsg: string;
    deleteTagTitle: string;
    deleteTagsMsg: string;
    deleteTagsTitle: string;
    deleteOneCategory: string;
    deleteManyCategories: string;
    deleteOneTag: string;
    deleteManyTags: string;
    clearHistoryMsg: string;
    clearHistoryTitle: string;
    deleteConversationMsg: string;
    deleteConversationTitle: string;
    deleteConversationsMsg: string;
    deleteConversationsTitle: string;
    deleteOneConversation: string;
    deleteManyConversations: string;
  };
  tmux: {
    notInstalledTitle: string;
    explanation: string;
    install: string;
    cannotInstall: string;
    openWithoutPersistence: string;
    installing: string;
    installFailed: string;
    networkError: string;
  };
};

const TERMINAL_SCRIPT_FALLBACK: TerminalScriptMessages = {
  tabLabel: "Terminal {n}",
  renameTabTitle: "Renombrar pestaña",
  closeTabTitle: "Cerrar pestaña",
  modeTerminal: "Terminal",
  countCommands: "comandos",
  countConversations: "conversaciones {cli}",
  status: {
    connected: "Conectado",
    connectedWithPid: "Conectado (PID {pid})",
    sessionEnded: "Sesión terminada",
    error: "Error",
    connectionError: "Error de conexión",
    reconnecting: "Reconectando...",
    disconnected: "Desconectado",
    codexCommandCopied: "Comando de Codex copiado",
  },
  banner: {
    sessionRecovered: "✓ Sesión recuperada",
    sessionConnected: "✓ Sesión PTY conectada",
    sessionExited: "Sesión terminada (exit {code})",
    errorPrefix: "Error: {message}",
    wsError: "Error de conexión WebSocket — {url}",
    wsErrorHint: "Verifica que el backend esté en ejecución y el puerto accesible.",
    interrupted: "↺ Conexión interrumpida, reconectando...",
    retry: "↺ Reintento {attempt}/8 en {delay}s...",
    connectionClosed: "Conexión cerrada (código {code})",
    connectionClosedWithReason: "Conexión cerrada (código {code}: {reason})",
    reconnecting: "Reconectando...",
  },
  loading: {
    title: "Preparando consola opencode...",
    detail: "Verificando instalación y arrancando TUI",
    takingLonger: "Tomando más tiempo del esperado — mostrando consola igualmente.",
    installingBackground: "Instalando opencode en el servidor (en background)...",
    waitingInstall: "Esperando que opencode termine de instalarse...",
    installFailed: "La instalación de opencode falló — revisa /tmp/lxp-opencode-install.log",
    installerMissing: "No se encontró npm ni curl en el servidor; instala opencode manualmente.",
  },
  snippetList: {
    empty: "Sin snippets. Crea uno con +",
    noResults: "Sin resultados",
    selectCategoryToFilter: "Selecciona una categoría para filtrar por tags.",
    categoryNoTags: "Esta categoría no tiene tags.",
    selectCategoryToSeeTags: "Selecciona una categoría para ver sus tags.",
    editTitle: "Editar",
    editAria: "Editar snippet",
    deleteTitle: "Eliminar",
    deleteAria: "Eliminar snippet",
    prevPage: "Anterior",
    nextPage: "Siguiente",
    prevPageAria: "Página anterior",
    nextPageAria: "Página siguiente",
    pageInfo: "{start}–{end} de {total} · Pág. {page}/{pageCount}",
  },
  categorySelect: {
    selectCategory: "Selecciona una categoría",
    noCategories: "Sin categorías",
    uncategorized: "Sin categoría",
  },
  rename: {
    promptLabel: "Nombre de la terminal",
    promptTitle: "Renombrar terminal",
  },
  dialog: {
    newSnippetTitle: "Nuevo snippet",
    editSnippetTitle: "Editar snippet",
    saveSnippetAction: "Guardar snippet",
  },
  errors: {
    loadConversations: "No se pudo cargar el historial de conversaciones",
    loadSnippets: "No se pudieron cargar los snippets",
    saveGeneric: "No se pudo guardar",
    saveSnippet: "No se pudo guardar el snippet",
    saveCategory: "No se pudo guardar la categoría",
    saveTag: "No se pudo guardar el tag",
    copyCommand: "No se pudo copiar el comando",
    deleteConversation: "No se pudo eliminar la conversación",
    deleteConversations: "No se pudieron eliminar las conversaciones seleccionadas",
  },
  confirm: {
    deleteSnippetMsg: "¿Eliminar este snippet?",
    deleteSnippetTitle: "Eliminar snippet",
    deleteCategoryMsg: "¿Eliminar esta categoría? Se borrarán sus tags y snippets.",
    deleteCategoryTitle: "Eliminar categoría",
    deleteCategoriesMsg: "¿Eliminar {label}? Se borrarán sus tags y snippets.",
    deleteCategoriesTitle: "Eliminar categorías",
    deleteTagMsg: "¿Eliminar este tag?",
    deleteTagTitle: "Eliminar tag",
    deleteTagsMsg: "¿Eliminar {label}?",
    deleteTagsTitle: "Eliminar tags",
    deleteOneCategory: "esta categoría",
    deleteManyCategories: "{count} categorías",
    deleteOneTag: "este tag",
    deleteManyTags: "{count} tags",
    clearHistoryMsg: "¿Borrar todo el historial de comandos?",
    clearHistoryTitle: "Borrar historial",
    deleteConversationMsg: '¿Eliminar "{title}" del historial?',
    deleteConversationTitle: "Eliminar conversación",
    deleteConversationsMsg: "¿Eliminar {label} del historial?",
    deleteConversationsTitle: "Eliminar conversaciones",
    deleteOneConversation: "esta conversación",
    deleteManyConversations: "{count} conversaciones",
  },
  tmux: {
    notInstalledTitle: "tmux no está instalado en el servidor",
    explanation:
      "El terminal usa <strong>tmux</strong> para que tu sesión sobreviva si cambias de app o se corta la conexión y poder re-adjuntarla. Sin tmux, cada reconexión abre una shell nueva.",
    install: "Instalar tmux",
    cannotInstall:
      "No se puede instalar automáticamente en este servidor; pídelo a tu proveedor o administrador.",
    openWithoutPersistence: "Abrir sin persistencia",
    installing: "Instalando tmux…",
    installFailed: "No se pudo instalar tmux. Revisa permisos de sudo en el servidor.",
    networkError: "Error de red al instalar tmux.",
  },
};

// Lee el árbol i18n inyectado por `FloatingTerminal.astro`
// (`m.terminal.scriptMessages`) desde el `<script id="terminal-i18n">`; si no
// está o falla el parseo, cae al `TERMINAL_SCRIPT_FALLBACK` verbatim en español
// (intencional: las claves del árbol i18n son la fuente de traducción).
function loadTerminalScriptMessages(): TerminalScriptMessages {
  try {
    const el = document.getElementById("terminal-i18n");
    if (!el?.textContent) return TERMINAL_SCRIPT_FALLBACK;
    const parsed = JSON.parse(el.textContent) as { script?: Partial<TerminalScriptMessages> };
    const script = parsed.script;
    if (!script) return TERMINAL_SCRIPT_FALLBACK;
    // Merge superficial por sección para que falten claves no rompan el render.
    return {
      ...TERMINAL_SCRIPT_FALLBACK,
      ...script,
      status: { ...TERMINAL_SCRIPT_FALLBACK.status, ...(script.status ?? {}) },
      banner: { ...TERMINAL_SCRIPT_FALLBACK.banner, ...(script.banner ?? {}) },
      loading: { ...TERMINAL_SCRIPT_FALLBACK.loading, ...(script.loading ?? {}) },
      snippetList: { ...TERMINAL_SCRIPT_FALLBACK.snippetList, ...(script.snippetList ?? {}) },
      categorySelect: { ...TERMINAL_SCRIPT_FALLBACK.categorySelect, ...(script.categorySelect ?? {}) },
      rename: { ...TERMINAL_SCRIPT_FALLBACK.rename, ...(script.rename ?? {}) },
      dialog: { ...TERMINAL_SCRIPT_FALLBACK.dialog, ...(script.dialog ?? {}) },
      errors: { ...TERMINAL_SCRIPT_FALLBACK.errors, ...(script.errors ?? {}) },
      confirm: { ...TERMINAL_SCRIPT_FALLBACK.confirm, ...(script.confirm ?? {}) },
      tmux: { ...TERMINAL_SCRIPT_FALLBACK.tmux, ...(script.tmux ?? {}) },
    };
  } catch {
    return TERMINAL_SCRIPT_FALLBACK;
  }
}

// loadTerminalScriptMessages returns either the injected tree
// (`FloatingTerminal.astro` provides `m.terminal.scriptMessages` /
// `components.floatingTerminal.scriptMessages` via a JSON script) or the
// Spanish verbatim fallback below.
const I18N: TerminalScriptMessages = loadTerminalScriptMessages();

function tI18n(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined || value === null ? match : String(value);
  });
}

export { I18N, tI18n };
