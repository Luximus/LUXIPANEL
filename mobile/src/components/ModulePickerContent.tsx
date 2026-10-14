import {serverUserModuleLabel} from "../i18n/server-user-messages";
import React, { useRef, useState } from "react";
import { type NativeScrollEvent, type NativeSyntheticEvent, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Check, PanelLeft, PanelRight, Settings2, X } from "lucide-react-native";
import { getMessages } from "../i18n";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { CORE_MODULES, LUX_MODULES, TOOL_MODULES, type ModuleIcon } from "../features/app/luxipanel-modules";

type Tool = "assistant" | "terminal";
type Side = "left" | "right";
type ModuleRow = { id: string; route: string; Icon: ModuleIcon; label: string; tool?: Tool };
export type FloatingButtonsConfig = { left: string[]; right: string[] };

/**
 * Contenido del DRAWER CENTRAL "Más opciones" (el shell animado —slide +
 * backdrop + arrastre— lo aporta MainScreen, igual que el ActionsSheet; aquí NO
 * hay Modal). Lista de herramientas + módulos de LUXIPANEL respetando el MISMO
 * orden y la MISMA condición que el menú lateral del panel:
 *  - Herramientas (Asistente IA · Terminal) encabezan el selector y se muestran
 *    SIEMPRE. NO se gatean por permiso: los flags `assistant`/`terminal` pueden
 *    venir vacíos/false desde LUXIPANEL para el usuario SSH puenteado por LP (igual
 *    que `available`), así que —como los botones de la portada del carousel— el
 *    acceso real lo valida LUXIPANEL al cargar la webview. En el panel son drawers
 *    flotantes.
 *  - Módulos premium en el orden de `LUX_MODULES` (= `MODULE_META` del sidebar),
 *    filtrados por los `available` (enabled∩permitido que devuelve el backend, la
 *    misma condición que el sidebar). Los que no están en el registro se omiten,
 *    igual que el sidebar omite los que no están en su `MODULE_META`.
 *  - Módulos CORE (Notificaciones · Módulos · Ajustes) siempre al final.
 */
export function ModulePickerContent({
  available, tools, error, loading, onRetry,
  language,
  onPick,
  onPickTool,
  onClose,
  floatingConfig,
  onToggleFloating,
  onScrollEdgeChange,
}: {
  available: { id: string; name?: string }[];
  tools?: { assistant: boolean; terminal: boolean };
  error?: string | null;
  loading?: boolean;
  onRetry?: () => void;
  language?: string;
  onPick: (moduleId: string, route: string, name: string) => void;
  onPickTool: (tool: Tool) => void;
  onClose: () => void;
  /** Selección actual de botones flotantes (por lado) del servidor. */
  floatingConfig?: FloatingButtonsConfig;
  /** Alterna un módulo/herramienta en el lado dado (lo persiste MainScreen). */
  onToggleFloating?: (side: Side, id: string) => void;
  /** Informa si el scroll está ARRIBA del todo. MainScreen solo habilita el gesto
   *  de arrastrar-para-cerrar cuando está arriba; si no, deja desplazar la lista. */
  onScrollEdgeChange?: (atTop: boolean) => void;
}) {
  const t = getMessages(language);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  // Modo "configurar accesos rápidos": el engranaje lo activa para elegir qué
  // módulos/herramientas aparecen como botones flotantes en los bordes del webview
  // de módulo. `configSide` = lado que se está editando (su selección se resalta).
  const [configuring, setConfiguring] = useState(false);
  const [configSide, setConfigSide] = useState<Side>("right");
  const canConfigure = !!onToggleFloating;
  const selectedForSide = new Set(floatingConfig?.[configSide] ?? []);
  // Textos del modo configuración (es/en; otros locales caen a es). Las etiquetas de
  // lado son solo icono, así que no necesitan traducción.
  const isEn = (language ?? "es").toLowerCase().startsWith("en");
  const cfgHint = isEn
    ? "Pick the modules/tools to pin as floating buttons on the selected side."
    : "Elige los módulos/herramientas a fijar como botones flotantes del lado seleccionado.";

  // Informa "scroll arriba del todo" solo al CAMBIAR (no en cada frame): MainScreen
  // usa esto para habilitar el arrastrar-para-cerrar solo arriba y no robarle el
  // scroll a la lista.
  const atTopRef = useRef(true);
  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const atTop = e.nativeEvent.contentOffset.y <= 1;
    if (atTop !== atTopRef.current) {
      atTopRef.current = atTop;
      onScrollEdgeChange?.(atTop);
    }
  };

  const labels = t.modules.labels as Record<string, string>;
  const rows: ModuleRow[] = [];
  const seen = new Set<string>();
  // 0) Herramientas (Asistente IA · Terminal): SIEMPRE primero, sin gatear por
  //    permiso (ver nota arriba: el acceso real lo valida la webview al cargar).
  for (const mod of TOOL_MODULES) {
    if (tools && !tools[mod.id as Tool]) continue;
    seen.add(mod.id);
    rows.push({ id: mod.id, route: mod.route, Icon: mod.icon, label: serverUserModuleLabel(mod.id,language) ?? labels[mod.labelKey] ?? mod.id, tool: mod.id as Tool });
  }
  // 1) El backend devuelve `available` en el orden configurado para el sidebar.
  //    Conservarlo evita que el móvil muestre una lista distinta de la web.
  const availById = new Map(available.map((m) => [m.id, m] as const));
  const knownById = new Map([...LUX_MODULES, ...CORE_MODULES].map((m) => [m.id, m] as const));
  for (const m of available) {
    const mod = knownById.get(m.id);
    if (!mod || seen.has(mod.id)) continue;
    seen.add(mod.id);
    rows.push({ id: mod.id, route: mod.route, Icon: mod.icon, label: serverUserModuleLabel(mod.id, language) ?? labels[mod.labelKey] ?? m.name ?? mod.id });
    if (mod.id === "module-dev") {
      const map = knownById.get("project-map");
      if (map && !seen.has(map.id)) {
        seen.add(map.id);
        rows.push({ id: map.id, route: map.route, Icon: map.icon, label: labels[map.labelKey] ?? map.id });
      }
    }
  }
  // Only modules with an implemented native screen are shown. The current
  // panel does not expose /panel/community/:id pages for third-party modules.
  // 2) Módulos CORE (Notificaciones, Módulos, Ajustes): siempre presentes (no vienen
  //    en `available`). Nombre desde i18n. Se omiten si ya salieron arriba.
  for (const mod of CORE_MODULES) {
    if (mod.id === "module-dev" && !availById.has(mod.id)) continue;
    if (seen.has(mod.id)) continue;
    seen.add(mod.id);
    rows.push({ id: mod.id, route: mod.route, Icon: mod.icon, label: serverUserModuleLabel(mod.id,language) ?? labels[mod.labelKey] ?? mod.id });
  }

  return (
    <View style={[styles.root, { backgroundColor: tokens.bgCardSolid }]}>
      <View style={[styles.header, { borderBottomColor: tokens.border }]}>
        <Text style={[styles.title, { color: tokens.textPrimary }]}>{t.modules.modalTitle}</Text>
        <View style={styles.headerActions}>
          {/* Engranaje: activa el modo "elegir accesos rápidos de los bordes". */}
          {canConfigure ? (
            <Pressable
              onPress={() => setConfiguring((v) => !v)}
              accessibilityLabel="Configurar accesos rápidos"
              hitSlop={8}
              style={[styles.headerBtn, configuring ? { backgroundColor: tokens.brandDim } : null]}
            >
              <Settings2 size={20} color={configuring ? tokens.brand : tokens.textMuted} />
            </Pressable>
          ) : null}
          <Pressable onPress={onClose} accessibilityLabel={t.common.close} hitSlop={8} style={styles.headerBtn}>
            <X size={20} color={tokens.textMuted} />
          </Pressable>
        </View>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {loading ? <ActivityIndicator color={tokens.brand} /> : null}
        {error ? <View style={{ gap: 12, paddingVertical: 16 }}><Text accessibilityRole="alert" style={{ color: tokens.danger }}>{error}</Text><Pressable accessibilityRole="button" onPress={onRetry}><Text style={{ color: tokens.brand }}>{isEn ? "Retry" : "Reintentar"}</Text></Pressable></View> : null}
        {configuring ? (
          <>
            <Text style={[styles.subtitle, { color: tokens.textSecondary, marginBottom: 8 }]}>{cfgHint}</Text>
            {/* Selector de lado (solo icono): elige el lateral a editar; su selección
                se resalta en la rejilla. */}
            <View style={[styles.sideToggle, { borderColor: tokens.border }]}>
              {(["left", "right"] as Side[]).map((side) => {
                const active = configSide === side;
                const SideIcon = side === "left" ? PanelLeft : PanelRight;
                const count = (floatingConfig?.[side] ?? []).length;
                return (
                  <Pressable
                    key={side}
                    onPress={() => setConfigSide(side)}
                    accessibilityLabel={side === "left" ? "Lateral izquierdo" : "Lateral derecho"}
                    style={[styles.sideBtn, { backgroundColor: active ? tokens.brand : "transparent" }]}
                  >
                    <SideIcon size={18} color={active ? tokens.accentText : tokens.textSecondary} />
                    {count > 0 ? (
                      <Text style={[styles.sideCount, { color: active ? tokens.accentText : tokens.textMuted }]}>{count}</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <Text style={[styles.subtitle, { color: tokens.textSecondary }]}>{t.modules.modalSubtitle}</Text>
        )}
        {rows.length === 0 ? (
          <Text style={[styles.empty, { color: tokens.textMuted }]}>{t.modules.empty}</Text>
        ) : (
          <View style={styles.grid}>
            {rows.map((r) => {
              const selected = configuring && selectedForSide.has(r.id);
              return (
                <Pressable
                  key={r.id}
                  onPress={() =>
                    configuring
                      ? onToggleFloating?.(configSide, r.id)
                      : r.tool ? onPickTool(r.tool) : onPick(r.id, r.route, r.label)
                  }
                  accessibilityLabel={r.label}
                  style={({ pressed }) => [
                    styles.tile,
                    {
                      borderColor: selected ? tokens.brand : tokens.border,
                      borderWidth: selected ? 2 : 1,
                      backgroundColor: selected ? tokens.brandDim : tokens.bgPrimary,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  {selected ? (
                    <View style={[styles.tileCheck, { backgroundColor: tokens.brand }]}>
                      <Check size={11} color="#ffffff" />
                    </View>
                  ) : null}
                  <r.Icon size={24} color={tokens.brand} />
                  <Text numberOfLines={2} style={[styles.tileLabel, { color: tokens.textPrimary }]}>
                    {r.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Llena TODO el sheet (que abre completo, 100%), igual que el cuerpo del
  // ActionsSheet. Sin radio: el sheet va a ras de pantalla. Sin asa: la cabecera
  // sube y aprovecha ese espacio para mostrar más contenido.
  root: { flex: 1, width: "100%", overflow: "hidden" },
  scroll: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 17, fontWeight: "800" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerBtn: { padding: 6, borderRadius: 8 },
  body: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 14 },
  empty: { fontSize: 14, lineHeight: 20, paddingVertical: 24, textAlign: "center" },
  // Selector de lado (izq/der) del modo configuración: dos pastillas con icono.
  sideToggle: { flexDirection: "row", alignSelf: "flex-start", borderWidth: 1, borderRadius: 10, overflow: "hidden", marginBottom: 14 },
  sideBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 18, paddingVertical: 8 },
  sideCount: { fontSize: 12, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    width: "30%",
    minWidth: 96,
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 8,
    overflow: "hidden",
  },
  tileCheck: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: { fontSize: 12, fontWeight: "700", textAlign: "center" },
});

export default ModulePickerContent;
