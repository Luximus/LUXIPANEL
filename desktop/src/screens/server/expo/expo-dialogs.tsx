/**
 * expo-dialogs (desktop) — diálogos del módulo Expo, extraídos de
 * `ExpoModule.tsx` (espejo de `app/src/screens/server/expo/expo-dialogs.tsx`):
 * lanzar build, CRUD de variables de entorno, submit a tienda, OTA update,
 * dev-client, credenciales de tienda (Google/Apple), webhook y registro de
 * dispositivo. Mismo contrato que la app (`serverExpoApi`/`callServerApi`,
 * token `""` en modo directo); mutaciones vía `runServerMutation`.
 */
import { useCallback, useEffect, useState } from "react";
import { Loader2, Play, Smartphone, Square } from "lucide-react";
import { callServerApi, serverExpoApi, unwrap } from "../../../api/serverApi";
import { getMessages } from "../../../i18n";
import {
  DialogFooter,
  ENV_TARGETS,
  Field,
  GUARDS,
  InfoBox,
  ModalShell,
  runServerMutation,
  UrlBlock,
  VISIBILITIES,
  type DevClientSession,
  type ExpoCliResult,
  type ExpoEnvVar,
  type ExpoProject,
} from "./expo-shared";

export function BuildDialog({
  serverId,
  path,
  language,
  onClose,
  onLaunched,
  onError,
}: {
  serverId: string;
  path: string;
  language?: string;
  onClose: () => void;
  onLaunched: () => void;
  onError: () => void;
}) {
  const t = getMessages(language).serverExpo;
  const [platform, setPlatform] = useState("android");
  const [profile, setProfile] = useState("production");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const out = await runServerMutation(serverId, () => serverExpoApi.build(serverId, "", { path, platform, profile }));
    setBusy(false);
    if (out.ok) onLaunched();
    else onError();
  };

  return (
    <ModalShell
      title={t.buildDialog.title}
      onClose={onClose}
      closeLabel={t.buildDialog.cancel}
      footer={<DialogFooter onCancel={onClose} cancelLabel={t.buildDialog.cancel} onSubmit={() => void submit()} submitLabel={t.buildDialog.launch} submitting={busy} />}
    >
      <Field label={t.buildDialog.platform}>
        <select className="select select-bordered select-sm w-full" value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="android">{t.buildDialog.android}</option>
          <option value="ios">{t.buildDialog.ios}</option>
          <option value="all">{t.buildDialog.all}</option>
        </select>
      </Field>
      <Field label={t.buildDialog.profile}>
        <select className="select select-bordered select-sm w-full" value={profile} onChange={(e) => setProfile(e.target.value)}>
          <option value="development">{t.buildDialog.profileDev}</option>
          <option value="preview">{t.buildDialog.profilePreview}</option>
          <option value="production">{t.buildDialog.profileProd}</option>
        </select>
      </Field>
    </ModalShell>
  );
}

export function EnvDialog({
  serverId,
  project,
  mode,
  row,
  language,
  onClose,
  onSaved,
  onToast,
}: {
  serverId: string;
  project: ExpoProject;
  mode: "create" | "edit";
  row?: ExpoEnvVar;
  language?: string;
  onClose: () => void;
  onSaved: (updated: boolean) => void;
  onToast: (m: string, e?: boolean) => void;
}) {
  const t = getMessages(language).serverExpo;
  const isEdit = mode === "edit";

  const [name, setName] = useState(row?.name ?? "");
  const [value, setValue] = useState(row?.value ?? "");
  const [visibility, setVisibility] = useState<string>(() => {
    const raw = row?.visibility === "public" ? "plaintext" : (row?.visibility ?? "plaintext");
    return (VISIBILITIES as readonly string[]).includes(raw) ? raw : "plaintext";
  });
  const [environments, setEnvironments] = useState<string[]>(
    row?.environments && row.environments.length > 0 ? row.environments : ["production"],
  );
  const [busy, setBusy] = useState(false);

  const toggleEnv = (target: string) =>
    setEnvironments((prev) => (prev.includes(target) ? prev.filter((x) => x !== target) : [...prev, target]));

  const valueIsMasked = isEdit && ((row?.visibility ?? "").toLowerCase() === "secret" || (row?.visibility ?? "").toLowerCase() === "sensitive");

  const submit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      onToast(t.env.nameRequired, true);
      return;
    }
    if (environments.length === 0) {
      onToast(t.env.environmentRequired, true);
      return;
    }
    setBusy(true);
    const base = {
      path: project.path,
      ...(project.projectId ? { projectId: project.projectId } : {}),
    };
    const editId = isEdit ? (row?.id ?? null) : null;
    const op = editId
      ? () => serverExpoApi.envUpdate(serverId, "", { ...base, id: editId, value, visibility, environments })
      : () => serverExpoApi.envSet(serverId, "", { ...base, name: trimmedName, value, visibility, environments });
    const out = await runServerMutation(serverId, op);
    setBusy(false);
    if (out.ok) onSaved(isEdit);
    else onToast(out.error ?? t.toasts.error, true);
  };

  return (
    <ModalShell
      title={isEdit ? t.env.dialogTitleEdit : t.env.dialogTitleNew}
      onClose={onClose}
      closeLabel={t.env.cancel}
      footer={<DialogFooter onCancel={onClose} cancelLabel={t.env.cancel} onSubmit={() => void submit()} submitLabel={t.env.save} submitting={busy} />}
    >
      <Field label={t.env.labelName}>
        <input
          type="text"
          className="input input-bordered input-sm w-full font-mono"
          value={name}
          placeholder={t.env.namePlaceholder}
          disabled={isEdit}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label={t.env.labelValue} hint={valueIsMasked ? t.env.valueHintSecret : undefined}>
        <textarea
          className="textarea textarea-bordered textarea-sm w-full"
          rows={3}
          value={value}
          placeholder={t.env.valuePlaceholder}
          onChange={(e) => setValue(e.target.value)}
        />
      </Field>
      <Field label={t.env.labelVisibility}>
        <select className="select select-bordered select-sm w-full" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
          <option value="plaintext">{t.env.visPlaintext}</option>
          <option value="sensitive">{t.env.visSensitive}</option>
          <option value="secret">{t.env.visSecret}</option>
        </select>
      </Field>
      <Field label={t.env.labelEnvironments}>
        <div className="flex flex-col gap-2 pt-1">
          {ENV_TARGETS.map((target) => (
            <label key={target} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="checkbox checkbox-sm checkbox-primary"
                checked={environments.includes(target)}
                onChange={() => toggleEnv(target)}
              />
              <span className="text-sm">{target}</span>
            </label>
          ))}
        </div>
      </Field>
    </ModalShell>
  );
}

export function SubmitDialog({
  serverId,
  path,
  language,
  onClose,
  onSubmitted,
  onToast,
}: {
  serverId: string;
  path: string;
  language?: string;
  onClose: () => void;
  onSubmitted: () => void;
  onToast: (m: string, e?: boolean) => void;
}) {
  const t = getMessages(language).serverExpo;
  const [platform, setPlatform] = useState("android");
  const [profile, setProfile] = useState("production");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const out = await runServerMutation(serverId, () =>
      serverExpoApi.submit(serverId, "", { path, platform, profile: profile.trim() || "production" }),
    );
    setBusy(false);
    if (out.ok) onSubmitted();
    else onToast(out.error ?? t.toasts.error, true);
  };

  return (
    <ModalShell
      title={t.submitDialog.title}
      onClose={onClose}
      closeLabel={t.submitDialog.cancel}
      footer={<DialogFooter onCancel={onClose} cancelLabel={t.submitDialog.cancel} onSubmit={() => void submit()} submitLabel={t.submitDialog.submit} submitting={busy} />}
    >
      <InfoBox tone="info">{t.submitDialog.intro}</InfoBox>
      <Field label={t.submitDialog.platform}>
        <select className="select select-bordered select-sm w-full" value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="android">{t.submitDialog.android}</option>
          <option value="ios">{t.submitDialog.ios}</option>
        </select>
      </Field>
      <Field label={t.submitDialog.profile} hint={t.submitDialog.profileHint}>
        <input
          type="text"
          className="input input-bordered input-sm w-full"
          value={profile}
          placeholder={t.submitDialog.profilePlaceholder}
          onChange={(e) => setProfile(e.target.value)}
        />
      </Field>
    </ModalShell>
  );
}

export function OtaDialog({
  serverId,
  path,
  language,
  onClose,
  onPublished,
  onToast,
}: {
  serverId: string;
  path: string;
  language?: string;
  onClose: () => void;
  onPublished: () => void;
  onToast: (m: string, e?: boolean) => void;
}) {
  const t = getMessages(language).serverExpo;
  const [branch, setBranch] = useState("production");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const b = branch.trim();
    if (!b) {
      onToast(t.ota.branchRequired, true);
      return;
    }
    setBusy(true);
    const out = await runServerMutation(serverId, () =>
      serverExpoApi.update(serverId, "", { path, branch: b, ...(message.trim() ? { message: message.trim() } : {}) }),
    );
    setBusy(false);
    if (out.ok) onPublished();
    else onToast(out.error ?? t.toasts.error, true);
  };

  return (
    <ModalShell
      title={t.ota.title}
      onClose={onClose}
      closeLabel={t.ota.cancel}
      footer={<DialogFooter onCancel={onClose} cancelLabel={t.ota.cancel} onSubmit={() => void submit()} submitLabel={t.ota.publish} submitting={busy} />}
    >
      <InfoBox tone="info">{t.ota.intro}</InfoBox>
      <Field label={t.ota.branch}>
        <input type="text" className="input input-bordered input-sm w-full" value={branch} placeholder={t.ota.branchPlaceholder} onChange={(e) => setBranch(e.target.value)} />
      </Field>
      <Field label={t.ota.message}>
        <textarea className="textarea textarea-bordered textarea-sm w-full" rows={3} value={message} placeholder={t.ota.messagePlaceholder} onChange={(e) => setMessage(e.target.value)} />
      </Field>
    </ModalShell>
  );
}

export function DevClientDialog({
  serverId,
  path,
  language,
  onClose,
  onToast,
}: {
  serverId: string;
  path: string;
  language?: string;
  onClose: () => void;
  onToast: (m: string, e?: boolean) => void;
}) {
  const t = getMessages(language).serverExpo;
  const [tunnel, setTunnel] = useState(true);
  const [phase, setPhase] = useState<"starting" | "running" | "error" | "stopped">("starting");
  const [session, setSession] = useState<DevClientSession | null>(null);
  const [stopping, setStopping] = useState(false);

  const start = useCallback(async () => {
    setPhase("starting");
    setSession(null);
    const res = await callServerApi(serverId, "", "POST", "/api/expo/dev-client", { path, tunnel });
    if (res.code && GUARDS.includes(res.code)) {
      setPhase("error");
      onToast(t.devClient.startError, true);
      return;
    }
    if (!res.ok) {
      setPhase("error");
      onToast(res.error ?? t.devClient.startError, true);
      return;
    }
    setSession(unwrap<DevClientSession>(res) ?? {});
    setPhase("running");
  }, [serverId, path, tunnel, onToast, t.devClient]);

  // Arranca al abrir el diálogo (como la vista web del QR).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga/estado inicial intencional del efecto
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = useCallback(async () => {
    setStopping(true);
    const res = await callServerApi(serverId, "", "POST", "/api/expo/dev-client/stop", { path });
    setStopping(false);
    if (res.ok) {
      setSession(null);
      setPhase("stopped");
      onToast(t.devClient.stopped);
    } else onToast(res.error ?? t.devClient.stopError, true);
  }, [serverId, path, onToast, t.devClient]);

  const isLive = phase === "starting" || phase === "running";

  return (
    <ModalShell
      title={t.devClient.title}
      onClose={onClose}
      closeLabel={t.devClient.close}
      footer={
        <>
          {isLive ? (
            <button type="button" className="lp-modal-btn lp-modal-btn--danger" onClick={() => void stop()} disabled={stopping}>
              {stopping ? <span className="loading loading-spinner loading-xs" /> : <Square size={14} />} {t.devClient.stop}
            </button>
          ) : (
            <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={() => void start()}>
              <Play size={14} /> {t.devClient.start}
            </button>
          )}
          <button type="button" className="lp-modal-btn lp-modal-btn--primary" onClick={onClose}>
            {t.devClient.close}
          </button>
        </>
      }
    >
      <InfoBox tone="info">{t.devClient.intro}</InfoBox>
      <label className="flex cursor-pointer items-center gap-2">
        <input type="checkbox" className="checkbox checkbox-sm checkbox-primary" checked={tunnel} disabled={phase === "starting"} onChange={(e) => setTunnel(e.target.checked)} />
        <span className="text-sm">{t.devClient.tunnel}</span>
      </label>

      {phase === "starting" ? (
        <div className="flex items-center gap-2 text-sm text-base-content/70">
          <Loader2 size={16} className="animate-spin" /> {t.devClient.starting}
        </div>
      ) : null}
      {phase === "error" ? <InfoBox tone="danger">{t.devClient.startError}</InfoBox> : null}
      {phase === "stopped" ? <InfoBox tone="warn">{t.devClient.stopped}</InfoBox> : null}

      {phase === "running" && session ? (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] text-base-content/50">{t.devClient.hint}</p>
          {session.url ? <UrlBlock label={t.devClient.url} value={session.url} /> : null}
          {session.artifactUrl ? <UrlBlock label={t.devClient.artifact} value={session.artifactUrl} /> : null}
          {!session.url && !session.artifactUrl ? <p className="text-sm text-base-content/70">{t.devClient.noUrl}</p> : null}
          {session.raw ? <pre className="max-h-32 overflow-auto rounded bg-base-200 p-2 text-[11px] text-base-content/60">{session.raw}</pre> : null}
        </div>
      ) : null}
    </ModalShell>
  );
}

export function GoogleCredDialog({
  serverId,
  path,
  language,
  onClose,
  onSaved,
  onToast,
}: {
  serverId: string;
  path: string;
  language?: string;
  onClose: () => void;
  onSaved: () => void;
  onToast: (m: string, e?: boolean) => void;
}) {
  const t = getMessages(language).serverExpo;
  const [json, setJson] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const value = json.trim();
    if (!value) {
      onToast(t.credentials.google.required, true);
      return;
    }
    try {
      JSON.parse(value);
    } catch {
      onToast(t.credentials.google.invalid, true);
      return;
    }
    setBusy(true);
    const out = await runServerMutation(serverId, () =>
      callServerApi(serverId, "", "POST", "/api/expo/credentials/google", { path, serviceAccountJson: value }),
    );
    setBusy(false);
    if (out.ok) onSaved();
    else onToast(out.error ?? t.toasts.error, true);
  };

  return (
    <ModalShell
      title={t.credentials.google.title}
      onClose={onClose}
      closeLabel={t.credentials.google.cancel}
      footer={<DialogFooter onCancel={onClose} cancelLabel={t.credentials.google.cancel} onSubmit={() => void submit()} submitLabel={t.credentials.google.save} submitting={busy} />}
    >
      <InfoBox tone="info">{t.credentials.google.intro}</InfoBox>
      <Field label={t.credentials.google.label}>
        <textarea className="textarea textarea-bordered textarea-sm w-full font-mono" rows={6} value={json} placeholder={t.credentials.google.placeholder} onChange={(e) => setJson(e.target.value)} />
      </Field>
    </ModalShell>
  );
}

export function AppleCredDialog({
  serverId,
  path,
  language,
  onClose,
  onSaved,
  onToast,
}: {
  serverId: string;
  path: string;
  language?: string;
  onClose: () => void;
  onSaved: () => void;
  onToast: (m: string, e?: boolean) => void;
}) {
  const t = getMessages(language).serverExpo;
  const [issuerId, setIssuerId] = useState("");
  const [keyId, setKeyId] = useState("");
  const [p8, setP8] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const issuer = issuerId.trim();
    const key = keyId.trim();
    const p8Body = p8.trim();
    if (!issuer) {
      onToast(t.credentials.apple.issuerRequired, true);
      return;
    }
    if (!key) {
      onToast(t.credentials.apple.keyIdRequired, true);
      return;
    }
    if (!p8Body) {
      onToast(t.credentials.apple.p8Required, true);
      return;
    }
    setBusy(true);
    const out = await runServerMutation(serverId, () =>
      callServerApi(serverId, "", "POST", "/api/expo/credentials/apple", { path, issuerId: issuer, keyId: key, p8: p8Body }),
    );
    setBusy(false);
    if (out.ok) onSaved();
    else onToast(out.error ?? t.toasts.error, true);
  };

  return (
    <ModalShell
      title={t.credentials.apple.title}
      onClose={onClose}
      closeLabel={t.credentials.apple.cancel}
      footer={<DialogFooter onCancel={onClose} cancelLabel={t.credentials.apple.cancel} onSubmit={() => void submit()} submitLabel={t.credentials.apple.save} submitting={busy} />}
    >
      <InfoBox tone="info">{t.credentials.apple.intro}</InfoBox>
      <Field label={t.credentials.apple.labelIssuer}>
        <input type="text" className="input input-bordered input-sm w-full font-mono" value={issuerId} placeholder={t.credentials.apple.issuerPlaceholder} onChange={(e) => setIssuerId(e.target.value)} />
      </Field>
      <Field label={t.credentials.apple.labelKeyId}>
        <input type="text" className="input input-bordered input-sm w-full font-mono" value={keyId} placeholder={t.credentials.apple.keyIdPlaceholder} onChange={(e) => setKeyId(e.target.value)} />
      </Field>
      <Field label={t.credentials.apple.labelP8}>
        <textarea className="textarea textarea-bordered textarea-sm w-full font-mono" rows={6} value={p8} placeholder={t.credentials.apple.p8Placeholder} onChange={(e) => setP8(e.target.value)} />
      </Field>
    </ModalShell>
  );
}

export function WebhookDialog({
  serverId,
  path,
  language,
  onClose,
  onSaved,
  onToast,
}: {
  serverId: string;
  path: string;
  language?: string;
  onClose: () => void;
  onSaved: () => void;
  onToast: (m: string, e?: boolean) => void;
}) {
  const t = getMessages(language).serverExpo;
  const [url, setUrl] = useState("");
  const [event, setEvent] = useState("BUILD");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const u = url.trim();
    if (!u || !/^https?:\/\//i.test(u)) {
      onToast(t.credentials.webhook.urlRequired, true);
      return;
    }
    setBusy(true);
    const out = await runServerMutation(serverId, () =>
      callServerApi(serverId, "", "POST", "/api/expo/webhook", { path, url: u, event }),
    );
    setBusy(false);
    if (out.ok) onSaved();
    else onToast(out.error ?? t.toasts.error, true);
  };

  return (
    <ModalShell
      title={t.credentials.webhook.title}
      onClose={onClose}
      closeLabel={t.credentials.webhook.cancel}
      footer={<DialogFooter onCancel={onClose} cancelLabel={t.credentials.webhook.cancel} onSubmit={() => void submit()} submitLabel={t.credentials.webhook.save} submitting={busy} />}
    >
      <InfoBox tone="info">{t.credentials.webhook.intro}</InfoBox>
      <Field label={t.credentials.webhook.labelUrl}>
        <input type="url" className="input input-bordered input-sm w-full" value={url} placeholder={t.credentials.webhook.urlPlaceholder} onChange={(e) => setUrl(e.target.value)} />
      </Field>
      <Field label={t.credentials.webhook.labelEvent}>
        <select className="select select-bordered select-sm w-full" value={event} onChange={(e) => setEvent(e.target.value)}>
          <option value="BUILD">{t.credentials.webhook.eventBuild}</option>
          <option value="SUBMIT">{t.credentials.webhook.eventSubmit}</option>
        </select>
      </Field>
    </ModalShell>
  );
}

export function DeviceDialog({
  serverId,
  path,
  language,
  onClose,
  onToast,
}: {
  serverId: string;
  path: string;
  language?: string;
  onClose: () => void;
  onToast: (m: string, e?: boolean) => void;
}) {
  const t = getMessages(language).serverExpo;
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<ExpoCliResult | null>(null);

  const run = useCallback(async () => {
    setPhase("running");
    setResult(null);
    const res = await callServerApi(serverId, "", "POST", "/api/expo/device", { path });
    if (res.code && GUARDS.includes(res.code)) {
      setPhase("error");
      onToast(t.credentials.device.error, true);
      return;
    }
    if (!res.ok) {
      setPhase("error");
      onToast(res.error ?? t.credentials.device.error, true);
      return;
    }
    setResult(unwrap<ExpoCliResult>(res) ?? {});
    setPhase("done");
  }, [serverId, path, onToast, t.credentials.device]);

  const output = (result?.stdout ?? result?.stderr ?? "").trim();

  return (
    <ModalShell
      title={t.credentials.device.title}
      onClose={onClose}
      closeLabel={t.credentials.device.close}
      footer={
        <>
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={() => void run()} disabled={phase === "running"}>
            {phase === "running" ? <span className="loading loading-spinner loading-xs" /> : <Smartphone size={14} />} {t.credentials.device.start}
          </button>
          <button type="button" className="lp-modal-btn lp-modal-btn--primary" onClick={onClose}>
            {t.credentials.device.close}
          </button>
        </>
      }
    >
      <InfoBox tone="info">{t.credentials.device.intro}</InfoBox>

      {phase === "running" ? (
        <div className="flex items-center gap-2 text-sm text-base-content/70">
          <Loader2 size={16} className="animate-spin" /> {t.credentials.device.starting}
        </div>
      ) : null}
      {phase === "error" ? <InfoBox tone="danger">{t.credentials.device.error}</InfoBox> : null}

      {phase === "done" ? (
        <div className="flex flex-col gap-2">
          {result?.url ? (
            <UrlBlock label={t.credentials.device.url} value={result.url} />
          ) : (
            <p className="text-sm text-base-content/70">{t.credentials.device.noUrl}</p>
          )}
          {output ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-base-content/50">{t.credentials.device.output}</span>
              <pre className="max-h-40 overflow-auto rounded bg-base-200 p-2 text-[11px] text-base-content/60">{output}</pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </ModalShell>
  );
}
