import { useCallback, useRef, useState, type MutableRefObject } from "react";
import { getPanelTaxonomy, type PanelTaxonomy } from "../../api/client";
import { savePanelsCache } from "../../storage/portalDataCache";
import type { Panel, PanelInvitation } from "../../types/models";

/**
 * Sub-hook COHESIVO extraído de `useMainTabController` (fase de refactor <1000
 * líneas): taxonomía (categorías/tags) + sus mutadores locales. Tras la
 * mutación en la API actualizan el estado en memoria (sin refetch) y, cuando
 * cambian paneles (reconciliación por nombre de categoría/tag), persisten el
 * cache para que la próxima apertura hidrate ya correcto. Solo useState/useRef/
 * useCallback (CERO efectos). Código movido verbatim; los refs vivos de
 * paneles/invitaciones del controlador entran por parámetros.
 */
export function useTaxonomyActions({ token, userEmail, panelsRef, invitationsRef, setPanels }: {
  token: string | null;
  userEmail: string | null;
  panelsRef: MutableRefObject<Panel[]>;
  invitationsRef: MutableRefObject<PanelInvitation[]>;
  setPanels: (next: Panel[]) => void;
}) {
  const [taxonomy, setTaxonomy] = useState<PanelTaxonomy["categories"]>([]);
  // Ref siempre-actual para que los mutadores locales lean el estado vigente
  // (nombres antiguos al renombrar/eliminar).
  const taxonomyRef = useRef(taxonomy);
  taxonomyRef.current = taxonomy;

  // `refresh*` = refresco EXPLÍCITO (pull-to-refresh, post-mutación, recarga tras
  // 429): saltan el TTL de la caché de lecturas. El single-flight sigue
  // aplicando, así que N pestañas refrescando a la vez = UNA petición.
  const refreshTaxonomy = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getPanelTaxonomy(token, { force: true });
      setTaxonomy(data.categories ?? []);
    } catch (error) {
      console.error(error);
    }
  }, [token]);

  const persistPanels = useCallback((next: Panel[]) => {
    if (userEmail) void savePanelsCache(userEmail, { panels: next, invitations: invitationsRef.current });
  }, [userEmail]);

  const applyCategoryCreated = useCallback((category: { id: string; name: string }) => {
    setTaxonomy((prev) => (prev.some((c) => c.id === category.id) ? prev : [...prev, { ...category, tags: [] }]));
  }, []);

  const applyCategoryRenamed = useCallback((id: string, name: string) => {
    const oldName = taxonomyRef.current.find((c) => c.id === id)?.name;
    setTaxonomy((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
    if (oldName && oldName !== name) {
      const prevName = oldName;
      let changed = false;
      const next = panelsRef.current.map((p) => {
        if (p.category === prevName) { changed = true; return { ...p, category: name }; }
        return p;
      });
      if (changed) { setPanels(next); persistPanels(next); }
    }
  }, [persistPanels]);

  const applyCategoryDeleted = useCallback((id: string) => {
    const cat = taxonomyRef.current.find((c) => c.id === id);
    const delName = cat?.name;
    const delTagNames = new Set((cat?.tags ?? []).map((tg) => tg.name));
    setTaxonomy((prev) => prev.filter((c) => c.id !== id));
    if (delName) {
      let changed = false;
      const next = panelsRef.current.map((p) => {
        let np = p;
        if (p.category === delName) { np = { ...np, category: null }; changed = true; }
        if (delTagNames.size > 0 && np.tags.some((tg) => delTagNames.has(tg))) {
          np = { ...np, tags: np.tags.filter((tg) => !delTagNames.has(tg)) };
          changed = true;
        }
        return np;
      });
      if (changed) { setPanels(next); persistPanels(next); }
    }
  }, [persistPanels]);

  const applyTagCreated = useCallback((categoryId: string, tag: { id: string; name: string }) => {
    setTaxonomy((prev) => prev.map((c) => (c.id === categoryId
      ? (c.tags.some((tg) => tg.id === tag.id) ? c : { ...c, tags: [...c.tags, tag] })
      : c)));
  }, []);

  const applyTagRenamed = useCallback((id: string, name: string) => {
    let oldName: string | undefined;
    for (const c of taxonomyRef.current) {
      const tg = c.tags.find((x) => x.id === id);
      if (tg) { oldName = tg.name; break; }
    }
    setTaxonomy((prev) => prev.map((c) => ({ ...c, tags: c.tags.map((tg) => (tg.id === id ? { ...tg, name } : tg)) })));
    if (oldName && oldName !== name) {
      const prevName = oldName;
      let changed = false;
      const next = panelsRef.current.map((p) => {
        if (p.tags.includes(prevName)) { changed = true; return { ...p, tags: p.tags.map((tg) => (tg === prevName ? name : tg)) }; }
        return p;
      });
      if (changed) { setPanels(next); persistPanels(next); }
    }
  }, [persistPanels]);

  const applyTagDeleted = useCallback((id: string) => {
    let delName: string | undefined;
    for (const c of taxonomyRef.current) {
      const tg = c.tags.find((x) => x.id === id);
      if (tg) { delName = tg.name; break; }
    }
    setTaxonomy((prev) => prev.map((c) => ({ ...c, tags: c.tags.filter((tg) => tg.id !== id) })));
    if (delName) {
      const prevName = delName;
      let changed = false;
      const next = panelsRef.current.map((p) => {
        if (p.tags.includes(prevName)) { changed = true; return { ...p, tags: p.tags.filter((tg) => tg !== prevName) }; }
        return p;
      });
      if (changed) { setPanels(next); persistPanels(next); }
    }
  }, [persistPanels]);

  return {
    taxonomy, refreshTaxonomy,
    applyCategoryCreated, applyCategoryRenamed, applyCategoryDeleted,
    applyTagCreated, applyTagRenamed, applyTagDeleted,
  };
}
