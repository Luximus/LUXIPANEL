import { FormDrawer } from "../../../components/ui/FormDrawer";
/**
 * expo-dialogs — diálogos del módulo Expo extraídos de ExpoScreen sin cambio de
 * comportamiento: lanzar build, variables de entorno, submit a tienda, OTA,
 * dev-client, credenciales Google/Apple, webhook y registro de dispositivo.
 */
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens } from "../../../theme/colors";
import { getMessages } from "../../../i18n";
import { loadSessionState } from "../../../lib/session-state";
import { Field, InfoBox, DialogFooter, Checkbox } from "../../../components/server/Form";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { TablerPlayerPlay } from "../../../features/app/tabler-icons";
import { serverExpoApi, unwrap, callServerApi } from "../../../api/serverApi";
import { runServerMutation } from "../../../hooks/useServerApi";
import { IconDeviceMobile, IconPlayerStop } from "./expo-icons";
import {
  type DevClientSession,
  type ExpoCliResult,
  type ExpoEnvVar,
  type ExpoProject,
  ENV_TARGETS,
  GUARDS,
  VISIBILITIES,
} from "./expo-types";

export function BuildDialog({
  panelId,
  token,
  path,
  onClose,
  onLaunched,
  onError,
}: {
  panelId: string;
  token: string;
  path: string;
  onClose: () => void;
  onLaunched: () => void;
  onError: () => void;
}) {
  const language = loadSessionState().language;
  const t = getMessages(language).serverExpo;
  const [platform, setPlatform] = useState("android");
  const [profile, setProfile] = useState("production");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const out = await runServerMutation(panelId, token, () => serverExpoApi.build(panelId, token, { path, platform, profile }));
    setBusy(false);
    if (out.ok) onLaunched();
    else throw new Error(out.error ?? t.toasts.error);
  };

  return (
    <FormDrawer
      visible
      onClose={onClose}
      title={t.buildDialog.title}
      language={language}
      footer={<DialogFooter onCancel={onClose} cancelLabel={t.buildDialog.cancel} onSubmit={submit} submitLabel={t.buildDialog.launch} submitting={busy} />}
    >
      <Field label={t.buildDialog.platform}>
        <Select
          value={platform}
          onChange={setPlatform}
          options={[
            { value: "android", label: t.buildDialog.android },
            { value: "ios", label: t.buildDialog.ios },
            { value: "all", label: t.buildDialog.all },
          ]}
        />
      </Field>
      <Field label={t.buildDialog.profile}>
        <Select
          value={profile}
          onChange={setProfile}
          options={[
            { value: "development", label: t.buildDialog.profileDev },
            { value: "preview", label: t.buildDialog.profilePreview },
            { value: "production", label: t.buildDialog.profileProd },
          ]}
        />
      </Field>
    </FormDrawer>
  );
}

export function EnvDialog({
  panelId,
  token,
  project,
  mode,
  row,
  onClose,
  onSaved,
  onToast,
}: {
  panelId: string;
  token: string;
  project: ExpoProject;
  mode: "create" | "edit";
  row?: ExpoEnvVar;
  onClose: () => void;
  onSaved: (updated: boolean) => void;
  onToast: (m: string, e?: boolean) => void;
}) {
  const language = loadSessionState().language;
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
      ? () =>
          serverExpoApi.envUpdate(panelId, token, {
            ...base,
            id: editId,
            value,
            visibility,
            environments,
          })
      : () =>
          serverExpoApi.envSet(panelId, token, {
            ...base,
            name: trimmedName,
            value,
            visibility,
            environments,
          });
    const out = await runServerMutation(panelId, token, op);
    setBusy(false);
    if (out.ok) onSaved(isEdit);
    else throw new Error(out.error ?? t.toasts.error);
  };

  return (
    <FormDrawer
      visible
      onClose={onClose}
      title={isEdit ? t.env.dialogTitleEdit : t.env.dialogTitleNew}
      language={language}
      footer={<DialogFooter onCancel={onClose} cancelLabel={t.env.cancel} onSubmit={submit} submitLabel={t.env.save} submitting={busy} />}
    >
      <Field label={t.env.labelName}>
        <Input
          value={name}
          onChangeText={setName}
          placeholder={t.env.namePlaceholder}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isEdit}
        />
      </Field>
      <Field label={t.env.labelValue} hint={valueIsMasked ? t.env.valueHintSecret : undefined}>
        <Input
          value={value}
          onChangeText={setValue}
          placeholder={t.env.valuePlaceholder}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          style={{ minHeight: 60 }}
        />
      </Field>
      <Field label={t.env.labelVisibility}>
        <Select
          value={visibility}
          onChange={setVisibility}
          options={[
            { value: "plaintext", label: t.env.visPlaintext },
            { value: "sensitive", label: t.env.visSensitive },
            { value: "secret", label: t.env.visSecret },
          ]}
        />
      </Field>
      <Field label={t.env.labelEnvironments}>
        <View style={{ gap: 10, marginTop: 2 }}>
          {ENV_TARGETS.map((target) => (
            <Checkbox key={target} value={environments.includes(target)} onChange={() => toggleEnv(target)} label={target} />
          ))}
        </View>
      </Field>
    </FormDrawer>
  );
}

/**
 * SubmitDialog — envía el último build de la plataforma elegida a su tienda
 * (`eas submit`). `submit` sólo acepta android/ios (no "all"); el perfil del
 * `eas.json` decide credenciales/método. POST /api/expo/submit.
 */
export function SubmitDialog({
  panelId,
  token,
  path,
  onClose,
  onSubmitted,
  onToast,
}: {
  panelId: string;
  token: string;
  path: string;
  onClose: () => void;
  onSubmitted: () => void;
  onToast: (m: string, e?: boolean) => void;
}) {
  const language = loadSessionState().language;
  const t = getMessages(language).serverExpo;
  const [platform, setPlatform] = useState("android");
  const [profile, setProfile] = useState("production");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const out = await runServerMutation(panelId, token, () =>
      serverExpoApi.submit(panelId, token, { path, platform, profile: profile.trim() || "production" }),
    );
    setBusy(false);
    if (out.ok) onSubmitted();
    else throw new Error(out.error ?? t.toasts.error);
  };

  return (
    <FormDrawer
      visible
      onClose={onClose}
      title={t.submitDialog.title}
      language={language}
      footer={<DialogFooter onCancel={onClose} cancelLabel={t.submitDialog.cancel} onSubmit={submit} submitLabel={t.submitDialog.submit} submitting={busy} />}
    >
      <InfoBox tone="info">{t.submitDialog.intro}</InfoBox>
      <Field label={t.submitDialog.platform}>
        <Select
          value={platform}
          onChange={setPlatform}
          options={[
            { value: "android", label: t.submitDialog.android },
            { value: "ios", label: t.submitDialog.ios },
          ]}
        />
      </Field>
      <Field label={t.submitDialog.profile} hint={t.submitDialog.profileHint}>
        <Input value={profile} onChangeText={setProfile} placeholder={t.submitDialog.profilePlaceholder} autoCapitalize="none" autoCorrect={false} />
      </Field>
    </FormDrawer>
  );
}

/**
 * OtaDialog — publica una actualización OTA (expo-updates) en una rama/canal
 * (`eas update`). POST /api/expo/update {path, branch, message?}.
 */
export function OtaDialog({
  panelId,
  token,
  path,
  onClose,
  onPublished,
  onToast,
}: {
  panelId: string;
  token: string;
  path: string;
  onClose: () => void;
  onPublished: () => void;
  onToast: (m: string, e?: boolean) => void;
}) {
  const language = loadSessionState().language;
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
    const out = await runServerMutation(panelId, token, () =>
      serverExpoApi.update(panelId, token, { path, branch: b, ...(message.trim() ? { message: message.trim() } : {}) }),
    );
    setBusy(false);
    if (out.ok) onPublished();
    else throw new Error(out.error ?? t.toasts.error);
  };

  return (
    <FormDrawer
      visible
      onClose={onClose}
      title={t.ota.title}
      language={language}
      footer={<DialogFooter onCancel={onClose} cancelLabel={t.ota.cancel} onSubmit={submit} submitLabel={t.ota.publish} submitting={busy} />}
    >
      <InfoBox tone="info">{t.ota.intro}</InfoBox>
      <Field label={t.ota.branch}>
        <Input value={branch} onChangeText={setBranch} placeholder={t.ota.branchPlaceholder} autoCapitalize="none" autoCorrect={false} />
      </Field>
      <Field label={t.ota.message}>
        <Input value={message} onChangeText={setMessage} placeholder={t.ota.messagePlaceholder} multiline style={{ minHeight: 60 }} />
      </Field>
    </FormDrawer>
  );
}

/**
 * DevClientDialog — inicia un servidor Metro con túnel en el servidor cliente y
 * muestra el enlace/estado para probar en dispositivo (hot reload). POST
 * /api/expo/dev-client {path,tunnel?} (start) y /api/expo/dev-client/stop {path}.
 * Estos endpoints devuelven datos (la sesión) → se llaman con `callServerApi`
 * directo (sin wrapper) + `unwrap`, no con `runServerMutation`.
 */
export function DevClientDialog({
  panelId,
  token,
  path,
  onClose,
  onToast,
}: {
  panelId: string;
  token: string;
  path: string;
  onClose: () => void;
  onToast: (m: string, e?: boolean) => void;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverExpo;

  const [tunnel, setTunnel] = useState(true);
  const [phase, setPhase] = useState<"starting" | "running" | "error" | "stopped">("starting");
  const [session, setSession] = useState<DevClientSession | null>(null);
  const [stopping, setStopping] = useState(false);

  const start = useCallback(async () => {
    setPhase("starting");
    setSession(null);
    const res = await callServerApi(panelId, token, "POST", "/api/expo/dev-client", { path, tunnel });
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
  }, [panelId, token, path, tunnel, onToast, t.devClient]);

  // Arranca al abrir el diálogo (como la vista web del QR).
  useEffect(() => {
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = useCallback(async () => {
    setStopping(true);
    const res = await callServerApi(panelId, token, "POST", "/api/expo/dev-client/stop", { path });
    setStopping(false);
    if (res.ok) {
      setSession(null);
      setPhase("stopped");
      onToast(t.devClient.stopped);
    } else onToast(res.error ?? t.devClient.stopError, true);
  }, [panelId, token, path, onToast, t.devClient]);

  const UrlBlock = ({ label, value }: { label: string; value: string }) => (
    <View style={{ gap: 2 }}>
      <Text style={{ color: tokens.textMuted, fontSize: 11 }}>{label}</Text>
      <Text selectable style={{ color: tokens.textPrimary, fontSize: 12 }}>
        {value}
      </Text>
    </View>
  );

  const isLive = phase === "starting" || phase === "running";

  return (
    <Modal
      visible
      onClose={onClose}
      title={t.devClient.title}
      language={language}
      footer={
        <View style={{ flexDirection: "row", gap: 10, flex: 1 }}>
          {isLive ? (
            <Button label={t.devClient.stop} variant="danger" icon={<IconPlayerStop size={16} />} onPress={stop} loading={stopping} style={{ flex: 1 }} />
          ) : (
            <Button label={t.devClient.start} variant="secondary" icon={<TablerPlayerPlay size={16} />} onPress={start} style={{ flex: 1 }} />
          )}
          <Button label={t.devClient.close} variant="ghost" onPress={onClose} style={{ flex: 1 }} />
        </View>
      }
    >
      <View style={{ gap: 12 }}>
        <InfoBox tone="info">{t.devClient.intro}</InfoBox>
        <Checkbox value={tunnel} onChange={setTunnel} label={t.devClient.tunnel} disabled={phase === "starting"} />

        {phase === "starting" ? (
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <ActivityIndicator color={tokens.brand} />
            <Text style={{ color: tokens.textSecondary, fontSize: 13, flex: 1 }}>{t.devClient.starting}</Text>
          </View>
        ) : null}

        {phase === "error" ? <InfoBox tone="danger">{t.devClient.startError}</InfoBox> : null}
        {phase === "stopped" ? <InfoBox tone="warn">{t.devClient.stopped}</InfoBox> : null}

        {phase === "running" && session ? (
          <View style={{ gap: 10 }}>
            <Text style={{ color: tokens.textMuted, fontSize: 11 }}>{t.devClient.hint}</Text>
            {session.url ? <UrlBlock label={t.devClient.url} value={session.url} /> : null}
            {session.artifactUrl ? <UrlBlock label={t.devClient.artifact} value={session.artifactUrl} /> : null}
            {!session.url && !session.artifactUrl ? (
              <Text style={{ color: tokens.textSecondary, fontSize: 13 }}>{t.devClient.noUrl}</Text>
            ) : null}
            {session.raw ? (
              <Text style={{ color: tokens.textMuted, fontSize: 11 }} numberOfLines={5}>
                {session.raw}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

/**
 * GoogleCredDialog — pega el JSON de la cuenta de servicio de Google Play. Se
 * guarda cifrado en el servidor (POST /api/expo/credentials/google) para los
 * perfiles submit de eas.json. Endpoint sin wrapper → `callServerApi` directo
 * envuelto en `runServerMutation`.
 */
export function GoogleCredDialog({
  panelId,
  token,
  path,
  onClose,
  onSaved,
  onToast,
}: {
  panelId: string;
  token: string;
  path: string;
  onClose: () => void;
  onSaved: () => void;
  onToast: (m: string, e?: boolean) => void;
}) {
  const language = loadSessionState().language;
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
    const out = await runServerMutation(panelId, token, () =>
      callServerApi(panelId, token, "POST", "/api/expo/credentials/google", { path, serviceAccountJson: value }),
    );
    setBusy(false);
    if (out.ok) onSaved();
    else throw new Error(out.error ?? t.toasts.error);
  };

  return (
    <FormDrawer
      visible
      onClose={onClose}
      title={t.credentials.google.title}
      language={language}
      footer={<DialogFooter onCancel={onClose} cancelLabel={t.credentials.google.cancel} onSubmit={submit} submitLabel={t.credentials.google.save} submitting={busy} />}
    >
      <InfoBox tone="info">{t.credentials.google.intro}</InfoBox>
      <Field label={t.credentials.google.label}>
        <Input
          value={json}
          onChangeText={setJson}
          placeholder={t.credentials.google.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          style={{ minHeight: 120 }}
        />
      </Field>
    </FormDrawer>
  );
}

/**
 * AppleCredDialog — pega la clave .p8 de App Store Connect + Key ID / Issuer ID.
 * POST /api/expo/credentials/apple {path, issuerId, keyId, p8} (el backend usa
 * `p8`, no `keyP8`). Se guarda cifrada en el servidor.
 */
export function AppleCredDialog({
  panelId,
  token,
  path,
  onClose,
  onSaved,
  onToast,
}: {
  panelId: string;
  token: string;
  path: string;
  onClose: () => void;
  onSaved: () => void;
  onToast: (m: string, e?: boolean) => void;
}) {
  const language = loadSessionState().language;
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
    const out = await runServerMutation(panelId, token, () =>
      callServerApi(panelId, token, "POST", "/api/expo/credentials/apple", { path, issuerId: issuer, keyId: key, p8: p8Body }),
    );
    setBusy(false);
    if (out.ok) onSaved();
    else throw new Error(out.error ?? t.toasts.error);
  };

  return (
    <FormDrawer
      visible
      onClose={onClose}
      title={t.credentials.apple.title}
      language={language}
      footer={<DialogFooter onCancel={onClose} cancelLabel={t.credentials.apple.cancel} onSubmit={submit} submitLabel={t.credentials.apple.save} submitting={busy} />}
    >
      <InfoBox tone="info">{t.credentials.apple.intro}</InfoBox>
      <Field label={t.credentials.apple.labelIssuer}>
        <Input value={issuerId} onChangeText={setIssuerId} placeholder={t.credentials.apple.issuerPlaceholder} autoCapitalize="none" autoCorrect={false} />
      </Field>
      <Field label={t.credentials.apple.labelKeyId}>
        <Input value={keyId} onChangeText={setKeyId} placeholder={t.credentials.apple.keyIdPlaceholder} autoCapitalize="none" autoCorrect={false} />
      </Field>
      <Field label={t.credentials.apple.labelP8}>
        <Input value={p8} onChangeText={setP8} placeholder={t.credentials.apple.p8Placeholder} autoCapitalize="none" autoCorrect={false} multiline style={{ minHeight: 120 }} />
      </Field>
    </FormDrawer>
  );
}

/**
 * WebhookDialog — registra un webhook EAS (POST /api/expo/webhook {path, url,
 * event}) que EAS llamará cuando un build/envío cambie de estado.
 */
export function WebhookDialog({
  panelId,
  token,
  path,
  onClose,
  onSaved,
  onToast,
}: {
  panelId: string;
  token: string;
  path: string;
  onClose: () => void;
  onSaved: () => void;
  onToast: (m: string, e?: boolean) => void;
}) {
  const language = loadSessionState().language;
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
    const out = await runServerMutation(panelId, token, () =>
      callServerApi(panelId, token, "POST", "/api/expo/webhook", { path, url: u, event }),
    );
    setBusy(false);
    if (out.ok) onSaved();
    else throw new Error(out.error ?? t.toasts.error);
  };

  return (
    <FormDrawer
      visible
      onClose={onClose}
      title={t.credentials.webhook.title}
      language={language}
      footer={<DialogFooter onCancel={onClose} cancelLabel={t.credentials.webhook.cancel} onSubmit={submit} submitLabel={t.credentials.webhook.save} submitting={busy} />}
    >
      <InfoBox tone="info">{t.credentials.webhook.intro}</InfoBox>
      <Field label={t.credentials.webhook.labelUrl}>
        <Input value={url} onChangeText={setUrl} placeholder={t.credentials.webhook.urlPlaceholder} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
      </Field>
      <Field label={t.credentials.webhook.labelEvent}>
        <Select
          value={event}
          onChange={setEvent}
          options={[
            { value: "BUILD", label: t.credentials.webhook.eventBuild },
            { value: "SUBMIT", label: t.credentials.webhook.eventSubmit },
          ]}
        />
      </Field>
    </FormDrawer>
  );
}

/**
 * DeviceDialog — registra un dispositivo iOS para distribución interna
 * (`eas device:create`). POST /api/expo/device {path} devuelve la salida del CLI
 * con el enlace de registro → se llama con `callServerApi` directo + `unwrap`
 * para mostrarlo (no con `runServerMutation`, que descarta los datos).
 */
export function DeviceDialog({
  panelId,
  token,
  path,
  onClose,
  onToast,
}: {
  panelId: string;
  token: string;
  path: string;
  onClose: () => void;
  onToast: (m: string, e?: boolean) => void;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverExpo;

  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<ExpoCliResult | null>(null);

  const run = useCallback(async () => {
    setPhase("running");
    setResult(null);
    const res = await callServerApi(panelId, token, "POST", "/api/expo/device", { path });
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
  }, [panelId, token, path, onToast, t.credentials.device]);

  const output = (result?.stdout ?? result?.stderr ?? "").trim();

  return (
    <FormDrawer
      visible
      onClose={onClose}
      title={t.credentials.device.title}
      language={language}
      footer={
        <View style={{ flexDirection: "row", gap: 10, flex: 1 }}>
          <Button
            label={t.credentials.device.start}
            variant="secondary"
            icon={<IconDeviceMobile size={16} />}
            onPress={run}
            loading={phase === "running"}
            style={{ flex: 1 }}
          />
          <Button label={t.credentials.device.close} variant="ghost" onPress={onClose} style={{ flex: 1 }} />
        </View>
      }
    >
      <View style={{ gap: 12 }}>
        <InfoBox tone="info">{t.credentials.device.intro}</InfoBox>

        {phase === "running" ? (
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <ActivityIndicator color={tokens.brand} />
            <Text style={{ color: tokens.textSecondary, fontSize: 13, flex: 1 }}>{t.credentials.device.starting}</Text>
          </View>
        ) : null}

        {phase === "error" ? <InfoBox tone="danger">{t.credentials.device.error}</InfoBox> : null}

        {phase === "done" ? (
          <View style={{ gap: 10 }}>
            {result?.url ? (
              <View style={{ gap: 2 }}>
                <Text style={{ color: tokens.textMuted, fontSize: 11 }}>{t.credentials.device.url}</Text>
                <Text selectable style={{ color: tokens.textPrimary, fontSize: 12 }}>
                  {result.url}
                </Text>
              </View>
            ) : (
              <Text style={{ color: tokens.textSecondary, fontSize: 13 }}>{t.credentials.device.noUrl}</Text>
            )}
            {output ? (
              <View style={{ gap: 2 }}>
                <Text style={{ color: tokens.textMuted, fontSize: 11 }}>{t.credentials.device.output}</Text>
                <Text style={{ color: tokens.textMuted, fontSize: 11 }} numberOfLines={8}>
                  {output}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </FormDrawer>
  );
}
