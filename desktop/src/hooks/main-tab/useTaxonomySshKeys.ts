import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { getPanelTaxonomy, getSshKeys, type PanelTaxonomy, type SshKeySummary } from "../../api/client";
import type { Panel } from "../../types/models";

/**
 * Taxonomía (categorías/tags) + bóveda de llaves SSH del controlador de
 * pestaña principal, extraído de `useMainTabController` SIN cambios de
 * comportamiento. Incluye los mutadores locales: tras una mutación exitosa en
 * la API actualizamos el estado en memoria en vez de re-consultar la
 * taxonomía/los paneles. Los paneles referencian categoría/tags por NOMBRE,
 * así que al renombrar/eliminar reconciliamos los paneles afectados localmente
 * (sin refetch) — por eso recibe el `setPanels` del controlador.
 */
export function useTaxonomySshKeys({ token, setPanels }: {
  token: string | null;
  setPanels: Dispatch<SetStateAction<Panel[]>>;
}) {
  const [taxonomy, setTaxonomy] = useState<PanelTaxonomy["categories"]>([]);
  const [sshKeys, setSshKeys] = useState<SshKeySummary[]>([]);
  // Última taxonomía disponible para los mutadores locales (leer nombres
  // antiguos al renombrar/eliminar sin depender de cierres obsoletos).
  const taxonomyRef = useRef(taxonomy);
  // eslint-disable-next-line react-hooks/refs -- patrón latest-ref: espejo del estado para callbacks
  taxonomyRef.current = taxonomy;

  const refreshTaxonomy = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getPanelTaxonomy(token);
      setTaxonomy(data.categories ?? []);
    } catch (error) {
      console.error(error);
    }
  }, [token]);

  const refreshSshKeys = useCallback(async () => {
    if (!token) return;
    try {
      const keys = await getSshKeys(token);
      setSshKeys(keys);
    } catch (error) {
      console.error(error);
    }
  }, [token]);

  // ── Mutadores locales de taxonomía / SSH keys ──────────────────────────
  const applyCategoryCreated = useCallback((category: { id: string; name: string }) => {
    setTaxonomy((prev) => (prev.some((c) => c.id === category.id) ? prev : [...prev, { ...category, tags: [] }]));
  }, []);

  const applyCategoryRenamed = useCallback((id: string, name: string) => {
    const oldName = taxonomyRef.current.find((c) => c.id === id)?.name;
    setTaxonomy((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
    if (oldName && oldName !== name) {
      const prevName = oldName;
      setPanels((prev) => prev.map((p) => (p.category === prevName ? { ...p, category: name } : p)));
    }
  }, [setPanels]);

  const applyCategoryDeleted = useCallback((id: string) => {
    const cat = taxonomyRef.current.find((c) => c.id === id);
    const delName = cat?.name;
    const delTagNames = new Set((cat?.tags ?? []).map((tg) => tg.name));
    setTaxonomy((prev) => prev.filter((c) => c.id !== id));
    if (delName) {
      setPanels((prev) => prev.map((p) => {
        let next = p;
        if (p.category === delName) next = { ...next, category: null };
        if (delTagNames.size > 0 && next.tags.some((tg) => delTagNames.has(tg))) {
          next = { ...next, tags: next.tags.filter((tg) => !delTagNames.has(tg)) };
        }
        return next;
      }));
    }
  }, [setPanels]);

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
      setPanels((prev) => prev.map((p) => (p.tags.includes(prevName)
        ? { ...p, tags: p.tags.map((tg) => (tg === prevName ? name : tg)) }
        : p)));
    }
  }, [setPanels]);

  const applyTagDeleted = useCallback((id: string) => {
    let delName: string | undefined;
    for (const c of taxonomyRef.current) {
      const tg = c.tags.find((x) => x.id === id);
      if (tg) { delName = tg.name; break; }
    }
    setTaxonomy((prev) => prev.map((c) => ({ ...c, tags: c.tags.filter((tg) => tg.id !== id) })));
    if (delName) {
      const prevName = delName;
      setPanels((prev) => prev.map((p) => (p.tags.includes(prevName)
        ? { ...p, tags: p.tags.filter((tg) => tg !== prevName) }
        : p)));
    }
  }, [setPanels]);

  const applySshKeyCreated = useCallback((key: SshKeySummary) => {
    setSshKeys((prev) => (prev.some((k) => k.id === key.id) ? prev.map((k) => (k.id === key.id ? key : k)) : [...prev, key]));
  }, []);

  const applySshKeyUpdated = useCallback((key: SshKeySummary) => {
    setSshKeys((prev) => prev.map((k) => (k.id === key.id ? key : k)));
  }, []);

  const applySshKeyDeleted = useCallback((id: string) => {
    setSshKeys((prev) => prev.filter((k) => k.id !== id));
  }, []);

  return {
    taxonomy,
    sshKeys,
    refreshTaxonomy,
    refreshSshKeys,
    applyCategoryCreated,
    applyCategoryRenamed,
    applyCategoryDeleted,
    applyTagCreated,
    applyTagRenamed,
    applyTagDeleted,
    applySshKeyCreated,
    applySshKeyUpdated,
    applySshKeyDeleted,
  };
}
