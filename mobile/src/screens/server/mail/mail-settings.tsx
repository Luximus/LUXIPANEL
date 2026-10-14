import { nativeText } from '../../../i18n/native-text';
import { FormDrawer } from "../../../components/ui/FormDrawer";
import { useRegisterModuleSettingsPage, type ModuleSettingsPage } from "../../../components/server/module-settings-pages";
import { NativeOperationCard } from "../NativeOperationCard";
import { serviceExtras } from "../native-extras/services";
import { NativeModuleContext } from "../../main/native-module-visibility";
/**
 * mail-settings — ajustes de correo a nivel dominio/servidor extraídos de
 * `MailScreen.tsx` (espejo del reparto de desktop): spam · enrutamiento ·
 * reenvíos de dominio · dirección por defecto · archivado · cifrado PGP ·
 * filtros globales. Cada sección carga y guarda su propio estado. Código
 * movido tal cual; reutiliza `StringListEditor` (mail-ui) y `FilterDialog`
 * (mail-manage).
 */
import React, { useContext, useCallback, useEffect, useMemo, useState } from "react";
import { Text, View, ScrollView } from "react-native";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens, withAlpha } from "../../../theme/colors";
import { getMessages, formatMessage } from "../../../i18n";
import { loadSessionState } from "../../../lib/session-state";
import { ServerDataTable, type ServerColumn, type ServerRowAction } from "../../../components/server/ServerDataTable";
import { ConfirmDialog, Field, Checkbox, InfoBox, DialogFooter } from "../../../components/server/Form";
import { pillColors } from "../../../components/server/badges";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Button } from "../../../components/ui/Button";
import { SegmentedControl } from "../../../components/ui/SegmentedControl";
import { SettingsColumns, SettingsSectionBody } from "../../../components/ui/ModuleSettingsDrawer";
import { ShieldCheck, Route, Forward, Mail, Archive, KeyRound, ListFilter } from "lucide-react-native";
import { TablerPlus, TablerEdit, TablerTrash, TablerDeviceFloppy } from "../../../features/app/tabler-icons";
import { callServerApi, unwrap } from "../../../api/serverApi";
import { runServerMutation } from "../../../hooks/useServerApi";
import { ROUTING_MODES, SPAM_SCORE_PRESETS, RETENTION_OPTIONS } from "./mail-constants";
import { fmtDate } from "./mail-format";
import {
  normFilters, normDomains, normDomainForwards, normRouting,
  normDefaultAddress, normSpam, normArchive, normEncryptionKeys,
} from "./mail-normalizers";
import type {
  MailFilter, DomainForwardEntry, RoutingMode, DefaultRule, SpamSettings,
  ArchiveFlags, ArchiveSettings, EncryptionKey,
} from "./mail-types";
import { StringListEditor } from "./mail-ui";
import { FilterDialog } from "./mail-manage";

const enc = encodeURIComponent;

// ═══════════════════════════════════════════════════════════════════════════
// Ajustes de correo (nivel dominio/servidor): spam · enrutamiento · reenvíos de
// dominio · dirección por defecto. Cada sección carga y guarda su propio estado.
// ═══════════════════════════════════════════════════════════════════════════

export type ShowToast = (message: string, err?: boolean) => void;

/** Esqueleto de carga compartido por las secciones de ajustes. */
function SettingsSkeleton() {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  return (
    <View style={{ paddingVertical: 24 }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ height: 12, width: `${88 - i * 10}%`, borderRadius: 6, backgroundColor: withAlpha(tokens.textMuted, 0.18), marginVertical: 6 }} />
      ))}
    </View>
  );
}

/** Lista de "configuración actual" (mapa dominio→valor) bajo cada formulario. */
function CurrentMap({
  title,
  empty,
  rows,
  tokens,
}: {
  title: string;
  empty: string;
  rows: { key: string; label: string; value: string }[];
  tokens: ReturnType<typeof getThemeTokens>;
}) {
  return (
    <View style={{ marginTop: 14, gap: 6 }}>
      <Text style={{ color: tokens.textMuted, fontSize: 12, fontWeight: "700" }}>{title}</Text>
      {rows.length === 0 ? (
        <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{empty}</Text>
      ) : (
        rows.map((row) => (
          <View key={row.key} style={{ flexDirection: "row", justifyContent: "space-between", borderWidth: 1, borderColor: tokens.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, gap: 8 }}>
            <Text style={{ color: tokens.textSecondary, fontSize: 13, flex: 1 }} numberOfLines={1}>{row.label}</Text>
            <Text style={{ color: tokens.textPrimary, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>{row.value}</Text>
          </View>
        ))
      )}
    </View>
  );
}

/** Contenedor de los ajustes de dominio (sub-navegador propio con scroll). */
export function MailSettingsScreen({ panelId, token, showToast }: { panelId: string; token: string; showToast: ShowToast }) {
  const language = loadSessionState().language;
  const s = getMessages(language).serverMail.settings;
  const context = useContext(NativeModuleContext);
  const [section, setSection] = useState("spam");
  useEffect(() => { if(context?.selectedView === "global-filters") setSection("globalFilters"); else if(context?.selectedView === "spam-filters") setSection("spam"); }, [context?.selectedView,context?.viewRevision]);
  const [domains, setDomains] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await callServerApi(panelId, token, "GET", "/api/accounts/domains");
      if (!alive) return;
      setDomains(normDomains(unwrap(res)));
    })();
    return () => {
      alive = false;
    };
  }, [panelId, token]);

  const props = {panelId,token,showToast};
  const pages = [
    {key:"routing",label:s.secRouting,content:<RoutingForm {...props} domains={domains}/>},
    {key:"forwards",label:s.secForwards,content:<DomainForwardsForm {...props}/>},
    {key:"encryption",label:s.secEncryption,content:<EncryptionForm {...props}/>},
    {key:"archive",label:s.secArchive,content:<ArchiveForm {...props} domains={domains}/>},
    {key:"default",label:s.secDefault,content:<DefaultAddressForm {...props} domains={domains}/>},
    {key:"outbound",get label() { return nativeText("Correo saliente"); },content:<View style={{gap:20}}>{serviceExtras.mail.find(group=>group.title==="Correo saliente del panel")?.operations.map(operation=><NativeOperationCard key={operation.title} embedded {...operation} panelId={panelId} token={token}/>)}</View>},
  ];
  return <>{pages.map(page=><MailSettingsPage key={page.key} page={page}/>)}
    {context?.selectedView === "spam-filters" ? <SpamForm {...props}/> : null}
    {context?.selectedView === "global-filters" ? <GlobalFiltersForm {...props}/> : null}
  </>;
}
function MailSettingsPage({page}:{page:ModuleSettingsPage}) {
  useRegisterModuleSettingsPage(page);
  return null;

}

/** Filtro de spam (SpamAssassin) a nivel servidor. */
function SpamForm({ panelId, token, showToast }: { panelId: string; token: string; showToast: ShowToast }) {
  const language = loadSessionState().language;
  const s = getMessages(language).serverMail.settings;
  const sp = s.spam;
  const [data, setData] = useState<SpamSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await callServerApi(panelId, token, "GET", "/api/mail/spam-filters");
      if (!alive) return;
      setData(normSpam(unwrap(res)));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [panelId, token]);

  const patch = (p: Partial<SpamSettings>) => setData((d) => (d ? { ...d, ...p } : d));

  const save = async () => {
    if (!data) return;
    setBusy(true);
    const payload: Record<string, unknown> = {
      enabled: data.enabled,
      spamBoxEnabled: data.spamBoxEnabled,
      autoDeleteEnabled: data.autoDeleteEnabled,
      requiredScoreSelect: data.requiredScoreSelect,
      autoDeleteThresholdScore: data.autoDeleteThresholdScore,
      whitelistFrom: data.whitelistFrom,
      blacklistFrom: data.blacklistFrom,
    };
    if (data.requiredScoreSelect === "custom") payload.customRequiredScore = data.customRequiredScore ?? 5;
    const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "PUT", "/api/mail/spam-filters", payload));
    setBusy(false);
    if (out.ok) {
      const fresh = await callServerApi(panelId, token, "GET", "/api/mail/spam-filters");
      setData(normSpam(unwrap(fresh)));
      showToast(s.saved);
    } else showToast(out.error ?? s.error, true);
  };

  if (loading || !data) return <SettingsSkeleton />;

  const scoreOptions = SPAM_SCORE_PRESETS.map((v) => ({ value: v, label: v === "custom" ? sp.scoreCustom : v }));

  return (
    <View style={{ gap: 4 }}>
      <InfoBox>{sp.intro}</InfoBox>
      <Checkbox value={data.enabled} onChange={(v) => patch({ enabled: v })} label={sp.enabled} />
      <View style={{ height: 8 }} />
      <Checkbox value={data.spamBoxEnabled} onChange={(v) => patch({ spamBoxEnabled: v })} label={sp.spamBox} />
      <View style={{ height: 8 }} />
      <Checkbox value={data.autoDeleteEnabled} onChange={(v) => patch({ autoDeleteEnabled: v })} label={sp.autoDelete} />
      <View style={{ height: 12 }} />
      <Field label={sp.requiredScore} hint={sp.scoreNote}>
        <Select value={data.requiredScoreSelect} options={scoreOptions} onChange={(v) => patch({ requiredScoreSelect: v })} />
      </Field>
      {data.requiredScoreSelect === "custom" ? (
        <Field label={sp.customScore}>
          <Input value={String(data.customRequiredScore ?? "")} onChangeText={(v) => patch({ customRequiredScore: Number(v) || 0 })} keyboardType="number-pad" placeholder="5" />
        </Field>
      ) : null}
      {data.autoDeleteEnabled ? (
        <Field label={sp.autoDeleteThreshold}>
          <Input value={String(data.autoDeleteThresholdScore)} onChangeText={(v) => patch({ autoDeleteThresholdScore: Number(v) || 0 })} keyboardType="number-pad" placeholder="5" />
        </Field>
      ) : null}
      <Field label={sp.whitelist} hint={sp.whitelistHint}>
        <StringListEditor items={data.whitelistFrom} onChange={(v) => patch({ whitelistFrom: v })} placeholder={sp.addressPlaceholder} addLabel={sp.addAddress} />
      </Field>
      <View style={{ height: 6 }} />
      <Field label={sp.blacklist} hint={sp.blacklistHint}>
        <StringListEditor items={data.blacklistFrom} onChange={(v) => patch({ blacklistFrom: v })} placeholder={sp.addressPlaceholder} addLabel={sp.addAddress} />
      </Field>
      <Button label={s.save} icon={<TablerDeviceFloppy size={16} />} onPress={save} loading={busy} />
    </View>
  );
}

/** Enrutamiento de correo por dominio (PUT por dominio). */
function RoutingForm({ panelId, token, domains, showToast }: { panelId: string; token: string; domains: string[]; showToast: ShowToast }) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const s = getMessages(language).serverMail.settings;
  const r = s.routing;
  const [map, setMap] = useState<Record<string, RoutingMode>>({});
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState("");
  const [mode, setMode] = useState<RoutingMode>("auto_remote");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await callServerApi(panelId, token, "GET", "/api/mail/domain-routing");
      if (!alive) return;
      setMap(normRouting(unwrap(res)));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [panelId, token]);

  useEffect(() => {
    if (domain && map[domain]) setMode(map[domain]);
  }, [domain, map]);

  const save = async () => {
    if (!domain) {
      showToast(s.selectDomain, true);
      return;
    }
    setBusy(true);
    const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "PUT", "/api/mail/domain-routing", { domain, mode }));
    setBusy(false);
    if (out.ok) {
      setMap((prev) => ({ ...prev, [domain]: mode }));
      showToast(s.saved);
    } else showToast(out.error ?? s.error, true);
  };

  if (loading) return <SettingsSkeleton />;
  if (!domains.length) return <InfoBox tone="warn">{s.noDomains}</InfoBox>;

  const modeOptions = ROUTING_MODES.map((mm) => ({ value: mm, label: r.modes[mm] }));
  const domainOptions = domains.map((d) => ({ value: d, label: d }));

  return (
    <View style={{ gap: 4 }}>
      <InfoBox>{r.intro}</InfoBox>
      <Field label={s.domain}>
        <Select value={domain} options={domainOptions} placeholder={s.selectDomain} onChange={setDomain} />
      </Field>
      <Field label={r.mode}>
        <Select value={mode} options={modeOptions} onChange={(v) => setMode(v as RoutingMode)} />
      </Field>
      <Button label={s.save} icon={<TablerDeviceFloppy size={16} />} onPress={save} loading={busy} disabled={!domain} />
      <CurrentMap title={s.current} empty={s.none} rows={Object.entries(map).map(([d, mm]) => ({ key: d, label: d, value: r.modes[mm] }))} tokens={tokens} />
    </View>
  );
}

/** Reenvíos de dominio (catch-all): editor de entradas, reemplazo total. */
function DomainForwardsForm({ panelId, token, showToast }: { panelId: string; token: string; showToast: ShowToast }) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const s = getMessages(language).serverMail.settings;
  const fw = s.forwards;
  const [entries, setEntries] = useState<DomainForwardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await callServerApi(panelId, token, "GET", "/api/mail/domain-forwards");
      if (!alive) return;
      setEntries(normDomainForwards(unwrap(res)));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [panelId, token]);

  const save = async () => {
    const clean = entries
      .map((e) => ({ domain: e.domain.trim().toLowerCase(), destinations: e.destinations.map((d) => d.trim().toLowerCase()).filter(Boolean) }))
      .filter((e) => e.domain && e.destinations.length);
    setBusy(true);
    const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "PUT", "/api/mail/domain-forwards", { entries: clean }));
    setBusy(false);
    if (out.ok) {
      const fresh = await callServerApi(panelId, token, "GET", "/api/mail/domain-forwards");
      setEntries(normDomainForwards(unwrap(fresh)));
      showToast(s.saved);
    } else showToast(out.error ?? s.error, true);
  };

  if (loading) return <SettingsSkeleton />;

  return (
    <View style={{ gap: 12 }}>
      <InfoBox>{fw.intro}</InfoBox>
      {entries.length === 0 ? <Text style={{ color: tokens.textMuted, fontSize: 13 }}>{fw.empty}</Text> : null}
      {entries.map((entry, i) => (
        <View key={i} style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 10, padding: 10, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Input value={entry.domain} onChangeText={(v) => setEntries((prev) => prev.map((x, j) => (j === i ? { ...x, domain: v } : x)))} placeholder={fw.labelDomain} autoCapitalize="none" />
            </View>
            <Button label="" variant="ghost" size="sm" icon={<TablerTrash size={18} color={tokens.danger} />} onPress={() => setEntries((prev) => prev.filter((_, j) => j !== i))} />
          </View>
          <Text style={{ color: tokens.textMuted, fontSize: 11, fontWeight: "600" }}>{fw.destinations}</Text>
          <StringListEditor items={entry.destinations} onChange={(v) => setEntries((prev) => prev.map((x, j) => (j === i ? { ...x, destinations: v } : x)))} placeholder={fw.destinationPlaceholder} addLabel={fw.addDestination} />
        </View>
      ))}
      <Button label={fw.addEntry} variant="secondary" size="sm" icon={<TablerPlus size={16} />} onPress={() => setEntries((prev) => [...prev, { domain: "", destinations: [] }])} style={{ alignSelf: "flex-start" }} />
      <Button label={s.save} icon={<TablerDeviceFloppy size={16} />} onPress={save} loading={busy} />
    </View>
  );
}

/** Dirección por defecto del dominio: rechazar o reenviar lo no entregable. */
function DefaultAddressForm({ panelId, token, domains, showToast }: { panelId: string; token: string; domains: string[]; showToast: ShowToast }) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const s = getMessages(language).serverMail.settings;
  const da = s.defaultAddr;
  const [map, setMap] = useState<Record<string, DefaultRule>>({});
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState("");
  const [mode, setMode] = useState<"fail" | "forward">("fail");
  const [failureMessage, setFailureMessage] = useState("");
  const [forwardTo, setForwardTo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await callServerApi(panelId, token, "GET", "/api/mail/default-address");
      if (!alive) return;
      setMap(normDefaultAddress(unwrap(res)));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [panelId, token]);

  useEffect(() => {
    const rule = domain ? map[domain] : undefined;
    if (rule) {
      setMode(rule.mode);
      setFailureMessage(rule.failureMessage);
      setForwardTo(rule.forwardTo);
    }
  }, [domain, map]);

  const save = async () => {
    if (!domain) {
      showToast(s.selectDomain, true);
      return;
    }
    if (mode === "forward" && !forwardTo.trim()) {
      showToast(da.errForward, true);
      return;
    }
    setBusy(true);
    const payload =
      mode === "forward"
        ? { domain, mode, forwardTo: forwardTo.trim().toLowerCase() }
        : { domain, mode, failureMessage: failureMessage.trim() || "No Such User Here" };
    const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "PUT", "/api/mail/default-address", payload));
    setBusy(false);
    if (out.ok) {
      setMap((prev) => ({
        ...prev,
        [domain]:
          mode === "forward"
            ? { mode, forwardTo: forwardTo.trim().toLowerCase(), failureMessage: "" }
            : { mode, failureMessage: failureMessage.trim() || "No Such User Here", forwardTo: "" },
      }));
      showToast(s.saved);
    } else showToast(out.error ?? s.error, true);
  };

  if (loading) return <SettingsSkeleton />;
  if (!domains.length) return <InfoBox tone="warn">{s.noDomains}</InfoBox>;

  const modeOptions = [
    { value: "fail", label: da.modeFail },
    { value: "forward", label: da.modeForward },
  ];
  const domainOptions = domains.map((d) => ({ value: d, label: d }));

  return (
    <View style={{ gap: 4 }}>
      <InfoBox>{da.intro}</InfoBox>
      <Field label={s.domain}>
        <Select value={domain} options={domainOptions} placeholder={s.selectDomain} onChange={setDomain} />
      </Field>
      <Field label={da.mode}>
        <Select value={mode} options={modeOptions} onChange={(v) => setMode(v === "forward" ? "forward" : "fail")} />
      </Field>
      {mode === "forward" ? (
        <Field label={da.forwardTo}>
          <Input value={forwardTo} onChangeText={setForwardTo} placeholder={da.forwardPlaceholder} autoCapitalize="none" keyboardType="email-address" />
        </Field>
      ) : (
        <Field label={da.failureMessage}>
          <Input value={failureMessage} onChangeText={setFailureMessage} placeholder={da.failurePlaceholder} />
        </Field>
      )}
      <Button label={s.save} icon={<TablerDeviceFloppy size={16} />} onPress={save} loading={busy} disabled={!domain} />
      <CurrentMap
        title={s.current}
        empty={s.none}
        rows={Object.entries(map).map(([d, rule]) => ({ key: d, label: d, value: rule.mode === "forward" ? `${da.modeForward} → ${rule.forwardTo}` : da.modeFail }))}
        tokens={tokens}
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Archivado (retención por dominio) · Cifrado PGP · Filtros globales.
// Cada sección de "Ajustes de correo" carga y guarda su propio estado.
// ═══════════════════════════════════════════════════════════════════════════

/** Archivado de correo: valores por defecto + retención por dominio. */
function ArchiveForm({ panelId, token, domains, showToast }: { panelId: string; token: string; domains: string[]; showToast: ShowToast }) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const s = getMessages(language).serverMail.settings;
  const a = s.archive;
  const [data, setData] = useState<ArchiveSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyDefaults, setBusyDefaults] = useState(false);
  const [busyDomain, setBusyDomain] = useState(false);
  // Editor de dominio.
  const [domain, setDomain] = useState("");
  const [dIncoming, setDIncoming] = useState(false);
  const [dOutgoing, setDOutgoing] = useState(false);
  const [dList, setDList] = useState(false);
  const [retention, setRetention] = useState("0");
  const [customDays, setCustomDays] = useState("30");

  const refresh = useCallback(async () => {
    const res = await callServerApi(panelId, token, "GET", "/api/mail/archive");
    setData(normArchive(unwrap(res)));
  }, [panelId, token]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await callServerApi(panelId, token, "GET", "/api/mail/archive");
      if (!alive) return;
      setData(normArchive(unwrap(res)));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [panelId, token]);

  // Pre-llena al elegir un dominio ya configurado.
  useEffect(() => {
    const entry = domain && data ? data.domains[domain] : undefined;
    if (entry) {
      setDIncoming(entry.incoming);
      setDOutgoing(entry.outgoing);
      setDList(entry.outgoingMailingList);
      setRetention(entry.retentionDays === "custom" ? "custom" : String(entry.retentionDays));
      setCustomDays(entry.customRetentionDays != null ? String(entry.customRetentionDays) : "30");
    }
  }, [domain, data]);

  const patchDefault = (p: Partial<ArchiveFlags>) => setData((d) => (d ? { ...d, defaults: { ...d.defaults, ...p } } : d));

  const saveDefaults = async () => {
    if (!data) return;
    setBusyDefaults(true);
    const out = await runServerMutation(panelId, token, () =>
      callServerApi(panelId, token, "PUT", "/api/mail/archive/defaults", {
        incoming: data.defaults.incoming,
        outgoingMailingList: data.defaults.outgoingMailingList,
        outgoing: data.defaults.outgoing,
      }),
    );
    setBusyDefaults(false);
    if (out.ok) {
      await refresh();
      showToast(a.saved);
    } else showToast(out.error ?? s.error, true);
  };

  const saveDomain = async () => {
    if (!domain) {
      showToast(s.selectDomain, true);
      return;
    }
    setBusyDomain(true);
    const payload: Record<string, unknown> = {
      domain,
      incoming: dIncoming,
      outgoingMailingList: dList,
      outgoing: dOutgoing,
      retentionDays: retention === "custom" ? "custom" : Number(retention),
    };
    if (retention === "custom") payload.customRetentionDays = Number(customDays) || 1;
    const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "PUT", "/api/mail/archive/domain", payload));
    setBusyDomain(false);
    if (out.ok) {
      await refresh();
      showToast(a.saved);
    } else showToast(out.error ?? s.error, true);
  };

  if (loading || !data) return <SettingsSkeleton />;

  const retentionLabel = (v: number | "custom"): string =>
    v === "custom" ? a.retentionCustom : v === 0 ? a.retentionForever : formatMessage(a.retentionDays, { days: v });
  const retentionOptions = [...RETENTION_OPTIONS.map((v) => ({ value: String(v), label: retentionLabel(v) })), { value: "custom", label: a.retentionCustom }];
  const domainRows = Object.entries(data.domains).map(([d, e]) => ({ key: d, label: d, value: retentionLabel(e.retentionDays === "custom" ? "custom" : e.retentionDays) }));

  return (
    <View style={{ gap: 12 }}>
      <InfoBox>{a.intro}</InfoBox>
      <Text style={{ color: tokens.textPrimary, fontSize: 13, fontWeight: "700" }}>{a.defaultsTitle}</Text>
      <Text style={{ color: tokens.textMuted, fontSize: 11 }}>{a.defaultsHint}</Text>
      <Checkbox value={data.defaults.incoming} onChange={(v) => patchDefault({ incoming: v })} label={a.incoming} />
      <Checkbox value={data.defaults.outgoing} onChange={(v) => patchDefault({ outgoing: v })} label={a.outgoing} />
      <Checkbox value={data.defaults.outgoingMailingList} onChange={(v) => patchDefault({ outgoingMailingList: v })} label={a.outgoingMailingList} />
      <Button label={a.saveDefaults} icon={<TablerDeviceFloppy size={16} />} onPress={saveDefaults} loading={busyDefaults} />

      <View style={{ height: 1, backgroundColor: tokens.border, marginVertical: 6 }} />
      <Text style={{ color: tokens.textPrimary, fontSize: 13, fontWeight: "700" }}>{a.domainTitle}</Text>
      <Text style={{ color: tokens.textMuted, fontSize: 11 }}>{a.domainHint}</Text>
      {!domains.length ? (
        <InfoBox tone="warn">{s.noDomains}</InfoBox>
      ) : (
        <>
          <Field label={s.domain}>
            <Select value={domain} options={domains.map((d) => ({ value: d, label: d }))} placeholder={s.selectDomain} onChange={setDomain} />
          </Field>
          <Checkbox value={dIncoming} onChange={setDIncoming} label={a.incoming} />
          <Checkbox value={dOutgoing} onChange={setDOutgoing} label={a.outgoing} />
          <Checkbox value={dList} onChange={setDList} label={a.outgoingMailingList} />
          <Field label={a.retention}>
            <Select value={retention} options={retentionOptions} onChange={setRetention} />
          </Field>
          {retention === "custom" ? (
            <Field label={a.customDays}>
              <Input value={customDays} onChangeText={setCustomDays} keyboardType="number-pad" placeholder="30" />
            </Field>
          ) : null}
          <Button label={a.saveDomain} icon={<TablerDeviceFloppy size={16} />} onPress={saveDomain} loading={busyDomain} disabled={!domain} />
        </>
      )}
      <CurrentMap title={a.currentTitle} empty={a.currentEmpty} rows={domainRows} tokens={tokens} />
    </View>
  );
}

/** Cifrado PGP: lista de claves + generar + importar pública. */
function EncryptionForm({ panelId, token, showToast }: { panelId: string; token: string; showToast: ShowToast }) {
  const language = loadSessionState().language;
  const root = getMessages(language).serverMail;
  const s = root.settings;
  const e = s.encryption;
  const [keys, setKeys] = useState<EncryptionKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [delTarget, setDelTarget] = useState<EncryptionKey | null>(null);
  const [delBusy, setDelBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await callServerApi(panelId, token, "GET", "/api/mail/encryption");
    setKeys(normEncryptionKeys(unwrap(res)));
  }, [panelId, token]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await callServerApi(panelId, token, "GET", "/api/mail/encryption");
      if (!alive) return;
      setKeys(normEncryptionKeys(unwrap(res)));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [panelId, token]);

  const columns: ServerColumn<EncryptionKey>[] = useMemo(
    () => [
      { id: "name", header: e.colName, cell: (k) => k.name || "—", width: 150 },
      { id: "email", header: e.colEmail, cell: (k) => k.email || "—", width: 190 },
      { id: "keyId", header: e.colKeyId, cell: (k) => k.keyId, width: 150 },
      { id: "expires", header: e.colExpires, cell: (k) => (k.expiresAt ? fmtDate(k.expiresAt) : e.never), width: 150 },
    ],
    [e],
  );

  const rowActions: ServerRowAction[] = [{ id: "delete", label: e.rowDelete, icon: <TablerTrash size={18} />, danger: true }];

  const doDelete = async () => {
    if (!delTarget) return;
    setDelBusy(true);
    const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "DELETE", `/api/mail/encryption/keys/${enc(delTarget.keyId)}`));
    setDelBusy(false);
    if (out.ok) {
      await refresh();
      showToast(e.deleted);
    } else showToast(out.error ?? s.error, true);
    setDelTarget(null);
  };

  return (
    <View style={{ gap: 12 }}>
      <InfoBox>{e.intro}</InfoBox>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button label={e.newKey} size="sm" icon={<TablerPlus size={16} />} onPress={() => setCreateOpen(true)} style={{ flex: 1 }} />
        <Button label={e.importKey} size="sm" variant="secondary" icon={<TablerPlus size={16} />} onPress={() => setImportOpen(true)} style={{ flex: 1 }} />
      </View>
      <ServerDataTable
        title={s.secEncryption}
        columns={columns}
        rows={keys}
        rowKey={(k) => k.keyId}
        rowActions={rowActions}
        loading={loading}
        onRowAction={(_id, row) => setDelTarget(row)}
      />

      {createOpen ? (
        <CreateKeyDialog
          panelId={panelId}
          token={token}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            showToast(e.created);
            void refresh();
          }}
          onError={(msg) => showToast(msg ?? s.error, true)}
        />
      ) : null}

      {importOpen ? (
        <ImportKeyDialog
          panelId={panelId}
          token={token}
          onClose={() => setImportOpen(false)}
          onSaved={() => {
            setImportOpen(false);
            showToast(e.imported);
            void refresh();
          }}
          onError={(msg) => showToast(msg ?? s.error, true)}
        />
      ) : null}

      {delTarget ? (
        <ConfirmDialog
          visible
          title={e.deleteTitle}
          message={formatMessage(e.deleteMessage, { keyId: delTarget.keyId })}
          confirmLabel={e.deleteConfirm}
          cancelLabel={root.confirm.cancel}
          submitting={delBusy}
          onConfirm={doDelete}
          onCancel={() => setDelTarget(null)}
        />
      ) : null}
    </View>
  );
}

/** Generar una clave PGP (registro local). */
function CreateKeyDialog({ panelId, token, onClose, onSaved, onError }: { panelId: string; token: string; onClose: () => void; onSaved: () => void; onError: (msg?: string) => void }) {
  const language = loadSessionState().language;
  const e = getMessages(language).serverMail.settings.encryption;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [comment, setComment] = useState("");
  const [pass, setPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [keySize, setKeySize] = useState("2048");
  const [expValue, setExpValue] = useState("1");
  const [expUnit, setExpUnit] = useState("y");
  const [noExpire, setNoExpire] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (name.trim().length < 2) {
      throw new Error(e.errName);
    }
    if (!email.trim().includes("@")) {
      throw new Error(e.errEmail);
    }
    if (pass.length < 6) {
      throw new Error(e.errPassphrase);
    }
    if (pass !== confirmPass) {
      throw new Error(e.errPassphraseMatch);
    }
    setBusy(true);
    const payload = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      comment: comment.trim(),
      passphrase: pass,
      confirmPassphrase: confirmPass,
      expirationValue: Number(expValue) || 1,
      expirationUnit: expUnit,
      noExpire,
      keySize: Number(keySize),
    };
    const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "POST", "/api/mail/encryption/keys", payload));
    setBusy(false);
    if (out.ok) onSaved();
    else throw new Error(out.error ?? getMessages(language).common.error);
  };

  const keySizeOptions = [
    { value: "2048", label: "2048" },
    { value: "3072", label: "3072" },
    { value: "4096", label: "4096" },
  ];
  const unitOptions = [
    { value: "d", label: e.unitDays },
    { value: "w", label: e.unitWeeks },
    { value: "m", label: e.unitMonths },
    { value: "y", label: e.unitYears },
  ];

  return (
    <FormDrawer
      visible
      onClose={onClose}
      title={e.createTitle}
      language={language}
      footer={<DialogFooter onCancel={onClose} cancelLabel={e.cancel} onSubmit={submit} submitLabel={e.create} submitting={busy} disabled={!name.trim() || !email.trim()} />}
    >
      <Field label={e.labelName}>
        <Input value={name} onChangeText={setName} placeholder={e.placeholderName} />
      </Field>
      <Field label={e.labelEmail}>
        <Input value={email} onChangeText={setEmail} placeholder={e.placeholderEmail} autoCapitalize="none" keyboardType="email-address" />
      </Field>
      <Field label={e.labelComment}>
        <Input value={comment} onChangeText={setComment} placeholder={e.placeholderComment} />
      </Field>
      <Field label={e.labelPassphrase}>
        <Input value={pass} onChangeText={setPass} secureTextEntry secureToggle autoCapitalize="none" />
      </Field>
      <Field label={e.labelConfirmPassphrase}>
        <Input value={confirmPass} onChangeText={setConfirmPass} secureTextEntry secureToggle autoCapitalize="none" />
      </Field>
      <Field label={e.labelKeySize}>
        <Select value={keySize} options={keySizeOptions} onChange={setKeySize} />
      </Field>
      <Checkbox value={noExpire} onChange={setNoExpire} label={e.noExpire} />
      {!noExpire ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label={e.expirationValue}>
              <Input value={expValue} onChangeText={setExpValue} keyboardType="number-pad" placeholder="1" />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label={e.expirationUnit}>
              <Select value={expUnit} options={unitOptions} onChange={setExpUnit} />
            </Field>
          </View>
        </View>
      ) : null}
    </FormDrawer>
  );
}

/** Importar una clave pública PGP (formato ASCII armor). */
function ImportKeyDialog({ panelId, token, onClose, onSaved, onError }: { panelId: string; token: string; onClose: () => void; onSaved: () => void; onError: (msg?: string) => void }) {
  const language = loadSessionState().language;
  const e = getMessages(language).serverMail.settings.encryption;
  const [armored, setArmored] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (armored.trim().length < 20) {
      throw new Error(e.errArmored);
    }
    setBusy(true);
    const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "POST", "/api/mail/encryption/import", { armoredPublicKey: armored.trim() }));
    setBusy(false);
    if (out.ok) onSaved();
    else throw new Error(out.error ?? getMessages(language).common.error);
  };

  return (
    <FormDrawer
      visible
      onClose={onClose}
      title={e.importTitle}
      language={language}
      footer={<DialogFooter onCancel={onClose} cancelLabel={e.cancel} onSubmit={submit} submitLabel={e.import} submitting={busy} disabled={armored.trim().length < 20} />}
    >
      <Field label={e.labelArmored}>
        <Input value={armored} onChangeText={setArmored} multiline style={{ minHeight: 140 }} placeholder={e.placeholderArmored} autoCapitalize="none" />
      </Field>
    </FormDrawer>
  );
}

/** Filtros globales (afectan a todas las cuentas) — reutiliza FilterDialog. */
function GlobalFiltersForm({ panelId, token, showToast }: { panelId: string; token: string; showToast: ShowToast }) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const root = getMessages(language).serverMail;
  const s = root.settings;
  const g = s.globalFilters;
  const [filters, setFilters] = useState<MailFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ mode: "create" | "edit"; row?: MailFilter } | null>(null);
  const [delTarget, setDelTarget] = useState<MailFilter | null>(null);
  const [delBusy, setDelBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await callServerApi(panelId, token, "GET", "/api/mail/global-filters");
    setFilters(normFilters(unwrap(res)));
  }, [panelId, token]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await callServerApi(panelId, token, "GET", "/api/mail/global-filters");
      if (!alive) return;
      setFilters(normFilters(unwrap(res)));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [panelId, token]);

  const enabledPill = (on: boolean) => {
    const c = pillColors(tokens, on ? "ok" : "neutral");
    return (
      <View style={{ alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: c.bg, borderColor: c.border }}>
        <Text style={{ color: c.text, fontSize: 11 }}>{on ? g.enabled : "—"}</Text>
      </View>
    );
  };

  const columns: ServerColumn<MailFilter>[] = useMemo(
    () => [
      { id: "name", header: g.colName, cell: (f) => f.name, sortable: true, sortValue: (f) => f.name, width: 180 },
      { id: "rules", header: g.colRules, cell: (f) => String((f.rules ?? []).length), width: 110 },
      { id: "status", header: g.colStatus, cell: (f) => enabledPill(f.enabled !== false), width: 100 },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [g, tokens],
  );

  const rowActions: ServerRowAction[] = [
    { id: "edit", label: g.rowEdit, icon: <TablerEdit size={18} /> },
    { id: "delete", label: g.rowDelete, icon: <TablerTrash size={18} />, danger: true },
  ];

  const doDelete = async () => {
    if (!delTarget) return;
    setDelBusy(true);
    const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "DELETE", `/api/mail/global-filters/${enc(String(delTarget.id))}`));
    setDelBusy(false);
    if (out.ok) {
      await refresh();
      showToast(g.deleted);
    } else showToast(out.error ?? s.error, true);
    setDelTarget(null);
  };

  return (
    <View style={{ gap: 12 }}>
      <InfoBox>{g.intro}</InfoBox>
      <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
        <Button label={g.new} size="sm" icon={<TablerPlus size={16} />} onPress={() => setDialog({ mode: "create" })} />
      </View>
      <ServerDataTable
        title={g.title}
        columns={columns}
        rows={filters}
        rowKey={(f) => String(f.id)}
        rowActions={rowActions}
        loading={loading}
        onRowAction={(id, row) => (id === "edit" ? setDialog({ mode: "edit", row }) : setDelTarget(row))}
      />

      {dialog ? (
        <FilterDialog
          panelId={panelId}
          token={token}
          accountId=""
          mode={dialog.mode}
          row={dialog.row}
          onClose={() => setDialog(null)}
          customSubmit={(payload) =>
            dialog.mode === "edit" && dialog.row
              ? callServerApi(panelId, token, "PUT", `/api/mail/global-filters/${enc(String(dialog.row.id))}`, payload)
              : callServerApi(panelId, token, "POST", "/api/mail/global-filters", payload)
          }
          onSaved={(created) => {
            setDialog(null);
            showToast(created ? g.created : g.updated);
            void refresh();
          }}
          onError={(msg) => showToast(msg ?? s.error, true)}
        />
      ) : null}

      {delTarget ? (
        <ConfirmDialog
          visible
          title={g.deleteTitle}
          message={formatMessage(g.deleteMessage, { name: delTarget.name })}
          confirmLabel={g.deleteConfirm}
          cancelLabel={root.confirm.cancel}
          submitting={delBusy}
          onConfirm={doDelete}
          onCancel={() => setDelTarget(null)}
        />
      ) : null}
    </View>
  );
}
