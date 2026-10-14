import { useContext, useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { getMessages } from "../i18n";
import {
  ApiTab,
  CategoriesTagsTab,
  IntegrationsTab,
  SshKeysTab,
  type DataTableSettingsAdvanced,
} from "./DataTableSettings";
import { BlogReaderTab } from "./BlogReaderTab";
import { ErrorBoundary } from "./ErrorBoundary";
import { AsideCollapseContext } from "./PanelCardGrid";

type ConfigTab = "categories_tags" | "ssh_keys" | "integrations" | "api" | "blog";

/**
 * Configuración de servidores embebida en el lateral derecho del dashboard
 * (Categorías, Tags, SSH Keys, Integraciones, API), un tab por sección.
 * Reemplaza al antiguo `ServersDocsPanel` (docs SSH/API) y al modal de
 * "Configurar": reutiliza los mismos tabs que vivían en `DataTableSettings`.
 */
export function ServersConfigPanel({
  advanced,
  language,
}: {
  advanced: DataTableSettingsAdvanced;
  language?: string;
}) {
  const t = getMessages(language);
  const [tab, setTab] = useState<ConfigTab>("blog");
  // Handler para colapsar el lateral, provisto por PanelCardGrid. Cuando existe
  // (layout de dos columnas) renderizamos el botón a la izquierda de los tabs.
  const collapseAside = useContext(AsideCollapseContext);

  // Refresca los datos de la sección activa SOLO al cambiar de tab. NO se debe
  // depender de `advanced`: es un objeto recreado en cada render del dashboard,
  // así que incluirlo re-ejecutaba el refresh en cada render → setState →
  // re-render → refresh → bucle infinito de peticiones (tumbaba el servidor).
  // Las funciones `refresh*` son estables (useCallback por token).
  useEffect(() => {
    if (tab === "categories_tags") void advanced.refreshTaxonomy();
    else if (tab === "ssh_keys") void advanced.refreshSshKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const tabs: Array<{ id: ConfigTab; label: string }> = [
    { id: "blog", label: t.dataTableSettings.tabs.blog },
    { id: "ssh_keys", label: t.dataTableSettings.tabs.sshKeys },
    { id: "categories_tags", label: `${t.dataTableSettings.tabs.categories} & ${t.dataTableSettings.tabs.tags}` },
    { id: "integrations", label: t.dataTableSettings.tabs.integrations },
    { id: "api", label: t.dataTableSettings.tabs.api },
  ];

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <div role="tablist" className="join w-full min-w-0 shrink-0">
        {collapseAside ? (
          <button
            type="button"
            className="btn btn-sm lp-seg-tab join-item btn-outline shrink-0 px-2"
            onClick={collapseAside}
            title={t.dashboard.collapsePanel}
            aria-label={t.dashboard.collapsePanel}
          >
            <ChevronRight size={16} />
          </button>
        ) : null}
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            className={`btn btn-sm lp-seg-tab join-item flex-1 min-w-0 ${tab === entry.id ? "is-active" : "btn-outline"}`}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {/* Cada tab puede fallar en render (datos remotos, HTML del blog, etc.).
          El ErrorBoundary lo aísla: un crash muestra el mensaje del error con
          opción de reintentar, en vez de tumbar toda la app a pantalla blanca.
          La `key` por tab resetea el boundary al cambiar de sección. */}
      <ErrorBoundary key={tab} label={tabs.find((entry) => entry.id === tab)?.label} retryLabel={t.common.refresh}>
        <div className="flex min-h-0 flex-1 flex-col">
          {tab === "categories_tags" ? <CategoriesTagsTab advanced={advanced} t={t} language={language} fillHeight /> : null}
          {tab === "ssh_keys" ? <SshKeysTab advanced={advanced} t={t} language={language} fillHeight /> : null}
          {tab === "blog" ? <BlogReaderTab token={advanced.token} t={t} language={language} fillHeight /> : null}
          {tab === "integrations" ? <IntegrationsTab token={advanced.token} t={t} language={language} fillHeight /> : null}
          {tab === "api" ? <ApiTab token={advanced.token} t={t} /> : null}
        </div>
      </ErrorBoundary>
    </div>
  );
}
