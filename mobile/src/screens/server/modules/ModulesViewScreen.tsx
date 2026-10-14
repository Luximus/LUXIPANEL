import { nativeText } from '../../../i18n/native-text';
import { ModuleGrid } from "../../../components/server/ModuleLayouts";
import { Select } from "../../../components/ui/Select";
/** ModulesViewScreen — réplica nativa de la vista Módulos (mostrar/ocultar y
 *  REORDENAR en el menú). Lista de módulos con Switch + buscador + botones
 *  subir/bajar por fila; el nuevo orden se persiste con un botón "Guardar orden"
 *  (PUT /api/admin/modules/order) vía el gateway. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanelText as Text } from "../../../components/ui/PanelText";
import { Pressable, Switch, TextInput, View } from "react-native";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens, withAlpha } from "../../../theme/colors";
import { getMessages } from "../../../i18n";
import { loadSessionState } from "../../../lib/session-state";
import { ServerModuleScreen } from "../../../components/server/ServerModuleScreen";
import { Button } from "../../../components/ui/Button";
import { Toast, type ToastVariant } from "../../../components/ui/Toast";
import { TablerSearch, TablerPuzzle, TablerChevronUp, TablerChevronDown, TablerDeviceFloppy } from "../../../features/app/tabler-icons";
import { serverModulesViewApi, unwrap } from "../../../api/serverApi";
import { runServerMutation } from "../../../hooks/useServerApi";
import type { GatewayGuardCode } from "../../../api/serverApi";

const GUARDS = ["NO_CREDENTIALS", "FINGERPRINT_PENDING", "PANEL_UNAVAILABLE", "DIRECT_AUTH_REQUIRED"];

type ModuleRow = { id: string; name: string; description?: string; enabled?: boolean; category?: string };

/** Reordena `list` para que respete el orden de ids `desired` (ids ausentes al
 *  final, estable). Permite conservar un reordenamiento local sin guardar a
 *  través de una recarga (p. ej. tras un toggle o pull-to-refresh). */
function sortByDesired(list: ModuleRow[], desired: string[]): ModuleRow[] {
  const pos = new Map(desired.map((id, i) => [id, i] as const));
  const at = (id: string) => (pos.has(id) ? (pos.get(id) as number) : Number.MAX_SAFE_INTEGER);
  return [...list].sort((a, b) => at(a.id) - at(b.id));
}

export function ModulesViewScreen({ panelId, token, onBack }: { panelId: string; token: string; onBack: () => void }) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverModulesView;

  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [category,setCategory]=useState("all");
  const [visibility,setVisibility]=useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [guardCode, setGuardCode] = useState<GatewayGuardCode | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [orderDirty, setOrderDirty] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  // Orden deseado sin guardar (ids). Si está, las recargas lo conservan para no
  // perder el reordenamiento local al hacer toggle / refrescar.
  const pendingOrderRef = useRef<string[] | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; variant: ToastVariant; message: string; nonce: number }>({ visible: false, variant: "success", message: "", nonce: 0 });
  const showToast = useCallback((message: string, err = false) => setToast((p) => ({ visible: true, variant: err ? "error" : "success", message, nonce: p.nonce + 1 })), []);

  const load = useCallback(async () => {
    const res = await serverModulesViewApi.list(panelId, token);
    if (res.code && GUARDS.includes(res.code)) {
      setGuardCode(res.code as GatewayGuardCode);
      return;
    }
    setGuardCode(null);
    const list = (unwrap<ModuleRow[]>(res) ?? []).filter(Boolean);
    const desired = pendingOrderRef.current;
    setRows(desired ? sortByDesired(list, desired) : list);
  }, [panelId, token]);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const toggle = useCallback(
    async (m: ModuleRow, next: boolean) => {
      setBusyId(m.id);
      const out = await runServerMutation(panelId, token, () => serverModulesViewApi.toggle(panelId, token, m.id, next));
      setBusyId(null);
      if (out.ok) {
        showToast(t.toasts.saved);
        void load(); // recarga: el toggle puede afectar dependencias (affected[]); conserva el orden pendiente
      } else showToast(out.error ?? t.toasts.error, true);
    },
    [panelId, token, showToast, load, t.toasts],
  );

  // Mueve un módulo una posición (sobre la lista COMPLETA `rows`, por id) y marca
  // el orden como sucio. No hay red aquí: solo estado local + ref del orden.
  const move = useCallback((id: string, dir: "up" | "down") => {
    setRows((prev) => {
      const idx = prev.findIndex((m) => m.id === id);
      if (idx < 0) return prev;
      const j = dir === "up" ? idx - 1 : idx + 1;
      if (j < 0 || j >= prev.length) return prev;
      const nextRows = prev.slice();
      const tmp = nextRows[idx];
      nextRows[idx] = nextRows[j];
      nextRows[j] = tmp;
      pendingOrderRef.current = nextRows.map((m) => m.id);
      return nextRows;
    });
    setOrderDirty(true);
  }, []);

  const saveOrder = useCallback(async () => {
    setSavingOrder(true);
    const order = rows.map((m) => m.id);
    const out = await runServerMutation(panelId, token, () => serverModulesViewApi.reorder(panelId, token, order));
    setSavingOrder(false);
    pendingOrderRef.current = null;
    setOrderDirty(false);
    if (out.ok) showToast(t.toasts.orderSaved);
    else showToast(out.error ?? t.toasts.orderError, true); // en error, la recarga restaura el orden del servidor
    void load();
  }, [rows, panelId, token, showToast, load, t.toasts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)) : rows;
  }, [rows, query]);
  const searching = query.trim().length > 0;

  return (
    <>
      <ServerModuleScreen title={t.pageTitle} subtitle={t.subtitle} onBack={onBack} guardCode={guardCode} onRetry={onRefresh} refreshing={refreshing} onRefresh={onRefresh}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 40, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, backgroundColor: tokens.bgInput, borderColor: tokens.border }}>
          <TablerSearch size={16} color={tokens.textMuted} />
          <TextInput value={query} onChangeText={setQuery} placeholder={t.search} placeholderTextColor={tokens.textMuted} style={{ flex: 1, color: tokens.textPrimary, fontSize: 13, paddingVertical: 0 }} />
        </View>

        <View style={{flexDirection:"row",gap:10}}><View style={{flex:1}}><Select value={category} onChange={setCategory} options={[{value:"all",get label() { return nativeText("Todas las categorías"); }},...[...new Set(rows.map(row=>row.category).filter((value):value is string=>!!value))].map(value=>({value,label:value}))]}/></View><View style={{flex:1}}><Select value={visibility} onChange={setVisibility} options={[{value:"all",get label() { return nativeText("Todos los estados"); }},{value:"visible",get label() { return nativeText("Visibles"); }},{value:"hidden",get label() { return nativeText("Ocultos"); }}]}/></View></View>
        {orderDirty ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: withAlpha(tokens.brand, 0.3), backgroundColor: withAlpha(tokens.brand, 0.08) }}>
            <Text style={{ flex: 1, color: tokens.textSecondary, fontSize: 12 }}>{t.orderUnsaved}</Text>
            <Button label={t.orderSave} icon={<TablerDeviceFloppy size={16} />} size="sm" onPress={saveOrder} loading={savingOrder} />
          </View>
        ) : null}

        {searching ? (
          <Text style={{ color: tokens.textMuted, fontSize: 11 }}>{t.reorderSearchHint}</Text>
        ) : null}

        {loading ? null : filtered.length === 0 ? (
          <Text style={{ color: tokens.textMuted, fontSize: 13, textAlign: "center", paddingVertical: 24 }}>{t.empty}</Text>
        ) : (
          <ModuleGrid columns={3} breakpoint={768}>
            {filtered.filter(m=>(category === "all" || m.category===category)&&(visibility==="all" || (m.enabled!==false)===(visibility==="visible"))).map((m, i) => {
              const on = m.enabled !== false;
              const isFirst = i === 0;
              const isLast = i === filtered.length - 1;
              return (
                <View key={m.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 18, minHeight:130, borderWidth:1, borderRadius:16, borderColor:tokens.border,backgroundColor:tokens.bgCardSolid }}>
                  <TablerPuzzle size={18} color={on ? tokens.brand : tokens.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: tokens.textPrimary, fontSize: 14, fontWeight: "600" }} numberOfLines={1}>{m.name}</Text>
                    <Text style={{ color: tokens.textMuted, fontSize: 11 }} numberOfLines={1}>{m.description ?? (on ? t.statusVisible : t.statusHidden)}</Text>
                  </View>
                  {/* Botones de reorden: solo sin búsqueda (operan sobre la lista completa) */}
                  {!searching && category==="all" && visibility==="all" ? (
                    <View style={{ gap: 3 }}>
                      <Pressable
                        onPress={() => move(m.id, "up")}
                        disabled={isFirst || savingOrder}
                        hitSlop={4}
                        accessibilityRole="button"
                        accessibilityLabel={t.moveUp}
                        style={{ width: 30, height: 22, borderRadius: 6, borderWidth: 1, alignItems: "center", justifyContent: "center", borderColor: tokens.border, backgroundColor: tokens.bgInput, opacity: isFirst ? 0.35 : 1 }}
                      >
                        <TablerChevronUp size={15} color={tokens.textSecondary} />
                      </Pressable>
                      <Pressable
                        onPress={() => move(m.id, "down")}
                        disabled={isLast || savingOrder}
                        hitSlop={4}
                        accessibilityRole="button"
                        accessibilityLabel={t.moveDown}
                        style={{ width: 30, height: 22, borderRadius: 6, borderWidth: 1, alignItems: "center", justifyContent: "center", borderColor: tokens.border, backgroundColor: tokens.bgInput, opacity: isLast ? 0.35 : 1 }}
                      >
                        <TablerChevronDown size={15} color={tokens.textSecondary} />
                      </Pressable>
                    </View>
                  ) : null}
                  <Switch
                    value={on}
                    disabled={busyId === m.id}
                    onValueChange={(v) => toggle(m, v)}
                    trackColor={{ true: withAlpha(tokens.brand, 0.5), false: withAlpha(tokens.textMuted, 0.3) }}
                    thumbColor={on ? tokens.brand : undefined}
                  />
                </View>
              );
            })}
          </ModuleGrid>
        )}
      </ServerModuleScreen>
      <Toast visible={toast.visible} variant={toast.variant} message={toast.message} nonce={toast.nonce} onHide={() => setToast((p) => ({ ...p, visible: false }))} />
    </>
  );
}
