// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { createContext, useContext } from "react";
import esAssistant from "@/i18n/es/assistant";
import { formatMessage } from "@/i18n/client";
import { deepMerge } from "@/i18n/deep-fill";
import {
  type TeamTemplatesMessages,
  teamTemplatesMessagesFallback,
} from "./team-templates.i18n";

export type AssistantMessages = {
  agentMarket: typeof esAssistant.agentMarket;
  agentsTab: typeof esAssistant.agentsTab;
  welcomeTitle: string;
  drawer: {
    openAriaLabel: string;
    openTitle: string;
    title: string;
    tabs: {
      // `general`, NO `dashboard`: el tipo exigía una clave `dashboard` que no
      // existe en ninguno de los 12 ficheros de idioma (todos traen `general`),
      // y ese descuadre hacía que el bundle español no encajara con este tipo.
      general: string;
      chat: string;
      agentes: string;
      providers: string;
      modules: string;
      stats: string;
      servers: string;
      access: string;
      diagnostics: string;
    };
    modeSimple: string;
    modeAdvanced: string;
    switchToAdvanced: string;
    switchToSimple: string;
    close: string;
    loadErrorPrefix: string;
    /** Toast shown when a request arrives but the assistant module is disabled. */
    moduleDisabled: string;
    /** Toast shown when a request arrives but the user lacks permission. */
    noPermission: string;
  };
  settingsModal: {
    chatProjects: {
      title: string; description: string; loading: string; loadError: string; retry: string;
      empty: string; count: string; showAll: string; hideAll: string; search: string;
      noMatches: string; hint: string; saveError: string;
    };
    buttonLabel: string;
    title: string;
    description: string;
    menuIntro: string;
    backToMenu: string;
    cards: {
      agentes: string;
      providers: string;
      modules: string;
      stats: string;
      servers: string;
      access: string;
    };
    graphCard: {
      label: string;
      description: string;
    };
    defaultTabs: {
      agentsTitle: string;
      agentsDescription: string;
      conversationsTitle: string;
      conversationsDescription: string;
    };
  };
  chatTab: {
    agentShortcuts: {
      heading: string; description: string; empty: string; select: string; unread: string;
      available: string; running: string; waiting: string; failed: string; done: string;
      loading: string; unavailable: string;
    };
    loadingTitle: string;
    loadingDescription: string;
    disabledTitle: string;
    noProvidersTitle: string;
    noProvidersDescription: string;
    goToProviders: string;
    addNew: string;
    /** OPCIONALES: no existen en NINGUNO de los 12 ficheros de idioma. Sus
     *  consumidores ya lo saben y caen a un literal (`CodeBlock`/`ChatPane` usan
     *  `?? "Copiar"`, `AssistantFileEditorModal` usa `?? {}`), así que en la
     *  práctica estos textos hoy NO están traducidos. El tipo los declaraba
     *  obligatorios, lo cual era mentira y además impedía que el bundle español
     *  encajara con él. Si se traducen algún día, quítales el `?`. */
    copyLabel?: string;
    copyDone?: string;
    copyChatId: string;
    fileEditor?: {
      readError: string;
      saveError: string;
      unsavedConfirm: string;
      editFileTitle: string;
      viewDiffTitle: string;
      editTab: string;
      diffTab: string;
      saving: string;
      save: string;
      saved: string;
      closeTitle: string;
    };
    toolTrace: {
      historyTruncated: string;
      waiting: string;
      unconfirmed: string;
      running: string;
      stopped: string;
      viewHistory: string;
      done: string;
      withWarnings: string;
      ok: string;
      error: string;
      runningOnServer: string;
      expandFullscreen: string;
      orchestrator: string;
      subagent: string;
      closeFullscreen: string;
      serverConsole: string;
    };
    /** Tooltip on the header agent chip, {name} placeholder. */
    agentChipTitle: string;
    /** Aria-label on the header agent chip, {name} placeholder. */
    agentChipAria: string;
  };
  dashboardTab: {
    title: string;
    activeSubtitle: string;
    recentSubtitle: string;
    refresh: string;
    loading: string;
    emptyTitle: string;
    startChat: string;
    all: string;
    activeCount: string;
    recentCount: string;
    conversationFallback: string;
    runningPreview: string;
    responseReady: string;
    noPreview: string;
    runningBadge: string;
    unreviewedBadge: string;
    /** Pagination indicator: "{page} de {total}". */
    pageOf: string;
    /** Total conversation counter: "{count} conversaciones". */
    totalCount: string;
    /** Filtered result counter for the current view: "{count} resultados". */
    resultsCount: string;
    /** Visible range summary: "Mostrando {from}-{to} de {total}". */
    showingRange: string;
    /** Placeholder for the dashboard text search input. */
    searchPlaceholder: string;
    /** Label for the "show chats from any project" picker option. */
    allProjects: string;
    /** Placeholder for the project picker's internal text search. */
    searchProjects: string;
    /** Generic label for the project picker when a project is selected but its
     *  title can't be resolved. */
    projectFilterLabel: string;
    /** Tooltip/aria-label for the "clear all active filters" button. */
    clearFilters: string;
    /** Empty state shown when filters match no chats but the dashboard has chats. */
    filterEmpty: string;
    /** Heading for the agents bucket with no assigned role. */
    noRoleGroupTitle: string;
    /** Pluralized agent count badge for a work group: "{count} agentes". */
    agentsGroupCount: string;
    /** Tooltip/aria-label for the bulk-delete-group trash button. */
    deleteGroupTitle: string;
    /** Modal title with {name} placeholder for the group being deleted. */
    deleteGroupModalTitle: string;
    /** Modal body warning with {count} placeholder for the number of agents. */
    deleteGroupModalBody: string;
    /** Amber note shown when shared agents are skipped, {count} placeholder. */
    deleteGroupSharedNote: string;
    /** Confirm button label for the group delete modal. */
    deleteGroupConfirm: string;
    /** Error message listing agents that failed to delete, {names} placeholder. */
    deleteGroupErrors: string;
    /** Tooltip/aria for the Gmail-style per-agent thread count badge: "{count} conversaciones". */
    groupCountTitle: string;
    /** Tooltip explaining the per-agent chat-count badge: "{count} conversaciones con este agente". */
    countTooltip: string;
    /** Aria-label to expand an agent's collapsed thread group, {agent}/{count} placeholders. */
    groupExpandAria: string;
    /** Aria-label to collapse an agent's expanded thread group, {agent} placeholder. */
    groupCollapseAria: string;
  };
  providersTab: {
    loading: string;
    all: string;
    showInChat: string;
    showInputBubble: string;
    showOutputBubble: string;
    apiKeyMode: string;
    localCliMode: string;
    cliModel: string;
    model: string;
    apiKey: string;
    /** Override label for providers that use a different credential shape (e.g.
     *  MiniMax's "Subscription Key (sk-cp)" instead of a generic "API Key"). */
    apiKeySubscription?: string;
    replacePlaceholder: string;
    pasteApiKeyPlaceholder: string;
    /** Override placeholder for the Subscription Key field (MiniMax). */
    pasteSubscriptionKeyPlaceholder?: string;
    /** Hint shown below the Subscription Key input (MiniMax CLI mode). */
    pasteSubscriptionKeyHint?: string;
    toggleSecret: string;
    test: string;
    save: string;
    cliReady: string;
    cliNotInstalled: string;
    cliStatusManaged: string;
    installCliHint: string;
    openTerminal: string;
    refreshStatus: string;
    noStableCli: string;
    useApiMode: string;
    chooseModel: string;
    otherModel: string;
    copyCommand: string;
    testing: string;
    okPrefix: string;
    warningPrefix: string;
    providerHeading: string;
    autoRoutingTitle: string;
    autoRoutingDesc: string;
    autoRoutingEnable: string;
    autoRoutingMaxTier: string;
    tierLow: string;
    tierMedium: string;
    tierHigh: string;
    tierMax: string;
    showModifiedFiles: string;
    showModifiedFilesHint: string;
    terminalLive: string;
    terminalLiveHint: string;
  };
  statsTab: {
    storage: string;
    refresh: string;
    imagesAttachments: string;
    chatsHistory: string;
    total: string;
    clearImages: string;
    clearChats: string;
    confirmClearImages: string;
    confirmClearChats: string;
    model: string;
    all: string;
    fromDate: string;
    sort: string;
    newest: string;
    oldest: string;
    project: string;
    userId: string;
    chatId: string;
    inputTokens: string;
    outputTokens: string;
    dailyUsage: string;
    noDataForFilters: string;
    history: string;
    date: string;
    mode: string;
    noRecords: string;
    loading: string;
    estimatedSuffix: string;
    callsSuffix: string;
    headroomRaw: string;
    headroomSent: string;
    headroomSaved: string;
    headroomSavedPct: string;
    costApiTitle: string;
    costApiDescription: string;
    costApiDefaultRateTooltip: string;
    costApiFootnote: string;
    chartBar: string;
    chartLine: string;
    chartHeatmap: string;
    chartTotalLabel: string;
    chartInputLabel: string;
    chartOutputLabel: string;
    heatmapDayMon: string;
    heatmapDayTue: string;
    heatmapDayWed: string;
    heatmapDayThu: string;
    heatmapDayFri: string;
    heatmapDaySat: string;
    heatmapDaySun: string;
    heatmapLess: string;
    heatmapMore: string;
    heatmapOutOfRange: string;
    heatmapTitle: string;
    heatmapTotalSuffix: string;
    deltaFrom: string;
    deltaUp: string;
    deltaDown: string;
    deltaNew: string;
    deltaPrevZero: string;
    /** Opción "— Sin proyecto" del selector de proyecto. */
    noProject: string;
    /** Cabeceras de la tabla de uso: tokens de entrada / salida / coste. */
    in: string;
    out: string;
    usd: string;
    /** Etiqueta del eje y del tooltip de la gráfica de tokens. */
    chartTokens: string;
    /** Placeholder of the user combobox (top filter). */
    selectUser: string;
    /** Placeholder of the chat combobox (top filter). */
    selectChat: string;
    /** Aria-label for the internal text search of the user combobox. */
    searchUsers: string;
    /** Aria-label for the internal text search of the chat combobox. */
    searchChats: string;
    /** Empty-state when the combobox search has no match. */
    noMatches: string;
    /** Tooltip/aria-label for the "clear selection" button on each combobox. */
    clearSelection: string;
  };
  translationSettings: {
    loading: string;
    title: string;
    description: string;
    yourLanguage: string;
    autoDetect: string;
    economicalProvider: string;
    modelLabel: string;
    modeLabel: string;
    modeApi: string;
    modeCli: string;
    noActiveProviders: string;
    engineArgos: string;
    argosDescription: string;
    argosUrlPlaceholder: string;
    serverUrl: string;
    serverUrlPlaceholder: string;
    optionalApiKey: string;
    testEngine: string;
    ok: string;
    error: string;
    genericFailure: string;
    engineSwitched: string;
    engineDisabled: string;
    reason: string;
    autoFollowActive: string;
    savedHint: string;
    save: string;
    passwordPlaceholder: string;
    deeplApiKey: string;
    googleApiKey: string;
    libreApiKey: string;
    /** Sufijo del motor que aún no tiene credenciales configuradas. */
    notConfigured: string;
    /** Título de la sección de credenciales de los motores. */
    enginesCredentials: string;
  };
  notifySettings: {
    title: string;
    description: string;
    saveError: string;
  };
  voiceSettings: {
    title: string;
    description: string;
    missingCapabilities: string;
    inputLabel: string;
    outputLabel: string;
    notAvailable: string;
    voiceLabel: string;
    autoSpeak: string;
    audioProvider: string;
    providerApi: string;
    providerPiper: string;
    providerMinimax: string;
    providerApiHint: string;
    piperReady: string;
    piperMissing: string;
    minimaxReady: string;
    minimaxMissing: string;
    minimaxAuthMissing: string;
    minimaxVoiceHint: string;
  };
  skillsSettings: {
    title: string;
    helper: string;
    tokenNote: string;
    search: string;
    allCategories: string;
    loading: string;
    empty: string;
    noMatch: string;
    sourcePrefix: string;
    errorGeneric: string;
    activeShown: string;
  };
  teamTemplates: TeamTemplatesMessages;
  /** Textos del boundary de errores del asistente.
   *
   *  El nombre de la clave Y el de su campo deben casar con los ficheros de
   *  idioma (`assistantErrorBoundary.errorMessage`). El tipo declaraba
   *  `errorBoundary.loadError`, que no existe en ningún fichero de idioma, y por
   *  eso el cast del bundle español a este tipo no compilaba. */
  assistantErrorBoundary: {
    errorMessage: string;
    retry: string;
  };
  /** Team delegation board: live progress cards of tasks a leader agent
   *  assigned to its subordinates (team.assign). */
  teamBoard: {
    title: string;
    /** "{done} de {total} tareas completadas" */
    progressOf: string;
    statusPending: string;
    statusRunning: string;
    statusDone: string;
    statusFailed: string;
    statusCanceled: string;
    pendingPermission: string;
    openChat: string;
    cancel: string;
    cancelConfirm: string;
    /** "Asignada a {agent}" */
    assignedTo: string;
    /** System chip over automatic (nudge) turns. */
    autoTurn: string;
    /** Dashboard widget title. */
    dashboardTitle: string;
    /** Cost footer: "Tokens: {total} (líder {leader} · equipo {workers})". */
    tokensSummary: string;
    /** Chip for tasks deferred by quota/lease ("en cola"). */
    statusQueued: string;
    /** Verify ("definition of done") badges. */
    verifyRunning: string;
    verifyPassed: string;
    /** "Verificación falló ({attempts})" */
    verifyFailed: string;
    /** Artifacts chip: "{count} archivo(s)". */
    filesChanged: string;
    viewDiff: string;
    diffTitle: string;
    diffUnavailable: string;
    diffTruncated: string;
    branchIntegrated: string;
    /** Duration formatter fallback (< 1s). */
    lessThan1s: string;
    /** "+{count}" artifact insertion chip. */
    insertions: string;
    /** "−{count}" artifact deletion chip (uses U+2212 minus sign). */
    deletions: string;
    /** Cancel-all header button + confirm. */
    cancelAll: string;
    cancelAllConfirm: string;
    /** Manual task assignment modal. */
    addTask: string;
    addTaskTitle: string;
    addTaskWorker: string;
    addTaskWorkerPlaceholder: string;
    addTaskNoWorkers: string;
    addTaskInstruction: string;
    addTaskInstructionHint: string;
    addTaskTitleField: string;
    addTaskProject: string;
    addTaskProjectNone: string;
    addTaskSubmit: string;
    addTaskSubmitting: string;
    /** 👍/👎 feedback buttons. */
    feedbackUp: string;
    feedbackDown: string;
    /** Live org chart toggle. */
    orgChart: string;
    close: string;
    loading: string;
    tokensChipTitle: string;
  };
  /** Compact agent metadata chips (role pill + provider/model pill) shared by
   *  the Dashboard rows and the chat top bar. */
  agentInfo: {
    /** Short label for the role pill / aria. */
    roleLabel: string;
    /** Role pill tooltip: "Rol del agente: {role}". */
    roleTooltip: string;
    /** Short label for the provider chip / aria. */
    providerLabel: string;
    /** Provider+model pill tooltip: "Proveedor {provider} · Modelo {model}". */
    providerModelTooltip: string;
  };
};

// Compose the Spanish fallback from the es/assistant bundle (large, includes
// every other namespace) and the teamTemplates fallback. We keep them split
// because the teamTemplates namespace has been deliberately moved to its own
// file (`./team-templates.i18n`) so the wizard can ship independently.
const esAssistantBundle: Omit<AssistantMessages, "teamTemplates"> = esAssistant;
export const assistantMessagesFallback: AssistantMessages = {
  ...esAssistantBundle,
  teamTemplates: teamTemplatesMessagesFallback,
};

// Deep-merge the fetched locale messages over the Spanish fallback. The assistant
// namespace has ~35 top-level keys (modulesTab, serversTab, projectModal,
// officeConnectors, the top-level scalars, …); a per-key merge that only listed a
// few of them left the rest stuck on the Spanish fallback in every non-es locale.
// This fills EVERY key from the fetched locale and only falls back to Spanish for
// keys the locale genuinely lacks.
//
// The merge itself lives in `@/i18n/deep-fill` (F-10) — it is the same algorithm
// the SSR loader uses. It ALSO falls back to the base whenever the locale value
// is `undefined` (not just when the key is missing): a spread-then-override
// merge PRESERVED `undefined` slots, so `t.chatTab.fileEditor.readError` could
// still throw "Cannot read properties of undefined" and downstream renders
// comparing by `===` looped into React #300.
export function mergeAssistantMessages(next: Partial<AssistantMessages>): AssistantMessages {
  return deepMerge(assistantMessagesFallback, next);
}

/**
 * Generic deep-merge helper for any partial namespace merge.
 *
 * Roughly 18 floating-assistant files contained near-identical helpers like:
 *   `function useOfficeConnectorsMessages() {
 *      const i18n = useAssistantI18n() as ... & { officeConnectors?: Partial<...> };
 *      return { ...officeConnectorsFallback, ...i18n.officeConnectors };
 *    }`
 * — a flat merge that loses nested translations. This helper does the same
 * thing the audit flagged: deep-merge the locale-resolved slice on top of
 * the module's static fallback, so SSR fallback stays correct and partial
 * overrides keep their hierarchy.
 *
 * Usage:
 *   `useAssistantI18nNs("agentsTab", agentsTabFallback)`
 *   or, with explicit typing:
 *   `mergeNamespaces(agentsTabFallback, ns.agentsTab)`
 */
export function mergeNamespaces<T>(fallback: T, override?: Partial<T>): T {
  return deepMerge(fallback, override);
}

const AssistantI18nContext = createContext<AssistantMessages>(assistantMessagesFallback);

export function AssistantI18nProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: AssistantMessages;
}) {
  return <AssistantI18nContext.Provider value={value}>{children}</AssistantI18nContext.Provider>;
}

export function useAssistantI18n(): AssistantMessages {
  return useContext(AssistantI18nContext);
}

export function formatAssistantMessage(template: string | undefined, vars: Record<string, string | number>): string {
  // Defensive: a missing i18n key in any locale used to crash the whole
  // assistant with "Cannot read properties of undefined (reading 'replace')"
  // (see StatsTab delta* keys). Coalesce to a token so the call site still
  // renders something useful and the ErrorBoundary doesn't take over.
  if (typeof template !== "string") return "";
  // `onMissing: "empty"` keeps this flavor's historical behavior (an unknown
  // `{placeholder}` disappears instead of being echoed back) — see T-08.
  return formatMessage(template, vars, { onMissing: "empty" });
}
