import { nativeText } from '../../i18n/native-text';
import { callServerApi, unwrap, withFreshGateway } from "../../api/serverApi";
import { NATIVE_MODULE_IDS } from "../main/shell-types";

type Access = {
  modules?: { assistant?: boolean; terminal?: boolean };
  available?: Array<{ id: string; name?: string }>;
};

export type NativeModuleCatalog = { ids: Set<string>; available: Array<{ id: string; name?: string }> };
export type NativeSidebarModule = { id: string; name?: string; showInSidebar?: boolean };

/** Read the same ordered display catalog as PanelLayout, including Terminal's opt-in. */
export async function fetchNativeModuleMenu(panelId: string): Promise<NativeModuleCatalog & { sidebar: NativeSidebarModule[] }> {
  const readSidebar = async () => {
    const result = await withFreshGateway(() => callServerApi(panelId, "", "GET", "/api/modules/installed"));
    const installed = result.ok ? unwrap<NativeSidebarModule[]>(result) : null;
    if (Array.isArray(installed)) return installed;
    // Same compatibility path as the web. Both endpoints enforce the current session.
    const fallback = await withFreshGateway(() => callServerApi(panelId, "", "GET", "/api/admin/modules"));
    const all = fallback.ok ? unwrap<Array<NativeSidebarModule & { enabled?: boolean; installed?: boolean }>>(fallback) : null;
    if (!Array.isArray(all)) throw new Error(fallback.error ?? result.error ?? nativeText("No se pudo cargar el orden del menú."));
    return all.filter(module => Boolean(module.enabled ?? module.installed));
  };
  const [catalog, sidebar] = await Promise.all([fetchNativeModuleCatalog(panelId), readSidebar()]);
  return { ...catalog, sidebar };
}

/** Conserva el orden del catálogo habilitado que utiliza el menú web. */
export async function fetchNativeModuleCatalog(panelId: string): Promise<NativeModuleCatalog> {
  const result = await withFreshGateway(() => callServerApi(panelId, "", "GET", "/api/me/modules"));
  if (!result.ok) throw new Error(result.error ?? nativeText("No se pudieron cargar los módulos de este servidor."));
  const body = unwrap<Access>(result);
  if (!body || !Array.isArray(body.available)) throw new Error(nativeText("El servidor devolvió un catálogo de módulos inválido."));
  const ids = new Set<string>(["chat", "preferences", "modules", "settings", "server-alerts"]);
  if (body.modules?.assistant) ids.add("assistant");
  if (body.modules?.terminal) ids.add("terminal");
  for (const module of body.available) {
    if (NATIVE_MODULE_IDS.has(module.id)) ids.add(module.id);
  }
  // La web ofrece Mapa de proyectos como subvista de Mis módulos, sin entrada
  // propia en el catálogo del backend.
  if (ids.has("module-dev")) ids.add("project-map");
  return { ids, available: body.available.filter((module) => ids.has(module.id)) };
}

export async function fetchNativeModuleAccess(panelId: string): Promise<Set<string>> {
  return (await fetchNativeModuleCatalog(panelId)).ids;
}
