import { localizeServerError } from '../../../lib/server-error-localization';
import { nativeText } from '../../../i18n/native-text';
import { ModuleLoading } from "../../../components/server/ModuleLoading";
import {serverUserModuleLabel} from "../../../i18n/server-user-messages";
/**
 * StandaloneManagerScreen — overlay AUTOCONTENIDO para gestionar servidores
 * LUXIPANEL **standalone** por conexión DIRECTA (sin LP-LS).
 *
 * Máquina de vistas interna: lista de servidores → alta/re-conexión → selector
 * de módulos → pantalla nativa del módulo. Reusa EXACTAMENTE las 10 pantallas
 * nativas (las mismas que el camino managed); el despacho directo lo activa
 * `registerDirectServer(server.id, target)` antes de montar la pantalla, así las
 * pantallas no saben (ni les importa) si el transporte es gateway o directo.
 */
import React, { useCallback, useEffect, useState } from "react";
import { PanelText as Text } from "../../../components/ui/PanelText";
import { ActivityIndicator, BackHandler, Pressable, View } from "react-native";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens, withAlpha } from "../../../theme/colors";
import { formatMessage, getMessages } from "../../../i18n";
import { loadSessionState } from "../../../lib/session-state";
import { ServerModuleScreen } from "../../../components/server/ServerModuleScreen";
import { ConfirmDialog } from "../../../components/server/Form";
import { TablerPlus, TablerServer, TablerTrash, TablerChevronRight } from "../../../features/app/tabler-icons";
import { LUX_MODULES, CORE_MODULES, TOOL_MODULES, type LuxModule } from "../../../features/app/luxipanel-modules";
import {
  registerDirectServer,
  unregisterDirectServer,
  type DirectTarget,
} from "../../../api/serverApi";
import { reloginStandalone } from "../../../api/directAuth";
import { registerForPanelPushNotifications, unregisterForPanelPushNotifications } from "../../../lib/notifications";
import { getAppUnlockEntitlement } from "../../../api/billing";
import {
  listStandaloneServers,
  removeStandaloneServer,
  getStandaloneSession,
  getStandalonePassword,
  setStandaloneSession,
  type StandaloneServer,
} from "../../../storage/standaloneServers";
import { AddStandaloneServerScreen } from "./AddStandaloneServerScreen";
import { PersistentNativeModules } from "../../main/PersistentNativeModules";
import { dismissNativeModuleDialog } from "../../main/native-module-context";
import { NATIVE_MODULE_IDS } from "../../main/shell-types";
import { fetchNativeModuleAccess } from "../native-module-access";

const MODULE_CATALOG: LuxModule[] = [...TOOL_MODULES, ...LUX_MODULES, ...CORE_MODULES];
const NATIVE_MODULES = MODULE_CATALOG.filter((module) => NATIVE_MODULE_IDS.has(module.id));

type ManagerView =
  | { kind: "list" }
  | { kind: "add" }
  | { kind: "picker"; server: StandaloneServer }
  | { kind: "module"; server: StandaloneServer; moduleId: string };

export function StandaloneManagerScreen({
  onClose,
  visible = true,
  token,
  onRequireSubscription,
}: {
  onClose: () => void;
  visible?: boolean;
  /** Token de sesión de portal (null en modo invitado): necesario para consultar
   *  el entitlement de la suscripción anual "app-unlock". */
  token?: string | null;
  /** Abre la Tienda/suscripción cuando el usuario acepta el aviso de gate. */
  onRequireSubscription?: () => void;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverStandalone;
  const moduleLabels = getMessages(language).modules.labels as Record<string, string>;

  const [servers, setServers] = useState<StandaloneServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ManagerView>({ kind: "list" });
  const [allowedModules, setAllowedModules] = useState<Set<string> | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const refreshModuleAccess = useCallback(async (serverId: string) => {
    setCatalogError(null);
    try {
      const access = await fetchNativeModuleAccess(serverId);
      setAllowedModules(access);
      if (!access.has("assistant")) setView((current) => current.kind === "module" && current.moduleId === "assistant" ? { kind: "picker", server: current.server } : current);
    }
    catch (cause) { setAllowedModules(null); setCatalogError(cause instanceof Error ? cause.message : nativeText("Error de catálogo")); }
  }, []);
  const [reconnect, setReconnect] = useState<StandaloneServer | undefined>(undefined);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<StandaloneServer | null>(null);
  // Entitlement de la suscripción anual "app-unlock": null = aún sin verificar.
  // Se conserva `true` una vez confirmado para no re-consultar en cada acción.
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [gateOpen, setGateOpen] = useState(false);

  /** Verifica (o re-verifica) el entitlement. Devuelve true si la app está
   *  desbloqueada. Sin token de portal → bloqueado (no se puede validar). */
  const ensureUnlocked = useCallback(async (): Promise<boolean> => {
    if (unlocked === true) return true;
    if (!token) { setUnlocked(false); return false; }
    try {
      const ent = await getAppUnlockEntitlement(token);
      const ok = ent.appUnlocked && (!ent.appUnlockedUntil || new Date(ent.appUnlockedUntil).getTime() > Date.now());
      setUnlocked(ok);
      return ok;
    } catch {
      // Fallo de red al verificar: fail-closed (es un paywall). No persistimos el
      // `false` en estado —dejamos `unlocked` como null— para reintentar la
      // verificación en la próxima acción del usuario en vez de bloquear en firme.
      return false;
    }
  }, [token, unlocked]);

  // Re-valida el entitlement al abrir el gestor (montaje).
  useEffect(() => { void ensureUnlocked(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    const list = await listStandaloneServers();
    setServers(list);
    setLoading(false);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  // Limpieza: quita del registro directo los targets de esta sesión al desmontar.
  useEffect(() => {
    return () => { servers.forEach((s) => unregisterDirectServer(s.id)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Construye un DirectTarget (con relogin silencioso) y lo registra. Devuelve
  // null si no hay sesión válida ni forma de re-loguear sin intervención.
  const ensureTarget = useCallback(async (server: StandaloneServer): Promise<DirectTarget | null> => {
    const relogin = async (): Promise<DirectTarget | null> => {
      const pw = server.savePassword ? await getStandalonePassword(server.id) : null;
      if (!pw) return null;
      const s = await reloginStandalone(server.baseUrl, server.username, pw);
      if (!s) return null;
      await setStandaloneSession(server.id, s);
      const fresh: DirectTarget = { baseUrl: server.baseUrl, jwt: s.jwt, csrf: s.csrf, exp: s.exp, relogin };
      registerDirectServer(server.id, fresh);
      return fresh;
    };
    const session = await getStandaloneSession(server.id);
    const fresh = !!session && session.exp !== 0 && session.exp < Date.now() + 60_000;
    if (session && session.jwt && !fresh) {
      const target: DirectTarget = { baseUrl: server.baseUrl, jwt: session.jwt, csrf: session.csrf, exp: session.exp, relogin };
      registerDirectServer(server.id, target);
      return target;
    }
    return relogin();
  }, []);

  const openServer = useCallback(async (server: StandaloneServer) => {
    // Gate de suscripción: conectar un servidor requiere el entitlement app-unlock.
    setBusyId(server.id);
    if (!(await ensureUnlocked())) { setBusyId(null); setGateOpen(true); return; }
    const target = await ensureTarget(server);
    setBusyId(null);
    if (target) {
      void registerForPanelPushNotifications(server.id);
      void refreshModuleAccess(server.id);
      setView({ kind: "module", server, moduleId: "assistant" });
    } else {
      // Sin sesión válida ni contraseña guardada → pedir reconexión manual.
      setReconnect(server);
      setView({ kind: "add" });
    }
  }, [ensureTarget, ensureUnlocked, refreshModuleAccess]);

  /** Entra al alta de servidor sólo si la app está desbloqueada; si no, gate. */
  const startAddServer = useCallback(async () => {
    if (!(await ensureUnlocked())) { setGateOpen(true); return; }
    setReconnect(undefined);
    setView({ kind: "add" });
  }, [ensureUnlocked]);

  // Navegación hacia atrás por hardware: paso a paso dentro del overlay.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!visible) return false;
      if (view.kind === "module") { if(dismissNativeModuleDialog(`${view.server.id}:${view.moduleId}`))return true;setView({ kind: "picker", server: view.server }); return true; }
      if (view.kind === "picker") { setView({ kind: "list" }); return true; }
      if (view.kind === "add") { setView({ kind: "list" }); setReconnect(undefined); return true; }
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, view, onClose]);

  function renderConnectionView() {

  // ── Alta / re-conexión ─────────────────────────────────────────────────────
  if (view.kind === "add") {
    return (
      <AddStandaloneServerScreen
        existing={reconnect}
        onCancel={() => { setView({ kind: "list" }); setReconnect(undefined); }}
        onDone={async (server) => {
          setReconnect(undefined);
          await reload();
          // Tras guardar, abre directamente su selector de módulos.
          await openServer(server);
        }}
      />
    );
  }

  // ── Selector de módulos de un servidor ──────────────────────────────────────
  if (view.kind === "picker") {
    const server = view.server;
    return (
      <ServerModuleScreen
        title={server.name}
        subtitle={formatMessage(t.pickModuleSubtitle, { name: server.name })}
        onBack={() => setView({ kind: "list" })}
      >
        {catalogError ? <Text style={{ color: tokens.danger }}>{localizeServerError(catalogError)}</Text> : null}
        {!allowedModules ? catalogError ? <Pressable onPress={() => void refreshModuleAccess(server.id)}><Text style={{ color: tokens.brand }}>{nativeText("Reintentar")}</Text></Pressable> : <ModuleLoading /> : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {NATIVE_MODULES.filter((m) => allowedModules?.has(m.id)).map((m) => {
            const Icon = m.icon;
            return (
              <Pressable
                key={m.id}
                onPress={() => setView({ kind: "module", server, moduleId: m.id })}
                style={{
                  width: "47%",
                  flexGrow: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  padding: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: tokens.border,
                  backgroundColor: tokens.bgCardSolid,
                }}
              >
                <View style={{ width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: withAlpha(tokens.brand, 0.12) }}>
                  <Icon size={20} color={tokens.brand} />
                </View>
                <Text numberOfLines={1} style={{ color: tokens.textPrimary, fontSize: 14, fontWeight: "600", flexShrink: 1 }}>
                  {serverUserModuleLabel(m.id,language) ?? moduleLabels[m.labelKey] ?? m.id}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ServerModuleScreen>
    );
  }

  // ── Lista de servidores standalone ──────────────────────────────────────────
  return (
    <>
      <ServerModuleScreen
        title={t.title}
        subtitle={t.listSubtitle}
        onBack={onClose}
        action={{ label: t.addServer, icon: <TablerPlus size={16} color="#ffffff" />, onPress: () => { void startAddServer(); } }}
      >
        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator color={tokens.brand} />
          </View>
        ) : servers.length === 0 ? (
          <View style={{ paddingVertical: 40, alignItems: "center", gap: 8 }}>
            <TablerServer size={32} color={tokens.textMuted} />
            <Text style={{ color: tokens.textMuted, fontSize: 14, textAlign: "center" }}>{t.empty}</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {servers.map((s) => (
              <View
                key={s.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  padding: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: tokens.border,
                  backgroundColor: tokens.bgCardSolid,
                }}
              >
                <View style={{ width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: withAlpha(tokens.brand, 0.12) }}>
                  <TablerServer size={20} color={tokens.brand} />
                </View>
                <Pressable style={{ flex: 1 }} onPress={() => void openServer(s)} disabled={busyId === s.id}>
                  <Text numberOfLines={1} style={{ color: tokens.textPrimary, fontSize: 15, fontWeight: "700" }}>{s.name}</Text>
                  <Text numberOfLines={1} style={{ color: tokens.textMuted, fontSize: 12 }}>{s.baseUrl}</Text>
                  <Text numberOfLines={1} style={{ color: tokens.textMuted, fontSize: 12 }}>{s.username}</Text>
                </Pressable>
                {busyId === s.id ? (
                  <ActivityIndicator color={tokens.brand} />
                ) : (
                  <Pressable onPress={() => void openServer(s)} hitSlop={8} style={{ padding: 4 }}>
                    <TablerChevronRight size={20} color={tokens.textMuted} />
                  </Pressable>
                )}
                <Pressable onPress={() => setConfirmRemove(s)} hitSlop={8} style={{ padding: 4 }}>
                  <TablerTrash size={18} color={tokens.danger} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ServerModuleScreen>

      <ConfirmDialog
        visible={gateOpen}
        danger={false}
        title={t.subscriptionRequiredTitle}
        message={t.subscriptionRequiredMessage}
        confirmLabel={t.subscriptionRequiredCta}
        cancelLabel={t.cancel}
        onCancel={() => setGateOpen(false)}
        onConfirm={() => {
          setGateOpen(false);
          onClose();
          onRequireSubscription?.();
        }}
      />

      <ConfirmDialog
        visible={!!confirmRemove}
        title={t.remove}
        message={t.removeConfirm}
        confirmLabel={t.remove}
        cancelLabel={t.cancel}
        onCancel={() => setConfirmRemove(null)}
        onConfirm={async () => {
          const target = confirmRemove;
          setConfirmRemove(null);
          if (!target) return;
          await ensureTarget(target);
          await unregisterForPanelPushNotifications(target.id);
          unregisterDirectServer(target.id);
          await removeStandaloneServer(target.id);
          await reload();
        }}
      />
    </>
  );
  }
  return <View style={{flex:1}}>{renderConnectionView()}<PersistentNativeModules visible={visible} active={view.kind === "module" ? { panelId: view.server.id, moduleId: view.moduleId } : null} token="" onClose={() => {if(view.kind === "module") setView({ kind: "picker", server: view.server });}}/></View>;

}
