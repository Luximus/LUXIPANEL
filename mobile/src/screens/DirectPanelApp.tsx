import { useConfirmation } from "../components/ui/useConfirmation";
import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { BackHandler, Modal, Pressable, ScrollView, View } from "react-native";
import { PanelText as Text } from "../components/ui/PanelText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { DirectLoginScreen, type LoginValues } from "../components/login/DirectLoginScreen";
import type { LoginNoticeTone } from "../components/login/LoginControls";
import { ThemeTransitionScope } from "../theme/ThemeTransitionProvider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativePanelWorkspace } from "./main/NativePanelWorkspace";
import { NativeOverlayHost } from "./main/NativeOverlayHost";
import { ServerCallHost } from "../components/ServerCallHost";
import { useTheme } from "../hooks/useTheme";
import { paletteFromLayout, setActivePalette } from "../theme/panel-palette";
import { getThemeTokens } from "../theme/colors";
import { hydrateSessionState, saveSessionState } from "../lib/session-state";
import { resetAllStores } from "../lib/store-reset";
import { callServerApi, onDirectAuthRequired, getDirect, registerDirectServer, unregisterDirectServer, type DirectTarget } from "../api/serverApi";
import { loginStandalone, refreshStandaloneSession, normalizePanelProfileUrl, probePanel, publicLayout, recoveryStandalone, verifyStandaloneTotp, type DirectSession, type PanelLoginMethods } from "../api/directAuth";
import { loginInSystemBrowser } from "../api/nativeBrowserAuth";
import { listStandaloneServers, addStandaloneServer, updateStandaloneServer, removeStandaloneServer, getStandaloneSession, setStandaloneSession, clearStandaloneSession, type StandaloneServer } from "../storage/standaloneServers";
import { registerForPanelPushNotifications, unregisterForPanelPushNotifications } from "../lib/notifications";
import { panelLoginMessages } from "../i18n/panel-login";
import { connectionMessages, connectionError, setConnectionLanguage } from "../i18n/connections";
import { WORKSPACE_LOCALES } from "../i18n/workspace";
import type { PanelRow } from "../features/app/viewModels";
const ACTIVE_KEY = "luxipanel.direct.active.v1";
export default function DirectPanelApp() {
  const { askConfirmation, confirmation } = useConfirmation();
  const { theme, toggleTheme } = useTheme(), colors = getThemeTokens(theme === "dark"), insets = useSafeAreaInsets();
  const [language, setLanguage] = useState("en"), t = panelLoginMessages(language), c = connectionMessages(language);
  const [profiles, setProfiles] = useState<StandaloneServer[]>([]), [profile, setProfile] = useState<StandaloneServer | null>(null);
  const [session, setSession] = useState<DirectSession | null>(null), [identity, setIdentity] = useState("");
  const [config, setConfig] = useState(false), [editing, setEditing] = useState<string>(), [name, setName] = useState(""), [url, setUrl] = useState("");
  const [methods, setMethods] = useState<PanelLoginMethods | null>(null), [layout, setLayout] = useState<Record<string,string>>({});
  const [method, setMethod] = useState<"password" | "passkey" | "recovery">("password"), [user, setUser] = useState(""), [password, setPassword] = useState(""), [recovery, setRecovery] = useState("");
  const [partial, setPartial] = useState<DirectSession | null>(null), [code, setCode] = useState(""), [remember, setRemember] = useState(false), [visiblePassword, setVisiblePassword] = useState(false);
  const [authExpired, setAuthExpired] = useState(false);
  const [busy, setBusy] = useState(true), [notice, setNoticeValue] = useState(""), [languagePicker, setLanguagePicker] = useState(false);
  const [noticeTone, setNoticeTone] = useState<LoginNoticeTone>("error");
  const [operation, setOperation] = useState<"test" | "save" | null>(null);
  const setNotice = useCallback((value: string, tone: LoginNoticeTone = "error") => { setNoticeValue(value); setNoticeTone(tone); }, []);
  const generation = useRef(0), selectedRef = useRef<StandaloneServer | null>(null); selectedRef.current = profile;
  const reloadProfiles = useCallback(async () => { const list = await listStandaloneServers(); setProfiles(list); return list; }, []);
  const changeLanguage = useCallback((locale: string) => { setLanguage(locale); void saveSessionState({language:locale}); setLanguagePicker(false); }, []);
  const teardown = () => { resetAllStores(); setSession(null); setIdentity(""); setPartial(null); setPassword(""); setCode(""); setRecovery(""); };
  const register = async (selected: StandaloneServer, value: DirectSession, persist: boolean, current: () => boolean) => {
    if (!value.jwt || !current()) return;
    let refreshing: Promise<DirectTarget | null> | null = null;
    const relogin = (): Promise<DirectTarget | null> => {
      if (refreshing) return refreshing;
      const original = getDirect(selected.id);
      if (!original) return Promise.resolve(null);
      refreshing = (async () => {
        const value = await refreshStandaloneSession(selected.baseUrl, original).catch(() => null);
        if (!value || !current() || getDirect(selected.id) !== original) return null;
        const fresh: DirectTarget = {baseUrl:selected.baseUrl,...value,relogin};
        registerDirectServer(selected.id, fresh);
        if (persist) await setStandaloneSession(selected.id, fresh);
        return fresh;
      })().finally(() => { refreshing = null; });
      return refreshing;
    };
    registerDirectServer(selected.id, {baseUrl:selected.baseUrl,...value, relogin});
    const check = await callServerApi<{ok:boolean;user:{username:string;userId:number}}>(selected.id, "", "GET", "/api/session");
    if (!current()) { unregisterDirectServer(selected.id); return; }
    if (!check.ok || !check.data?.user?.username) { unregisterDirectServer(selected.id); throw new Error(t.authError); }
    const effective = getDirect(selected.id);
    if (!effective?.jwt || !current()) return;
    const activeSession: DirectSession = {jwt:effective.jwt,csrf:effective.csrf ?? null,exp:effective.exp ?? 0};
    if (persist) await setStandaloneSession(selected.id, activeSession); else await clearStandaloneSession(selected.id);
    if (!current()) return;
    const username = check.data.user.username;
    await updateStandaloneServer(selected.id, {username,savePassword:false});
    if (!current()) return;
    setIdentity(`${selected.id}:${check.data.user.userId}:${username}`); setSession(activeSession); setPartial(null); setPassword(""); setCode(""); setRecovery("");
    void registerForPanelPushNotifications(selected.id);
  };
  const select = useCallback(async (selected: StandaloneServer) => {
    const seq = ++generation.current, current = () => generation.current === seq;
    teardown(); setAuthExpired(false); setProfile(selected); setConfig(false); setMethods(null); setLayout({}); setNotice(""); setUser(selected.username || ""); setBusy(true);
    await AsyncStorage.setItem(ACTIVE_KEY, selected.id);
    try {
      const [available, branding, saved] = await Promise.all([probePanel(selected.baseUrl), publicLayout(selected.baseUrl), getStandaloneSession(selected.id)]);
      if (!current()) return;
      setMethods(available); setLayout(branding); setActivePalette(paletteFromLayout(branding));
      setMethod(available.password ? "password" : available.passkey ? "passkey" : "recovery");
      if (saved?.jwt && (!saved.exp || saved.exp > Date.now())) {
        try { await register(selected, saved, true, current); } catch { if (current()) await clearStandaloneSession(selected.id); }
      }
    } catch (error) { if (current()) setNotice(connectionError(error, language)); }
    finally { if (current()) setBusy(false); }
  }, [t.authError]);
  useEffect(() => { let mounted = true; void (async () => { const preferences = await hydrateSessionState(); const list = await reloadProfiles(); const active = await AsyncStorage.getItem(ACTIVE_KEY); if (!mounted) return; setLanguage(preferences.language); const chosen = list.find(p => p.id === active) ?? list[0]; if (chosen) await select(chosen); else { setBusy(false); setConfig(true); } })(); return () => { mounted = false; generation.current++; resetAllStores(); }; }, []);
  useEffect(() => { setConnectionLanguage(language); }, [language]);
  useEffect(() => {
    if (!config || !profiles.length) return;
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      if (busy) return true;
      setConfig(false); setNotice("");
      return true;
    });
    return () => back.remove();
  }, [config, profiles.length, busy, setNotice]);
  useEffect(() => onDirectAuthRequired(id => { if (selectedRef.current?.id === id) setAuthExpired(true); }), []);
  // Catch an expired session on foreground; the user's draft stays until an explicit new login/profile.
  useEffect(() => {
    if (!session || !profile) return;
    const id = setInterval(() => { const target = getDirect(profile.id); if (!target) return; if (target.exp && target.exp < Date.now() + 120000) void target.relogin?.(); }, 60000);
    return () => clearInterval(id);
  }, [session, profile]);
  const login = async () => {
    if (!profile || busy || !methods) return;
    const selected = profile, seq = generation.current, current = () => seq === generation.current;
    setNotice("");
    if (partial && !/^\d{6}$/.test(code)) { setNotice(t.errors.enterTotp6Digits); return; }
    if (!partial && method === "recovery" && (!user.trim() || !recovery.trim())) { setNotice(t.errors.enterUserRecoveryCode); return; }
    setBusy(true);
    try {
      if (!partial && (method === "passkey" || (method === "password" && methods.hcaptchaEnabled))) {
        const value = await loginInSystemBrowser(selected.baseUrl, language, current);
        if (value && current()) await register(selected, value, remember, current);
        return;
      }
      const result = partial ? await verifyStandaloneTotp(selected.baseUrl, partial, code) : method === "recovery" ? await recoveryStandalone(selected.baseUrl, user, recovery, remember) : await loginStandalone(selected.baseUrl, user, password, {remember});
      if (!current()) return;
      if (result.status === "error") throw new Error((t.authErrors as Record<string,string>)[result.code] || result.message);
      if (result.status === "mfa") { setPartial(result.partial); setPassword(""); return; }
      await register(selected, result.session, remember, current);
    } catch (error) { if (current()) setNotice(connectionError(error, language)); }
    finally { if (current()) setBusy(false); }
  };
  const logout = async () => {
    if (!profile) return;
    const selected = profile, seq = ++generation.current; setBusy(true);
    try { await unregisterForPanelPushNotifications(selected.id); await callServerApi(selected.id,"","POST","/api/logout"); } finally { await clearStandaloneSession(selected.id); if (generation.current === seq) { teardown(); setBusy(false); } }
  };
  const saveProfile = async (onlyProbe = false) => {
    if (busy) return;
    setOperation(onlyProbe ? "test" : "save");
    setBusy(true); setNotice("");
    try {
      const baseUrl = normalizePanelProfileUrl(url); if (!baseUrl) throw new Error(c.invalidUrl);
      await probePanel(baseUrl);
      if (onlyProbe) { setUrl(baseUrl.replace(/^https:\/\//i, "")); setNotice(c.available, "success"); return; }
      let selected: StandaloneServer;
      const old = profiles.find(p => p.id === editing);
      if (old) {
        if (old.baseUrl !== baseUrl) { await clearStandaloneSession(old.id); unregisterDirectServer(old.id); }
        await updateStandaloneServer(old.id,{name:name.trim() || new URL(baseUrl).host,baseUrl}); selected = {...old,name:name.trim() || new URL(baseUrl).host,baseUrl};
      } else selected = await addStandaloneServer({name:name.trim() || new URL(baseUrl).host,baseUrl,username:"",savePassword:false});
      await reloadProfiles(); setEditing(undefined); setName(""); setUrl(""); await select(selected);
    } catch(error) { setNotice(connectionError(error, language)); } finally { setBusy(false); setOperation(null); }
  };
  const edit = (p?: StandaloneServer) => { setEditing(p?.id); setName(p?.name ?? ""); setUrl((p?.baseUrl ?? "").replace(/^https:\/\//i, "")); setNotice(""); setConfig(true); };
  const remove = (selected: StandaloneServer) => askConfirmation(c.remove, `${selected.name}\n${c.removePrompt}`, [
    { text: c.cancel, style: "cancel" },
    { text: c.remove, style: "destructive", onPress: async () => {
      await removeStandaloneServer(selected.id);
      unregisterDirectServer(selected.id);
      if (profile?.id === selected.id) {
        ++generation.current; teardown(); setProfile(null); setEditing(undefined); setName(""); setUrl(""); setConfig(true);
      }
      await reloadProfiles();
    } },
  ]);
  const panelRows: PanelRow[] = useMemo(() => profile ? [{id:profile.id,nameLabel:profile.name,serverIpMasked:new URL(profile.baseUrl).host,serverIpRaw:null,categoryLabel:"",tags:[],licenseState:"",sshState:"",provider:"direct",providerLabel:"LUXIPANEL",serverStatus:"active",accessDomain:profile.baseUrl,searchBlob:profile.name,canRecharge:false,canConnect:true,canEdit:true,canDelete:true,source:{id:profile.id,customDomain:profile.baseUrl} as PanelRow["source"]}] : [], [profile]);
  const onValue = (field: keyof LoginValues, value: string) => {
    ({user:setUser,password:setPassword,recovery:setRecovery,code:setCode})[field](field === "code" ? value.replace(/\D/g, "").slice(0,6) : value);
    if (notice) setNotice("");
  };
  return <>{confirmation}<NativeOverlayHost><View style={{flex:1,backgroundColor:colors.bgPrimary,paddingTop:insets.top}}>
    <StatusBar style={theme === "dark" ? "light" : "dark"}/>
    <ThemeTransitionScope value={`${profile?.id ?? ""}:${identity}:${config}:${languagePicker}:${!!partial}:${method}`} />
    {session && profile && !config ? <NativePanelWorkspace key={identity} account={identity} token={session.jwt} panels={panelRows} busy={false} language={language} active onFocusHandled={()=>{}} onPanelChange={()=>{}} onManagePanels={()=>edit()} onEditPanel={()=>edit(profile)} onDeletePanel={()=>remove(profile)} onAccount={()=>edit()} onLogout={()=>void logout()} onSupport={()=>{}} onToggleTheme={toggleTheme} onLanguageChange={changeLanguage}/> :
      <DirectLoginScreen theme={theme} language={language} layout={layout} profile={profile} methods={methods} method={method} busy={busy} partial={!!partial}
        values={{user,password,recovery,code}} remember={remember} visiblePassword={visiblePassword} notice={notice} noticeTone={noticeTone} onValue={onValue}
        onMethod={next=>{setMethod(next);setNotice("");}} onRemember={()=>setRemember(v=>!v)} onVisibility={()=>setVisiblePassword(v=>!v)}
        onBack={()=>{setPartial(null);setCode("");setNotice("");}}
        onSubmit={()=>void login()} onRetry={()=>{if(profile) void select(profile);}} onConfigure={()=>{
          if (operation) return;
          if (config) { if (profiles.length) { setConfig(false); setNotice(""); } return; }
          edit();
        }} onLanguage={()=>setLanguagePicker(true)} onTheme={toggleTheme} config={config} connection={{
        dark:theme === "dark",language,profiles,activeId:profile?.id,editing,name,url,busy,operation,notice,noticeTone,
        onName:value=>{setName(value);setNotice("");},onUrl:value=>{setUrl(value);setNotice("");},
        onClose:()=>{setConfig(false);setNotice("");},onEdit:edit,onSelect:selected=>void select(selected),onRemove:remove,
        onSave:()=>void saveProfile(),onTest:()=>void saveProfile(true),
      }} />}

    <Modal visible={languagePicker} transparent animationType="fade" onRequestClose={()=>setLanguagePicker(false)}><Pressable accessibilityRole="button" accessibilityLabel={c.close} onPress={()=>setLanguagePicker(false)} style={{flex:1,backgroundColor:colors.bgOverlay,justifyContent:"center",padding:24}}><ScrollView style={{maxHeight:480,backgroundColor:colors.bgCardSolid,borderRadius:20,borderWidth:1,borderColor:colors.border}}>{WORKSPACE_LOCALES.map(locale=><Pressable key={locale.code} accessibilityRole="button" accessibilityState={{selected:locale.code===language}} onPress={()=>changeLanguage(locale.code)} style={{padding:16,minHeight:48,backgroundColor:locale.code===language?colors.brandDim:"transparent"}}><Text style={{color:colors.textPrimary}}>{locale.label}</Text></Pressable>)}</ScrollView></Pressable></Modal>
    {authExpired && profile && session && <View style={{position:"absolute",top:insets.top+44,left:12,right:12,padding:12,borderRadius:8,backgroundColor:colors.bgCardSolid,zIndex:999}}><Pressable onPress={()=>void select(profile)}><Text style={{color:colors.danger}}>{c.expired}</Text></Pressable></View>}
    <ServerCallHost/>
  </View></NativeOverlayHost></>;
}
