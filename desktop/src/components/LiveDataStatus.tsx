import { resourcesForModule } from "../lib/native-live-read";
import { useDataFreshness } from "../lib/use-live-module-data";
import { refreshServerData } from "../lib/server-data-events";
import { liveDataLabels } from "../lib/live-data-labels";
export function LiveDataStatus({serverId, moduleId, language}: {serverId:string; moduleId:string; language?:string}) {
  const resources = resourcesForModule[moduleId] ?? [];
  const freshness = useDataFreshness(serverId, resources), labels = liveDataLabels(language ?? "en");
  if (!resources.length || !freshness) return null;
  return <div className="flex items-center justify-end gap-3 py-1 text-xs text-base-content/60"><span role="status">{labels[freshness.state]}{freshness.collectedAt ? ` · ${new Date(freshness.collectedAt*1000).toLocaleTimeString(language)}` : ""}</span><button type="button" className="underline" disabled={freshness.state === "updating"} onClick={() => void refreshServerData(serverId, resources)}>{labels.refresh}</button></div>;
}
