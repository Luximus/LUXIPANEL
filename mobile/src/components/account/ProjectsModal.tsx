import { useConfirmation } from "../ui/useConfirmation";
import React, { useEffect, useMemo, useState } from "react";
import { PanelText as Text } from "../ui/PanelText";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Check, ChevronDown, ChevronRight, Folder, Plus, Search, Trash2, X } from "lucide-react-native";
import { luxAssistantProxy } from "../../api/client";
import { getMessages } from "../../i18n";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { FormSheet } from "../ui/FormSheet";
import { strings } from "../assistant/strings";
import { rootProjectId, rootProjects } from "../../features/assistant/project-scope";

type ProjectRelation = "owner" | "shared";
type Project = {
  id: string; title?: string; name?: string; icon?: string; parentId?: string | null;
  createdAt?: string; updatedAt?: string;
  /** Anotado por LUXIPANEL: `owner` = creado por ti; `shared` = creado por otro
   *  usuario del servidor (visible porque el store de proyectos es global). */
  relation?: ProjectRelation; ownerId?: number | null; ownerName?: string | null;
};
type Filter = "all" | "owner" | "shared";

/**
 * Pantalla "Todos los proyectos" (estilo ChatGPT): buscador + crear + lista de
 * proyectos del servidor (icono + nombre + fecha) con borrar. El backend vive en
 * LUXIPANEL (`/api/ai/projects` vía el proxy SSH); los proyectos son por usuario
 * del servidor (no hay compartidos), así que no hay chips Creados/Compartidos.
 */
export function ProjectsModal({
  visible,
  onClose,
  panelId,
  token,
  language,
  activeProjectId,
  onPick,
  createOnOpen = false,
  pickerOnly = false,
}: {
  visible: boolean;
  createOnOpen?: boolean;
  /** Selector del chat: igual que la web, solo chats sueltos y proyectos raíz. */
  pickerOnly?: boolean;
  onClose: () => void;
  panelId: string;
  token: string;
  language?: string;
  /** Proyecto seleccionado en el chat (para resaltarlo). */
  activeProjectId?: string;
  /** Elegir un proyecto: inicia un chat en él y cierra. Cadena vacía = suelto. */
  onPick: (projectId: string) => void;
}) {
  const { askConfirmation, confirmation } = useConfirmation(language);
  const t = strings(language);
  const common = getMessages(language).common;
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");

  const [expanded,setExpanded]=useState(new Set<string>());
  const [rootLimit,setRootLimit]=useState(8);
  const [error,setError]=useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const load = async () => {
    if (!token || !panelId) return;
    setBusy(true);
    try {
      const res = await luxAssistantProxy<{ projects?: Project[]; items?: Project[] } | Project[]>(panelId, token, "GET", "/api/ai/projects");
      if(res==null){setError(t.error);return;}setError("");
      const list = Array.isArray(res) ? res : (res?.projects ?? res?.items ?? []);
      setProjects(Array.isArray(list) ? list : []);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!visible) { setCreating(false); setNewName(""); setSearch(""); setFilter("all"); return; }
    setCreating(createOnOpen);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, panelId, token]);

  const label = (p: Project) => p.name ?? p.title ?? p.id.slice(0, 8);
  const dateLabel = (p: Project) => {
    const iso = p.updatedAt ?? p.createdAt;
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(language || undefined, { day: "numeric", month: "short" });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = q ? projects.filter((p) => label(p).toLowerCase().includes(q)) : projects;
    if (filter === "owner") list = list.filter((p) => p.relation !== "shared");
    else if (filter === "shared") list = list.filter((p) => p.relation === "shared");
    return [...list].sort((a, b) => label(a).localeCompare(label(b)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, search, filter]);

  // Árbol por `parentId` (proyectos anidados bajo el proyecto al que pertenecen):
  // raíces + hijos recursivos, aplanado a `{ project, depth }` para una sola lista
  // con sangría por nivel (sin ScrollViews anidados). Solo se usa en la vista por
  // defecto; al buscar o filtrar se muestra la lista PLANA de coincidencias (anidar
  // un subconjunto filtrado rompería la jerarquía).
  const tree = useMemo(() => {
    const ids = new Set(projects.map((p) => p.id));
    const childrenMap = new Map<string, Project[]>();
    const roots: Project[] = [];
    for (const p of projects) {
      const pid = p.parentId && ids.has(p.parentId) ? p.parentId : null;
      if (pid) {
        const arr = childrenMap.get(pid) ?? [];
        arr.push(p);
        childrenMap.set(pid, arr);
      } else {
        roots.push(p);
      }
    }
    const byName = (a: Project, b: Project) => label(a).localeCompare(label(b));
    roots.sort(byName);
    childrenMap.forEach((arr) => arr.sort(byName));
    const flat: { project: Project; depth: number }[] = [];
    const walk = (p: Project, depth: number) => {
      if(flat.some(row=>row.project.id===p.id))return;
      flat.push({ project: p, depth });
      if(expanded.has(p.id))(childrenMap.get(p.id) ?? []).forEach((c) => walk(c, depth + 1));
    };
    roots.slice(0,rootLimit).forEach((r) => walk(r, 0));
    return flat;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects,expanded,rootLimit]);

  // Vista por defecto = árbol anidado; al buscar/filtrar = lista plana.
  const showTree = !search.trim() && filter === "all";

  const createProject = async () => {
    const title = newName.trim();
    if (!title || saving) return;
    setSaving(true);
    try {
      const result=await luxAssistantProxy(panelId, token, "POST", "/api/ai/projects", { title });
      if(result==null){setError(t.error);return;}setError("");
      setNewName("");
      setCreating(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = (p: Project) => {
    askConfirmation(t.deleteProject, label(p), [
      { text: common.cancel, style: "cancel" },
      {
        text: t.deleteProject,
        style: "destructive",
        onPress: async () => {
          setDeletingId(p.id);
          try {
            const result = await luxAssistantProxy(panelId, token, "DELETE", `/api/ai/projects/${encodeURIComponent(p.id)}`);
            if (result == null) throw new Error(t.error);
            setProjects(prev => prev.filter(row => row.id !== p.id));
          } finally { setDeletingId(""); }
        },
      },
    ]);
  };

  // Fila de proyecto reutilizable (árbol y lista plana). `depth` aplica sangría +
  // una guía a la izquierda para que se vea el anidamiento bajo su proyecto padre.
  const renderRow = (p: Project, depth: number) => {
    const active = p.id === activeProjectId;
    return (
      <Pressable
        key={p.id}
        onPress={() => { onPick(p.id); onClose(); }}
        style={[
          styles.row,
          active ? { backgroundColor: tokens.brandDim } : null,
          depth > 0 ? { marginLeft: depth * 16, borderLeftWidth: 2, borderLeftColor: tokens.border } : null,
        ]}
      >
        {showTree && projects.some(row=>row.parentId===p.id) ? <Pressable onPress={()=>setExpanded(old=>{const next=new Set(old);if(next.has(p.id))next.delete(p.id);else next.add(p.id);return next;})} hitSlop={8}>{expanded.has(p.id)?<ChevronDown size={16} color={tokens.textMuted}/>:<ChevronRight size={16} color={tokens.textMuted}/>}</Pressable> : null}
        <View style={[styles.iconWrap, { backgroundColor: tokens.bgInput, borderColor: tokens.border }]}>
          <Folder size={depth > 0 ? 16 : 18} color={active ? tokens.brand : tokens.textMuted} />
        </View>
        <View style={styles.rowMeta}>
          <Text numberOfLines={1} style={[styles.rowTitle, { color: tokens.textPrimary }]}>{label(p)}</Text>
          <Text numberOfLines={1} style={[styles.rowDate, { color: tokens.textMuted }]}>
            {p.relation === "shared" && p.ownerName ? `${t.sharedWithYou} · ${p.ownerName}` : dateLabel(p)}
          </Text>
        </View>
        {/* Solo el dueño puede borrar (el backend además devuelve 403). */}
        {p.relation === "shared" ? null : (
          <Pressable
            onPress={(event) => { event.stopPropagation(); remove(p); }}
            disabled={deletingId === p.id}
            hitSlop={6}
            accessibilityLabel={t.deleteProject}
            style={styles.rowDelete}
          >
            <Trash2 size={16} color={tokens.textMuted} />
          </Pressable>
        )}
      </Pressable>
    );
  };

  if (pickerOnly) {
    const selectedRoot = rootProjectId(activeProjectId, projects);
    return <>
      {confirmation}
      <FormSheet visible={visible} onClose={onClose} title={t.projectsSection} language={language} scrollable={false} fillHeight>
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {error ? <Text accessibilityRole="alert" style={{ color: tokens.danger, padding: 12 }}>{error}</Text> : null}
          {busy && projects.length === 0 ? <ActivityIndicator color={tokens.brand} style={{ margin: 24 }} /> : null}
          <Pressable accessibilityLabel={t.looseChats ?? "Chats sueltos"} onPress={() => { onPick(""); onClose(); }}
            style={[styles.row, !selectedRoot && { backgroundColor: tokens.brandDim }]}>
            <View style={[styles.iconWrap, { backgroundColor: tokens.bgInput, borderColor: tokens.border }]}><Folder size={18} color={!selectedRoot ? tokens.brand : tokens.textMuted} /></View>
            <Text style={[styles.rowTitle, { color: tokens.textPrimary }]}>{t.looseChats ?? "Chats sueltos"}</Text>
          </Pressable>
          {rootProjects(projects).map((project) => (
            <Pressable key={project.id} accessibilityLabel={label(project)} onPress={() => { onPick(project.id); onClose(); }}
              style={[styles.row, selectedRoot === project.id && { backgroundColor: tokens.brandDim }]}>
              <View style={[styles.iconWrap, { backgroundColor: tokens.bgInput, borderColor: tokens.border }]}><Folder size={18} color={selectedRoot === project.id ? tokens.brand : tokens.textMuted} /></View>
              <Text numberOfLines={1} style={[styles.rowTitle, { color: tokens.textPrimary, flex: 1 }]}>{label(project)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </FormSheet>
    </>;
  }

  return <>
      {confirmation}
    <FormSheet visible={visible} onClose={onClose} title={t.projectsSection} language={language} scrollable={false} fillHeight>
      <View style={styles.root}>
        {error?<Text accessibilityRole="alert" style={{color:tokens.danger}}>{error}</Text>:null}
        {/* Buscador + crear */}
        <View style={styles.topRow}>
          <View style={[styles.search, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
            <Search size={15} color={tokens.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t.searchProjects}
              placeholderTextColor={tokens.textMuted}
              style={[styles.searchInput, { color: tokens.textPrimary }]}
              autoCapitalize="none"
            />
          </View>
          <Pressable
            onPress={() => setCreating((v) => !v)}
            accessibilityLabel={t.newProject}
            style={[styles.addBtn, { backgroundColor: creating ? tokens.brandDim : tokens.brand, borderColor: tokens.brand }]}
          >
            <Plus size={18} color={creating ? tokens.brand : "#fff"} />
          </Pressable>
        </View>

        {/* Filtros: Todo · Creados por ti · Compartidos contigo */}
        <View style={styles.chipsRow}>
          {([
            { key: "all" as const, label: t.allProjects },
            { key: "owner" as const, label: t.createdByYou },
            { key: "shared" as const, label: t.sharedWithYou },
          ]).map((c) => {
            const on = filter === c.key;
            return (
              <Pressable
                key={c.key}
                onPress={() => setFilter(c.key)}
                style={[styles.chip, { borderColor: on ? tokens.brand : tokens.border, backgroundColor: on ? tokens.brandDim : "transparent" }]}
              >
                <Text numberOfLines={1} style={[styles.chipText, { color: on ? tokens.brand : tokens.textMuted }]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {creating ? (
          <View style={[styles.createBox, { borderColor: tokens.border, backgroundColor: tokens.bgCardSolid }]}>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder={t.projectName}
              placeholderTextColor={tokens.textMuted}
              autoFocus
              onSubmitEditing={() => void createProject()}
              style={[styles.createInput, { color: tokens.textPrimary, borderColor: tokens.border, backgroundColor: tokens.bgInput }]}
            />
            <Pressable
              onPress={() => void createProject()}
              disabled={saving || !newName.trim()}
              style={[styles.createBtn, { backgroundColor: tokens.brand, opacity: saving || !newName.trim() ? 0.6 : 1 }]}
            >
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Check size={16} color="#fff" />}
            </Pressable>
          </View>
        ) : null}

        {/* Lista: árbol anidado por defecto, lista plana al buscar/filtrar. */}
        {busy && projects.length === 0 ? (
          <View style={styles.center}><ActivityIndicator color={tokens.brand} /></View>
        ) : (showTree ? tree.length === 0 : filtered.length === 0) ? (
          <View style={styles.center}><Text style={{ color: tokens.textMuted }}>{t.noProjects}</Text></View>
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            {showTree
              ? tree.map(({ project, depth }) => renderRow(project, depth))
              : filtered.slice(0,rootLimit).map((p) => renderRow(p, 0))}
            {(showTree?projects.filter(p=>!p.parentId||!projects.some(row=>row.id===p.parentId)).length:filtered.length)>rootLimit ? <Pressable onPress={()=>setRootLimit(old=>old+8)} style={{padding:12}}><Text style={{color:tokens.brand}}>{t.loadMore ?? "Mostrar más"}</Text></Pressable>:null}
          </ScrollView>
        )}
      </View>
    </FormSheet>
  </>;
}

const styles = StyleSheet.create({
  // El cuerpo del Modal (scrollable=false) NO trae padding: lo aporta `root` para
  // que el buscador, los chips y la lista no queden pegados a los bordes de la
  // tarjeta (alineados con el título de la cabecera).
  root: { flex: 1, gap: 12, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  search: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, height: 42, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: "600", padding: 0 },
  addBtn: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  chipsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 12.5, fontWeight: "700" },
  createBox: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, padding: 8 },
  createInput: { flex: 1, height: 40, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, fontSize: 14, fontWeight: "600" },
  createBtn: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  list: { flex: 1 },
  listContent: { paddingBottom: 12, gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 8, paddingVertical: 10, borderRadius: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  rowMeta: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14.5, fontWeight: "700" },
  rowDate: { fontSize: 11.5, marginTop: 2 },
  rowDelete: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
});
