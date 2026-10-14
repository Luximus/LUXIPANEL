/**
 * mail-settings (desktop) — ajustes de correo a nivel dominio/servidor del
 * módulo Correo: filtro de spam (SpamAssassin), enrutamiento por dominio,
 * reenvíos catch-all, dirección por defecto, archivado/retención, cifrado PGP y
 * filtros globales. Port React DOM de `MailSettingsScreen` + sus formularios de
 * `app/src/screens/server/mail/MailScreen.tsx`. Reutiliza `FilterDialog` de
 * `mail-manage` para los filtros globales.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import DataTable, { type DataTableColumnConfig } from "../../../components/DataTable";
import { useConfirm } from "../../../components/ConfirmDialog";
import { useToast } from "../../../components/ToastProvider";
import { callServerApi, unwrap } from "../../../api/serverApi";
import { formatMessage, getMessages } from "../../../i18n";
import { ROUTING_MODES, SPAM_SCORE_PRESETS, RETENTION_OPTIONS } from "./mail-constants";
import { fmtDate } from "./mail-format";
import {
  normDomains,
  normSpam,
  normRouting,
  normDomainForwards,
  normDefaultAddress,
  normArchive,
  normEncryptionKeys,
  normFilters,
} from "./mail-normalizers";
import type {
  SpamSettings,
  RoutingMode,
  DomainForwardEntry,
  DefaultRule,
  ArchiveFlags,
  ArchiveSettings,
  EncryptionKey,
  MailFilter,
} from "./mail-types";
import {
  Modal,
  DialogFooter,
  Field,
  TextInput,
  TextArea,
  SelectInput,
  CheckboxRow,
  InfoBox,
  Pill,
  SegTabs,
  SettingsSkeleton,
  StringListEditor,
  CurrentMap,
  runServerMutation,
} from "./mail-ui";
import { FilterDialog } from "./mail-manage";

const enc = encodeURIComponent;
type ShowToast = (message: string, err?: boolean) => void;
type SectionKey = "spam" | "routing" | "forwards" | "default" | "archive" | "encryption" | "globalFilters";

function SaveButton({ label, onClick, busy, disabled }: { label: string; onClick: () => void; busy: boolean; disabled?: boolean }) {
  return (
    <button type="button" className="btn btn-primary btn-sm w-fit gap-1.5" onClick={onClick} disabled={busy || disabled}>
      {busy ? <span className="loading loading-spinner loading-xs" /> : <Save size={14} />} {label}
    </button>
  );
}

export function MailSettingsScreen({ serverId, language }: { serverId: string; language?: string }) {
  const s = getMessages(language).serverMail.settings;
  const toast = useToast();
  const showToast: ShowToast = useCallback((msg, err) => (err ? toast.error(msg) : toast.success(msg)), [toast]);
  const [section, setSection] = useState<SectionKey>("spam");
  const [domains, setDomains] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await callServerApi(serverId, "", "GET", "/api/accounts/domains");
      if (alive) setDomains(normDomains(unwrap(res)));
    })();
    return () => {
      alive = false;
    };
  }, [serverId]);

  const items: { key: SectionKey; label: string }[] = [
    { key: "spam", label: s.secSpam },
    { key: "routing", label: s.secRouting },
    { key: "forwards", label: s.secForwards },
    { key: "default", label: s.secDefault },
    { key: "archive", label: s.secArchive },
    { key: "encryption", label: s.secEncryption },
    { key: "globalFilters", label: s.secGlobalFilters },
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <InfoBox>{s.subtitle}</InfoBox>
      <SegTabs items={items} value={section} onChange={setSection} />
      {section === "spam" ? (
        <SpamForm serverId={serverId} language={language} showToast={showToast} />
      ) : section === "routing" ? (
        <RoutingForm serverId={serverId} language={language} domains={domains} showToast={showToast} />
      ) : section === "forwards" ? (
        <DomainForwardsForm serverId={serverId} language={language} showToast={showToast} />
      ) : section === "default" ? (
        <DefaultAddressForm serverId={serverId} language={language} domains={domains} showToast={showToast} />
      ) : section === "archive" ? (
        <ArchiveForm serverId={serverId} language={language} domains={domains} showToast={showToast} />
      ) : section === "encryption" ? (
        <EncryptionForm serverId={serverId} language={language} showToast={showToast} />
      ) : (
        <GlobalFiltersForm serverId={serverId} language={language} showToast={showToast} />
      )}
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 rounded-xl border border-base-300 bg-base-100 p-4">{children}</div>;
}

// ── Spam ─────────────────────────────────────────────────────────────────────
function SpamForm({ serverId, language, showToast }: { serverId: string; language?: string; showToast: ShowToast }) {
  const s = getMessages(language).serverMail.settings;
  const sp = s.spam;
  const [data, setData] = useState<SpamSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await callServerApi(serverId, "", "GET", "/api/mail/spam-filters");
      if (!alive) return;
      setData(normSpam(unwrap(res)));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [serverId]);

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
    const out = await runServerMutation(serverId, () => callServerApi(serverId, "", "PUT", "/api/mail/spam-filters", payload));
    setBusy(false);
    if (out.ok) {
      const fresh = await callServerApi(serverId, "", "GET", "/api/mail/spam-filters");
      setData(normSpam(unwrap(fresh)));
      showToast(s.saved);
    } else showToast(out.error ?? s.error, true);
  };

  if (loading || !data) return <SettingsSkeleton />;
  const scoreOptions = SPAM_SCORE_PRESETS.map((v) => ({ value: v, label: v === "custom" ? sp.scoreCustom : v }));

  return (
    <Card>
      <InfoBox>{sp.intro}</InfoBox>
      <CheckboxRow checked={data.enabled} onChange={(v) => patch({ enabled: v })} label={sp.enabled} />
      <CheckboxRow checked={data.spamBoxEnabled} onChange={(v) => patch({ spamBoxEnabled: v })} label={sp.spamBox} />
      <CheckboxRow checked={data.autoDeleteEnabled} onChange={(v) => patch({ autoDeleteEnabled: v })} label={sp.autoDelete} />
      <Field label={sp.requiredScore} hint={sp.scoreNote}>
        <SelectInput value={data.requiredScoreSelect} options={scoreOptions} onChange={(v) => patch({ requiredScoreSelect: v })} />
      </Field>
      {data.requiredScoreSelect === "custom" ? (
        <Field label={sp.customScore}>
          <TextInput value={String(data.customRequiredScore ?? "")} onChange={(v) => patch({ customRequiredScore: Number(v) || 0 })} type="number" placeholder="5" />
        </Field>
      ) : null}
      {data.autoDeleteEnabled ? (
        <Field label={sp.autoDeleteThreshold}>
          <TextInput value={String(data.autoDeleteThresholdScore)} onChange={(v) => patch({ autoDeleteThresholdScore: Number(v) || 0 })} type="number" placeholder="5" />
        </Field>
      ) : null}
      <Field label={sp.whitelist} hint={sp.whitelistHint}>
        <StringListEditor items={data.whitelistFrom} onChange={(v) => patch({ whitelistFrom: v })} placeholder={sp.addressPlaceholder} addLabel={sp.addAddress} />
      </Field>
      <Field label={sp.blacklist} hint={sp.blacklistHint}>
        <StringListEditor items={data.blacklistFrom} onChange={(v) => patch({ blacklistFrom: v })} placeholder={sp.addressPlaceholder} addLabel={sp.addAddress} />
      </Field>
      <SaveButton label={s.save} onClick={() => void save()} busy={busy} />
    </Card>
  );
}

// ── Enrutamiento por dominio ─────────────────────────────────────────────────
function RoutingForm({ serverId, language, domains, showToast }: { serverId: string; language?: string; domains: string[]; showToast: ShowToast }) {
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
      const res = await callServerApi(serverId, "", "GET", "/api/mail/domain-routing");
      if (!alive) return;
      setMap(normRouting(unwrap(res)));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [serverId]);

  useEffect(() => {
    if (domain && map[domain]) setMode(map[domain]);
  }, [domain, map]);

  const save = async () => {
    if (!domain) return showToast(s.selectDomain, true);
    setBusy(true);
    const out = await runServerMutation(serverId, () => callServerApi(serverId, "", "PUT", "/api/mail/domain-routing", { domain, mode }));
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
    <Card>
      <InfoBox>{r.intro}</InfoBox>
      <Field label={s.domain}>
        <SelectInput value={domain} options={domainOptions} placeholder={s.selectDomain} onChange={setDomain} />
      </Field>
      <Field label={r.mode}>
        <SelectInput value={mode} options={modeOptions} onChange={(v) => setMode(v as RoutingMode)} />
      </Field>
      <SaveButton label={s.save} onClick={() => void save()} busy={busy} disabled={!domain} />
      <CurrentMap title={s.current} empty={s.none} rows={Object.entries(map).map(([d, mm]) => ({ key: d, label: d, value: r.modes[mm] }))} />
    </Card>
  );
}

// ── Reenvíos de dominio (catch-all) ──────────────────────────────────────────
function DomainForwardsForm({ serverId, language, showToast }: { serverId: string; language?: string; showToast: ShowToast }) {
  const s = getMessages(language).serverMail.settings;
  const fw = s.forwards;
  const [entries, setEntries] = useState<DomainForwardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await callServerApi(serverId, "", "GET", "/api/mail/domain-forwards");
      if (!alive) return;
      setEntries(normDomainForwards(unwrap(res)));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [serverId]);

  const save = async () => {
    const clean = entries
      .map((e) => ({ domain: e.domain.trim().toLowerCase(), destinations: e.destinations.map((d) => d.trim().toLowerCase()).filter(Boolean) }))
      .filter((e) => e.domain && e.destinations.length);
    setBusy(true);
    const out = await runServerMutation(serverId, () => callServerApi(serverId, "", "PUT", "/api/mail/domain-forwards", { entries: clean }));
    setBusy(false);
    if (out.ok) {
      const fresh = await callServerApi(serverId, "", "GET", "/api/mail/domain-forwards");
      setEntries(normDomainForwards(unwrap(fresh)));
      showToast(s.saved);
    } else showToast(out.error ?? s.error, true);
  };

  if (loading) return <SettingsSkeleton />;

  return (
    <Card>
      <InfoBox>{fw.intro}</InfoBox>
      {entries.length === 0 ? <p className="text-xs text-base-content/50">{fw.empty}</p> : null}
      {entries.map((entry, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg border border-base-300 p-2.5">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <TextInput value={entry.domain} onChange={(v) => setEntries((prev) => prev.map((x, j) => (j === i ? { ...x, domain: v } : x)))} placeholder={fw.labelDomain} />
            </div>
            <button type="button" className="btn btn-ghost btn-sm btn-square text-error" onClick={() => setEntries((prev) => prev.filter((_, j) => j !== i))}>
              <Trash2 size={16} />
            </button>
          </div>
          <span className="text-[11px] font-semibold text-base-content/50">{fw.destinations}</span>
          <StringListEditor items={entry.destinations} onChange={(v) => setEntries((prev) => prev.map((x, j) => (j === i ? { ...x, destinations: v } : x)))} placeholder={fw.destinationPlaceholder} addLabel={fw.addDestination} />
        </div>
      ))}
      <button type="button" className="btn btn-outline btn-sm w-fit gap-1" onClick={() => setEntries((prev) => [...prev, { domain: "", destinations: [] }])}>
        <Plus size={14} /> {fw.addEntry}
      </button>
      <SaveButton label={s.save} onClick={() => void save()} busy={busy} />
    </Card>
  );
}

// ── Dirección por defecto ────────────────────────────────────────────────────
function DefaultAddressForm({ serverId, language, domains, showToast }: { serverId: string; language?: string; domains: string[]; showToast: ShowToast }) {
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
      const res = await callServerApi(serverId, "", "GET", "/api/mail/default-address");
      if (!alive) return;
      setMap(normDefaultAddress(unwrap(res)));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [serverId]);

  useEffect(() => {
    const rule = domain ? map[domain] : undefined;
    if (rule) {
      setMode(rule.mode);
      setFailureMessage(rule.failureMessage);
      setForwardTo(rule.forwardTo);
    }
  }, [domain, map]);

  const save = async () => {
    if (!domain) return showToast(s.selectDomain, true);
    if (mode === "forward" && !forwardTo.trim()) return showToast(da.errForward, true);
    setBusy(true);
    const payload =
      mode === "forward"
        ? { domain, mode, forwardTo: forwardTo.trim().toLowerCase() }
        : { domain, mode, failureMessage: failureMessage.trim() || "No Such User Here" };
    const out = await runServerMutation(serverId, () => callServerApi(serverId, "", "PUT", "/api/mail/default-address", payload));
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
    <Card>
      <InfoBox>{da.intro}</InfoBox>
      <Field label={s.domain}>
        <SelectInput value={domain} options={domainOptions} placeholder={s.selectDomain} onChange={setDomain} />
      </Field>
      <Field label={da.mode}>
        <SelectInput value={mode} options={modeOptions} onChange={(v) => setMode(v === "forward" ? "forward" : "fail")} />
      </Field>
      {mode === "forward" ? (
        <Field label={da.forwardTo}>
          <TextInput value={forwardTo} onChange={setForwardTo} placeholder={da.forwardPlaceholder} />
        </Field>
      ) : (
        <Field label={da.failureMessage}>
          <TextInput value={failureMessage} onChange={setFailureMessage} placeholder={da.failurePlaceholder} />
        </Field>
      )}
      <SaveButton label={s.save} onClick={() => void save()} busy={busy} disabled={!domain} />
      <CurrentMap
        title={s.current}
        empty={s.none}
        rows={Object.entries(map).map(([d, rule]) => ({ key: d, label: d, value: rule.mode === "forward" ? `${da.modeForward} → ${rule.forwardTo}` : da.modeFail }))}
      />
    </Card>
  );
}

// ── Archivado / retención ────────────────────────────────────────────────────
function ArchiveForm({ serverId, language, domains, showToast }: { serverId: string; language?: string; domains: string[]; showToast: ShowToast }) {
  const s = getMessages(language).serverMail.settings;
  const a = s.archive;
  const [data, setData] = useState<ArchiveSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyDefaults, setBusyDefaults] = useState(false);
  const [busyDomain, setBusyDomain] = useState(false);
  const [domain, setDomain] = useState("");
  const [dIncoming, setDIncoming] = useState(false);
  const [dOutgoing, setDOutgoing] = useState(false);
  const [dList, setDList] = useState(false);
  const [retention, setRetention] = useState("0");
  const [customDays, setCustomDays] = useState("30");

  const refresh = useCallback(async () => {
    const res = await callServerApi(serverId, "", "GET", "/api/mail/archive");
    setData(normArchive(unwrap(res)));
  }, [serverId]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await callServerApi(serverId, "", "GET", "/api/mail/archive");
      if (!alive) return;
      setData(normArchive(unwrap(res)));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [serverId]);

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
    const out = await runServerMutation(serverId, () =>
      callServerApi(serverId, "", "PUT", "/api/mail/archive/defaults", {
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
    if (!domain) return showToast(s.selectDomain, true);
    setBusyDomain(true);
    const payload: Record<string, unknown> = {
      domain,
      incoming: dIncoming,
      outgoingMailingList: dList,
      outgoing: dOutgoing,
      retentionDays: retention === "custom" ? "custom" : Number(retention),
    };
    if (retention === "custom") payload.customRetentionDays = Number(customDays) || 1;
    const out = await runServerMutation(serverId, () => callServerApi(serverId, "", "PUT", "/api/mail/archive/domain", payload));
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
    <Card>
      <InfoBox>{a.intro}</InfoBox>
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-bold">{a.defaultsTitle}</span>
        <span className="text-[11px] text-base-content/50">{a.defaultsHint}</span>
      </div>
      <CheckboxRow checked={data.defaults.incoming} onChange={(v) => patchDefault({ incoming: v })} label={a.incoming} />
      <CheckboxRow checked={data.defaults.outgoing} onChange={(v) => patchDefault({ outgoing: v })} label={a.outgoing} />
      <CheckboxRow checked={data.defaults.outgoingMailingList} onChange={(v) => patchDefault({ outgoingMailingList: v })} label={a.outgoingMailingList} />
      <SaveButton label={a.saveDefaults} onClick={() => void saveDefaults()} busy={busyDefaults} />

      <div className="my-1 h-px bg-base-300" />
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-bold">{a.domainTitle}</span>
        <span className="text-[11px] text-base-content/50">{a.domainHint}</span>
      </div>
      {!domains.length ? (
        <InfoBox tone="warn">{s.noDomains}</InfoBox>
      ) : (
        <>
          <Field label={s.domain}>
            <SelectInput value={domain} options={domains.map((d) => ({ value: d, label: d }))} placeholder={s.selectDomain} onChange={setDomain} />
          </Field>
          <CheckboxRow checked={dIncoming} onChange={setDIncoming} label={a.incoming} />
          <CheckboxRow checked={dOutgoing} onChange={setDOutgoing} label={a.outgoing} />
          <CheckboxRow checked={dList} onChange={setDList} label={a.outgoingMailingList} />
          <Field label={a.retention}>
            <SelectInput value={retention} options={retentionOptions} onChange={setRetention} />
          </Field>
          {retention === "custom" ? (
            <Field label={a.customDays}>
              <TextInput value={customDays} onChange={setCustomDays} type="number" placeholder="30" />
            </Field>
          ) : null}
          <SaveButton label={a.saveDomain} onClick={() => void saveDomain()} busy={busyDomain} disabled={!domain} />
        </>
      )}
      <CurrentMap title={a.currentTitle} empty={a.currentEmpty} rows={domainRows} />
    </Card>
  );
}

// ── Cifrado PGP ──────────────────────────────────────────────────────────────
type EncKeyRow = { id: string; name: string; email: string; keyId: string; expires: string; raw: EncryptionKey };

function EncryptionForm({ serverId, language, showToast }: { serverId: string; language?: string; showToast: ShowToast }) {
  const root = getMessages(language).serverMail;
  const s = root.settings;
  const e = s.encryption;
  const { confirm, dialog } = useConfirm();
  const [keys, setKeys] = useState<EncryptionKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const refresh = useCallback(async () => {
    const res = await callServerApi(serverId, "", "GET", "/api/mail/encryption");
    setKeys(normEncryptionKeys(unwrap(res)));
  }, [serverId]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await callServerApi(serverId, "", "GET", "/api/mail/encryption");
      if (!alive) return;
      setKeys(normEncryptionKeys(unwrap(res)));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [serverId]);

  const rows = useMemo<EncKeyRow[]>(
    () => keys.map((k) => ({ id: k.keyId, name: k.name || "—", email: k.email || "—", keyId: k.keyId, expires: k.expiresAt ? fmtDate(k.expiresAt) : e.never, raw: k })),
    [keys, e],
  );
  const columns = useMemo<DataTableColumnConfig<EncKeyRow>[]>(
    () => [
      { id: "name", header: e.colName, accessorKey: "name" },
      { id: "email", header: e.colEmail, accessorKey: "email" },
      { id: "keyId", header: e.colKeyId, accessorKey: "keyId", cell: (k) => <span className="font-mono text-xs">{k.keyId}</span> },
      { id: "expires", header: e.colExpires, accessorKey: "expires" },
    ],
    [e],
  );

  const doDelete = async (row: EncKeyRow) => {
    const ok = await confirm({ title: e.deleteTitle, message: formatMessage(e.deleteMessage, { keyId: row.keyId }), confirmLabel: e.deleteConfirm, cancelLabel: root.confirm.cancel, danger: true });
    if (!ok) return;
    const out = await runServerMutation(serverId, () => callServerApi(serverId, "", "DELETE", `/api/mail/encryption/keys/${enc(row.keyId)}`));
    if (out.ok) {
      await refresh();
      showToast(e.deleted);
    } else showToast(out.error ?? s.error, true);
  };

  return (
    <Card>
      <InfoBox>{e.intro}</InfoBox>
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary btn-sm gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> {e.newKey}
        </button>
        <button type="button" className="btn btn-outline btn-sm gap-1.5" onClick={() => setImportOpen(true)}>
          <Plus size={14} /> {e.importKey}
        </button>
      </div>
      <DataTable<EncKeyRow>
        tableId="mail-encryption-keys"
        title={s.secEncryption}
        data={rows}
        columns={columns}
        rowActions={[{ id: "delete", label: e.rowDelete, variant: "danger" }]}
        language={language}
        loading={loading}
        onRowAction={(_id, row) => void doDelete(row)}
      />

      {createOpen ? (
        <CreateKeyDialog
          serverId={serverId}
          language={language}
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
          serverId={serverId}
          language={language}
          onClose={() => setImportOpen(false)}
          onSaved={() => {
            setImportOpen(false);
            showToast(e.imported);
            void refresh();
          }}
          onError={(msg) => showToast(msg ?? s.error, true)}
        />
      ) : null}

      {dialog}
    </Card>
  );
}

function CreateKeyDialog({ serverId, language, onClose, onSaved, onError }: { serverId: string; language?: string; onClose: () => void; onSaved: () => void; onError: (msg?: string) => void }) {
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
    if (name.trim().length < 2) return onError(e.errName);
    if (!email.trim().includes("@")) return onError(e.errEmail);
    if (pass.length < 6) return onError(e.errPassphrase);
    if (pass !== confirmPass) return onError(e.errPassphraseMatch);
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
    const out = await runServerMutation(serverId, () => callServerApi(serverId, "", "POST", "/api/mail/encryption/keys", payload));
    setBusy(false);
    if (out.ok) onSaved();
    else onError(out.error);
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
    <Modal
      title={e.createTitle}
      onClose={onClose}
      footer={<DialogFooter onCancel={onClose} cancelLabel={e.cancel} onSubmit={() => void submit()} submitLabel={e.create} submitting={busy} disabled={!name.trim() || !email.trim()} />}
    >
      <Field label={e.labelName}>
        <TextInput value={name} onChange={setName} placeholder={e.placeholderName} />
      </Field>
      <Field label={e.labelEmail}>
        <TextInput value={email} onChange={setEmail} placeholder={e.placeholderEmail} />
      </Field>
      <Field label={e.labelComment}>
        <TextInput value={comment} onChange={setComment} placeholder={e.placeholderComment} />
      </Field>
      <Field label={e.labelPassphrase}>
        <TextInput value={pass} onChange={setPass} type="password" />
      </Field>
      <Field label={e.labelConfirmPassphrase}>
        <TextInput value={confirmPass} onChange={setConfirmPass} type="password" />
      </Field>
      <Field label={e.labelKeySize}>
        <SelectInput value={keySize} options={keySizeOptions} onChange={setKeySize} />
      </Field>
      <CheckboxRow checked={noExpire} onChange={setNoExpire} label={e.noExpire} />
      {!noExpire ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label={e.expirationValue}>
            <TextInput value={expValue} onChange={setExpValue} type="number" placeholder="1" />
          </Field>
          <Field label={e.expirationUnit}>
            <SelectInput value={expUnit} options={unitOptions} onChange={setExpUnit} />
          </Field>
        </div>
      ) : null}
    </Modal>
  );
}

function ImportKeyDialog({ serverId, language, onClose, onSaved, onError }: { serverId: string; language?: string; onClose: () => void; onSaved: () => void; onError: (msg?: string) => void }) {
  const e = getMessages(language).serverMail.settings.encryption;
  const [armored, setArmored] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (armored.trim().length < 20) return onError(e.errArmored);
    setBusy(true);
    const out = await runServerMutation(serverId, () => callServerApi(serverId, "", "POST", "/api/mail/encryption/import", { armoredPublicKey: armored.trim() }));
    setBusy(false);
    if (out.ok) onSaved();
    else onError(out.error);
  };

  return (
    <Modal
      title={e.importTitle}
      onClose={onClose}
      footer={<DialogFooter onCancel={onClose} cancelLabel={e.cancel} onSubmit={() => void submit()} submitLabel={e.import} submitting={busy} disabled={armored.trim().length < 20} />}
    >
      <Field label={e.labelArmored}>
        <TextArea value={armored} onChange={setArmored} placeholder={e.placeholderArmored} rows={7} mono />
      </Field>
    </Modal>
  );
}

// ── Filtros globales ─────────────────────────────────────────────────────────
type GlobalFilterRow = { id: string; name: string; rules: number; enabled: boolean; raw: MailFilter };

function GlobalFiltersForm({ serverId, language, showToast }: { serverId: string; language?: string; showToast: ShowToast }) {
  const root = getMessages(language).serverMail;
  const s = root.settings;
  const g = s.globalFilters;
  const { confirm, dialog } = useConfirm();
  const [filters, setFilters] = useState<MailFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<{ mode: "create" | "edit"; row?: MailFilter } | null>(null);

  const refresh = useCallback(async () => {
    const res = await callServerApi(serverId, "", "GET", "/api/mail/global-filters");
    setFilters(normFilters(unwrap(res)));
  }, [serverId]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await callServerApi(serverId, "", "GET", "/api/mail/global-filters");
      if (!alive) return;
      setFilters(normFilters(unwrap(res)));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [serverId]);

  const rows = useMemo<GlobalFilterRow[]>(
    () => filters.map((f) => ({ id: String(f.id), name: f.name, rules: (f.rules ?? []).length, enabled: f.enabled !== false, raw: f })),
    [filters],
  );
  const columns = useMemo<DataTableColumnConfig<GlobalFilterRow>[]>(
    () => [
      { id: "name", header: g.colName, accessorKey: "name", sortable: true },
      { id: "rules", header: g.colRules, accessorKey: "rules" },
      { id: "status", header: g.colStatus, accessorKey: "enabled", cell: (f) => (f.enabled ? <Pill tone="ok">{g.enabled}</Pill> : <span className="text-base-content/40">—</span>) },
    ],
    [g],
  );

  const doDelete = async (row: GlobalFilterRow) => {
    const ok = await confirm({ title: g.deleteTitle, message: formatMessage(g.deleteMessage, { name: row.name }), confirmLabel: g.deleteConfirm, cancelLabel: root.confirm.cancel, danger: true });
    if (!ok) return;
    const out = await runServerMutation(serverId, () => callServerApi(serverId, "", "DELETE", `/api/mail/global-filters/${enc(String(row.id))}`));
    if (out.ok) {
      await refresh();
      showToast(g.deleted);
    } else showToast(out.error ?? s.error, true);
  };

  return (
    <Card>
      <InfoBox>{g.intro}</InfoBox>
      <div className="flex justify-end">
        <button type="button" className="btn btn-primary btn-sm gap-1.5" onClick={() => setEditor({ mode: "create" })}>
          <Plus size={14} /> {g.new}
        </button>
      </div>
      <DataTable<GlobalFilterRow>
        tableId="mail-global-filters"
        title={g.title}
        data={rows}
        columns={columns}
        rowActions={[
          { id: "edit", label: g.rowEdit },
          { id: "delete", label: g.rowDelete, variant: "danger" },
        ]}
        language={language}
        loading={loading}
        onRowAction={(id, row) => (id === "edit" ? setEditor({ mode: "edit", row: row.raw }) : void doDelete(row))}
      />

      {editor ? (
        <FilterDialog
          serverId={serverId}
          accountId=""
          language={language}
          mode={editor.mode}
          row={editor.row}
          onClose={() => setEditor(null)}
          customSubmit={(payload) =>
            editor.mode === "edit" && editor.row
              ? callServerApi(serverId, "", "PUT", `/api/mail/global-filters/${enc(String(editor.row.id))}`, payload)
              : callServerApi(serverId, "", "POST", "/api/mail/global-filters", payload)
          }
          onSaved={(created) => {
            setEditor(null);
            showToast(created ? g.created : g.updated);
            void refresh();
          }}
          onError={(msg) => showToast(msg ?? s.error, true)}
        />
      ) : null}

      {dialog}
    </Card>
  );
}
