import { useRef, useState } from "react";
import { useViewContext } from "../view-context";
import { useModuleVisibility } from "../module-visibility";
import ModuleFrame from "../module-frame";
import LogsPanel from "@/components/module-dev/LogsPanel";
import LogsSettings from "@/components/module-dev/LogsSettings";
import { DIALOG_CHROME } from "@/lib/ui-classes";

export default function ModuleLogsView() {
  const context = useViewContext(); const active = useModuleVisibility();
  const labels = context.messages.moduleDev.logs;
  const [view, setView] = useState<"luxipanel" | "modules">("luxipanel");
  const settings = useRef<HTMLDialogElement>(null);
  return <ModuleFrame title="LOG" activeModule="module-dev" flush>
    <div slot="title-actions" data-view-settings-modal>
      <button id="module-dev-log-settings-trigger" type="button" onClick={() => settings.current?.showModal()} aria-label={labels.settings}><i className="ti ti-settings" /></button>
      <dialog ref={settings} id="module-dev-log-settings-modal" data-lxp-module-settings data-lxp-modal-wide className={`w-[min(95vw,72rem)] max-w-5xl ${DIALOG_CHROME}`}>
        <header className="flex items-center justify-between border-b border-border p-4"><h2 className="font-semibold">{labels.settings}</h2><button type="button" className="min-h-11 min-w-11" aria-label={labels.close} onClick={() => settings.current?.close()}><i className="ti ti-x" /></button></header>
        <div className="min-h-0 flex-1 overflow-auto"><LogsSettings labels={labels} /></div>
      </dialog>
    </div>
    <div className="flex h-full min-h-[28rem] flex-col">
      <nav className="flex shrink-0 gap-2 border-b border-border px-4" role="tablist" aria-label="LOG">
        {([['luxipanel', 'LUXIPANEL'], ['modules', labels.modulesTab]] as const).map(([id, label]) => <button type="button" key={id} role="tab" aria-selected={view === id} className={`min-h-11 border-b-2 px-3 text-sm ${view === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`} onClick={() => setView(id)}>{label}</button>)}
      </nav>
      <section role="tabpanel" className="min-h-0 flex-1"><LogsPanel labels={labels} active={active} view={view} /></section>
    </div>
  </ModuleFrame>;
}
