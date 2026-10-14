// Estado del drawer central "Más herramientas" (selector de módulos) + permisos
// por panel + botones flotantes por servidor (extraído verbatim de MainTab.tsx;
// mismo orden de hooks: se invoca en el mismo punto del componente).
import React, { useCallback, useEffect, useState } from "react";
import { Animated, Dimensions, Easing } from "react-native";
import { State, type PanGestureHandlerStateChangeEvent } from "react-native-gesture-handler";
import { getServerModulePermissions, type ServerModulePermissions } from "../../api/client";
import type { PanelRow } from "../../features/app/viewModels";
import type { getMessages } from "../../i18n";
import { loadFloatingButtons, saveFloatingButtons, DEFAULT_FLOATING_BUTTONS, type FloatingButtonsConfig } from "../../lib/module-floating-buttons-store";
import { moduleById } from "../../features/app/luxipanel-modules";

export function useModulePickerState({ t, token, moduleSessions, openModuleSession }: {
  t: ReturnType<typeof getMessages>;
  token: string;
  /** Sesiones de módulo vivas del tab (para cargar su config de botones flotantes). */
  moduleSessions: { panelId: string }[];
  openModuleSession: (panel: PanelRow, moduleId: string, route: string, moduleName?: string) => Promise<void>;
}) {
  // ── Drawer central "Más herramientas" (selector de módulos) ────────────────
  // Bottom-sheet INDEPENDIENTE con el MISMO patrón que el ActionsSheet (slide
  // vertical + backdrop + arrastre-para-cerrar). NO es un Modal centrado.
  const [modulePickerOpen, setModulePickerOpen] = useState(false);
  const [modulePickerVisible, setModulePickerVisible] = useState(false);
  const [modulePickerPanel, setModulePickerPanel] = useState<PanelRow | null>(null);
  const [modulePickerError, setModulePickerError] = useState<string | null>(null);
  const [modulePickerLoading, setModulePickerLoading] = useState(false);
  const [modulePickerRetry, setModulePickerRetry] = useState(0);
  const retryModulePicker = useCallback(() => setModulePickerRetry(n => n + 1), []);
  const [modulePickerAvailable, setModulePickerAvailable] = useState<{ id: string; name?: string }[]>([]);
  // Permisos de las herramientas (Asistente IA / Terminal) del panel del picker:
  // gatean sus accesos en "Más opciones" (misma condición que la portada).
  const [modulePickerTools, setModulePickerTools] = useState<{ assistant: boolean; terminal: boolean }>({ assistant: false, terminal: false });
  // Permisos de módulos por panel (assistant/terminal/available): los necesita el
  // chrome del webview de módulo (gating chat/terminal) y reabrir "Más opciones".
  const [permsByPanel, setPermsByPanel] = useState<Record<string, ServerModulePermissions>>({});

  // Configuración de BOTONES FLOTANTES (laterales del webview de módulo) POR SERVIDOR.
  // Persistida a disco; se carga perezosamente al abrir el picker o un módulo.
  const [floatingByPanel, setFloatingByPanel] = useState<Record<string, FloatingButtonsConfig>>({});
  const ensureFloatingConfig = useCallback(async (panelId: string) => {
    const cfg = await loadFloatingButtons(panelId);
    setFloatingByPanel((cur) => (cur[panelId] ? cur : { ...cur, [panelId]: cfg }));
  }, []);
  // Alterna un módulo/herramienta en un lado de la config del servidor + persiste.
  const toggleFloating = useCallback((panelId: string, side: "left" | "right", id: string) => {
    setFloatingByPanel((cur) => {
      const base = cur[panelId] ?? DEFAULT_FLOATING_BUTTONS;
      const list = base[side] ?? [];
      const nextList = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      const next = { ...base, [side]: nextList };
      void saveFloatingButtons(panelId, next);
      return { ...cur, [panelId]: next };
    });
  }, []);
  // Abre (o navega a) un MÓDULO desde un botón flotante. Las HERRAMIENTAS
  // (assistant/terminal) NO pasan por aquí: las resuelve `SshScreen` inyectando en
  // el webview (drawer flotante de LUXIPANEL).
  const openModuleShortcut = useCallback((panel: PanelRow, id: string) => {
    const mod = moduleById(id);
    if (!mod) return;
    const name = permsByPanel[panel.id]?.available?.find((a) => a.id === id)?.name
      || (t.modules.labels as Record<string, string>)[mod.labelKey]
      || mod.id;
    void openModuleSession(panel, id, mod.route, name);
  }, [openModuleSession, permsByPanel, t]);
  // Carga la config de botones flotantes de cada servidor con sesión de módulo
  // abierta (su webview los necesita).
  useEffect(() => {
    for (const m of moduleSessions) void ensureFloatingConfig(m.panelId);
  }, [moduleSessions, ensureFloatingConfig]);
  // Distancia de slide off-screen (alto de pantalla); estático para no depender del
  // orden de declaración de `actionsSheetHeight` (que se define más abajo).
  const pickerSlide = Dimensions.get("window").height;
  const modulePickerTranslateY = React.useRef(new Animated.Value(pickerSlide)).current;
  const modulePickerBackdrop = React.useRef(new Animated.Value(0)).current;
  const modulePickerDragY = React.useRef(new Animated.Value(0)).current;
  const modulePickerCloseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // El sheet abre a pantalla completa con lista desplazable: el arrastrar-para-cerrar
  // SOLO se habilita cuando la lista está arriba del todo; si no, el gesto vertical
  // se lo queda el ScrollView (antes el swipe cerraba el sheet al intentar scrollear).
  const [modulePickerAtTop, setModulePickerAtTop] = useState(true);

  const openModulePicker = useCallback((panel: PanelRow, perms: ServerModulePermissions) => {
    if (modulePickerCloseTimer.current) { clearTimeout(modulePickerCloseTimer.current); modulePickerCloseTimer.current = null; }
    modulePickerDragY.setValue(0);
    setModulePickerAtTop(true);
    setPermsByPanel((cur) => ({ ...cur, [panel.id]: perms }));
    setModulePickerPanel(panel);
    setModulePickerError(perms.error ?? null);
    setModulePickerAvailable(perms.available);
    setModulePickerTools({ assistant: perms.assistant, terminal: perms.terminal });
    void ensureFloatingConfig(panel.id);
    setModulePickerVisible(true);
    setModulePickerOpen(true);
  }, [modulePickerDragY, ensureFloatingConfig]);

  useEffect(() => {
    let current = true;
    if (!modulePickerOpen || !modulePickerPanel) return;
    const panelId = modulePickerPanel.id;
    setModulePickerLoading(true);
    void getServerModulePermissions(panelId, token, { force: true }).then(perms => {
      if (!current) return;
      setPermsByPanel(cur => ({ ...cur, [panelId]: perms }));
      setModulePickerError(perms.error ?? null);
      setModulePickerAvailable(perms.available);
      setModulePickerTools({ assistant: perms.assistant, terminal: perms.terminal });
    }).finally(() => { if (current) setModulePickerLoading(false); });
    return () => { current = false; };
  }, [modulePickerOpen, modulePickerPanel?.id, modulePickerRetry, token]);

  const closeModulePicker = useCallback(() => {
    setModulePickerOpen(false);
    if (modulePickerCloseTimer.current) clearTimeout(modulePickerCloseTimer.current);
    modulePickerCloseTimer.current = setTimeout(() => { setModulePickerVisible(false); modulePickerCloseTimer.current = null; }, 240);
  }, []);

  const onModulePickerGesture = React.useMemo(
    () => Animated.event([{ nativeEvent: { translationY: modulePickerDragY } }], { useNativeDriver: true }),
    [modulePickerDragY],
  );
  const handleModulePickerSwipe = useCallback((event: PanGestureHandlerStateChangeEvent) => {
    const { oldState, translationY, velocityY } = event.nativeEvent;
    if (oldState !== State.ACTIVE) return;
    if (translationY > 100 || velocityY > 600) { closeModulePicker(); return; }
    Animated.spring(modulePickerDragY, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 14 }).start();
  }, [closeModulePicker, modulePickerDragY]);

  useEffect(() => {
    if (modulePickerOpen) {
      setModulePickerVisible(true);
      modulePickerTranslateY.setValue(pickerSlide);
      modulePickerBackdrop.setValue(0);
      Animated.parallel([
        Animated.timing(modulePickerTranslateY, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(modulePickerBackdrop, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
      return;
    }
    if (!modulePickerVisible) return;
    Animated.parallel([
      Animated.timing(modulePickerTranslateY, { toValue: pickerSlide, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(modulePickerBackdrop, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [modulePickerOpen, modulePickerVisible, modulePickerBackdrop, modulePickerTranslateY, pickerSlide]);

  return {
    modulePickerError, modulePickerLoading, retryModulePicker,
    modulePickerOpen, modulePickerVisible, modulePickerPanel, modulePickerAvailable,
    modulePickerTools, modulePickerAtTop, setModulePickerAtTop,
    permsByPanel, setPermsByPanel,
    floatingByPanel, ensureFloatingConfig, toggleFloating, openModuleShortcut,
    modulePickerTranslateY, modulePickerBackdrop, modulePickerDragY,
    openModulePicker, closeModulePicker, onModulePickerGesture, handleModulePickerSwipe,
  };
}
