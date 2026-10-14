import { useCallback, useEffect, useState } from "react";
import { configurePanelSsh, createPanel, createSshKey, deletePanel, updatePanel, type PanelTaxonomy, type SshKeySummary } from "../../api/client";
import type { ToastApi } from "../../components/ToastProvider";
import type { Messages } from "../../i18n/messages";
import type { DeletePanelState, PanelEditorState, PanelRow } from "../../features/app/viewModels";
import type { Panel } from "../../types/models";

/**
 * Editor de panel (crear/editar), revelado de credencial por-panel y borrado
 * de panel, extraído de `useMainTabController` SIN cambios de comportamiento.
 * `reloadPanels` es el `refreshPanelsData` del controlador (re-consulta
 * paneles+invitaciones y re-lanza los pings); `invalidatePanelStatus` borra el
 * cache de ping del panel editado para que se re-sondee de inmediato.
 */
export function usePanelEditor({ token, t, toast, panels, taxonomy, sshKeys, refreshSshKeys, reloadPanels, invalidatePanelStatus }: {
  token: string | null;
  t: Messages;
  toast: ToastApi;
  panels: Panel[];
  taxonomy: PanelTaxonomy["categories"];
  sshKeys: SshKeySummary[];
  refreshSshKeys: () => Promise<void>;
  reloadPanels: () => Promise<void>;
  invalidatePanelStatus: (panelId: string) => void;
}) {
  const [panelEditor, setPanelEditor] = useState<PanelEditorState>({ open: false, mode: "create", panelId: null, ip: "", port: "22", category: "", tags: [], accessUrl: "", sshUsername: "", sshKeyIds: [], sshPrivateKey: "", sshPassphrase: "", saving: false, error: "", failedField: null });
  // Secreto de la credencial de conexión por-panel (lxp_live_) recién creada:
  // se muestra en claro UNA sola vez al crear un panel para copiar/pegar en el
  // .env de la caja LUXIPANEL. `null` = modal cerrado.
  const [credentialReveal, setCredentialReveal] = useState<string | null>(null);
  const [deletePanelState, setDeletePanelState] = useState<DeletePanelState>({ open: false, panelId: null, panelName: "", saving: false, error: "" });

  useEffect(() => {
    if (!panelEditor.open || panelEditor.mode !== "create") return;
    if (panelEditor.sshKeyIds.length > 0 || sshKeys.length === 0) return;
    setPanelEditor((current) => (current.sshKeyIds.length > 0 || !current.open || current.mode !== "create"
      ? current
      : { ...current, sshKeyIds: sshKeys[0]?.id ? [sshKeys[0].id] : [] }));
  }, [panelEditor.mode, panelEditor.open, panelEditor.sshKeyIds.length, setPanelEditor, sshKeys]);


  const openCreatePanelModal = () => {
    setPanelEditor({
      open: true,
      mode: "create",
      panelId: null,
      ip: "",
      port: "22",
      category: taxonomy[0]?.name ?? "",
      tags: [],
      accessUrl: "",
      sshUsername: "",
      sshKeyIds: sshKeys[0]?.id ? [sshKeys[0].id] : [],
      sshPrivateKey: "",
      sshPassphrase: "",
      saving: false,
      error: "",
      failedField: null,
    });
  };

  const openEditPanelModal = (row: PanelRow) => {
    const currentKeyIds = row.source.sshKeyIds && row.source.sshKeyIds.length > 0
      ? row.source.sshKeyIds
      : row.source.sshKeyId
        ? [row.source.sshKeyId]
        : [];
    setPanelEditor({
      open: true,
      mode: "edit",
      panelId: row.source.id,
      ip: row.source.serverIp ?? "",
      port: String(row.source.serverPort ?? 22),
      category: row.source.category ?? "",
      tags: row.source.tags ?? [],
      accessUrl: row.source.customDomain ?? "",
      sshUsername: row.source.sshUsername ?? "",
      sshKeyIds: currentKeyIds,
      sshPrivateKey: "",
      sshPassphrase: "",
      saving: false,
      error: "",
      failedField: null,
    });
  };

  const closePanelEditor = () => {
    setPanelEditor((current) => ({ ...current, open: false, error: "", saving: false }));
  };

  const openDeletePanelModal = (row: PanelRow) => {
    setDeletePanelState({
      open: true,
      panelId: row.source.id,
      panelName: row.source.licenseName || row.source.licenseKey || t.panelTable.fallbacks.thisPanel,
      saving: false,
      error: "",
    });
  };

  const closeDeletePanelModal = () => {
    setDeletePanelState((current) => ({ ...current, open: false, error: "", saving: false }));
  };

  const requestDeletePanelFromEditor = useCallback(() => {
    if (panelEditor.mode !== "edit" || !panelEditor.panelId) return;
    const panel = panels.find((entry) => entry.id === panelEditor.panelId);
    if (!panel) return;
    setDeletePanelState({
      open: true,
      panelId: panel.id,
      panelName: panel.licenseName || panel.licenseKey || t.panelTable.fallbacks.thisPanel,
      saving: false,
      error: "",
    });
  }, [panelEditor.mode, panelEditor.panelId, panels, t.panelTable.fallbacks.thisPanel]);

  const submitPanelEditor = async () => {
    if (!token) return;
    const tags = panelEditor.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean);
    // URL COMPLETA de acceso al LUXIPANEL (customDomain): esquema/puerto
    // opcionales; se persiste tal cual (trim). Vacía => sin URL configurada.
    const accessUrl = panelEditor.accessUrl.trim();
    const sshUsername = panelEditor.sshUsername.trim();
    const parsedPort = Number.parseInt(panelEditor.port.trim(), 10);
    const serverPort = Number.isInteger(parsedPort) && parsedPort >= 1 && parsedPort <= 65535 ? parsedPort : 22;
    const selectedKeyIds = panelEditor.sshKeyIds.filter(Boolean);
    const hasSharedKeys = sshKeys.length > 0;

    if (!panelEditor.ip.trim()) {
      setPanelEditor((current) => ({ ...current, error: t.errors.ipRequired, failedField: "ip" }));
      return;
    }
    // La URL de acceso es opcional (el panel puede registrarse antes de tener
    // LUXIPANEL desplegado), pero si viene debe parsear como URL http/https
    // (mismo criterio que el backend: default https al parsear).
    if (accessUrl) {
      const withScheme = /^https?:\/\//i.test(accessUrl) ? accessUrl : `https://${accessUrl}`;
      try {
        new URL(withScheme);
      } catch {
        setPanelEditor((current) => ({ ...current, error: t.errors.accessUrlInvalid, failedField: "accessUrl" }));
        return;
      }
    }
    const hasPrivateKey = panelEditor.sshPrivateKey.trim().length > 0;
    const hasKey = hasSharedKeys ? selectedKeyIds.length > 0 : hasPrivateKey;
    // SSH con llave propia (sin bóveda compartida): al CREAR exigimos los 3
    // campos (usuario, llave y passphrase). Al EDITAR, solo si el usuario está
    // registrando/reemplazando una llave (tecleó una privada), en cuyo caso
    // también pedimos usuario y passphrase. La passphrase nunca es opcional al
    // registrar una llave (el backend la usa para `sudo -S`).
    const isCreate = panelEditor.mode === "create";
    const requireFirstKeyFields = !hasSharedKeys && (isCreate || hasPrivateKey);
    if (requireFirstKeyFields) {
      if (!sshUsername) {
        setPanelEditor((current) => ({ ...current, error: t.errors.sshUserRequiredFirstKey, failedField: "sshUsername" }));
        return;
      }
      if (!hasPrivateKey) {
        setPanelEditor((current) => ({ ...current, error: t.errors.sshKeyRequiredFirst, failedField: "sshPrivateKey" }));
        return;
      }
      if (!panelEditor.sshPassphrase.trim()) {
        setPanelEditor((current) => ({ ...current, error: t.errors.sshPassphraseRequiredFirstKey, failedField: "sshPassphrase" }));
        return;
      }
    }

    setPanelEditor((current) => ({ ...current, saving: true, error: "", failedField: null }));
    try {
      let primaryKeyId = selectedKeyIds[0] ?? "";
      let userForSsh = sshUsername;

      if (!hasSharedKeys && hasKey) {
        const created = await createSshKey({ linuxUsername: sshUsername, sshKey: panelEditor.sshPrivateKey, passphrase: panelEditor.sshPassphrase }, token);
        primaryKeyId = created.key?.id ?? "";
        if (!primaryKeyId) throw new Error(t.errors.couldNotRegisterFirstKey);
        await refreshSshKeys();
      } else if (hasSharedKeys && hasKey) {
        const matched = sshKeys.find((key) => key.id === primaryKeyId);
        if (!userForSsh) userForSsh = matched?.linuxUsername ?? "";
      }

      // Sin llave: solo IP/puerto, sin credenciales (igual en crear y editar).
      const sshPayload = hasKey
        ? {
            ip: panelEditor.ip.trim(),
            port: serverPort,
            sshUsername: userForSsh,
            sshKeyId: primaryKeyId || null,
            sshKeyIds: hasSharedKeys ? selectedKeyIds : (primaryKeyId ? [primaryKeyId] : []),
            saveCredentials: true,
          }
        : {
            ip: panelEditor.ip.trim(),
            port: serverPort,
            sshUsername: "",
            saveCredentials: false,
          };

      if (panelEditor.mode === "create") {
        const created = await createPanel({ serverIp: panelEditor.ip.trim(), serverPort, category: panelEditor.category.trim() || undefined, tags: tags.join(",") || undefined, customDomain: accessUrl || undefined }, token);
        const panelId = created.panel?.id;
        if (!panelId) throw new Error(t.errors.couldNotGetCreatedPanel);
        await configurePanelSsh(panelId, sshPayload, token);
        // Credencial de conexión por-panel (lxp_live_): solo viene en claro UNA
        // vez, al crear. Se revela para copiar/pegar en el .env de LUXIPANEL.
        if (typeof created.panelCredential === "string" && created.panelCredential.trim()) {
          setCredentialReveal(created.panelCredential);
        }
      } else if (panelEditor.panelId) {
        await updatePanel(panelEditor.panelId, { category: panelEditor.category.trim() || null, tags: tags.join(",") || null, customDomain: accessUrl || null }, token);
        await configurePanelSsh(panelEditor.panelId, sshPayload, token);
      }

      // Una edición pudo cambiar IP/credenciales: invalida el cache de estado de
      // ese panel para re-sondearlo de inmediato y no reusar el estado viejo.
      if (panelEditor.panelId) invalidatePanelStatus(panelEditor.panelId);
      await reloadPanels();
      const wasCreate = panelEditor.mode === "create";
      closePanelEditor();
      toast.success(wasCreate ? t.toast.created : t.toast.saved);
    } catch (error) {
      setPanelEditor((current) => ({ ...current, error: error instanceof Error ? error.message : t.errors.couldNotSave }));
    } finally {
      setPanelEditor((current) => ({ ...current, saving: false }));
    }
  };

  const confirmDeletePanel = async () => {
    if (!token || !deletePanelState.panelId) return;
    setDeletePanelState((current) => ({ ...current, saving: true, error: "" }));
    try {
      await deletePanel(deletePanelState.panelId, token);
      closeDeletePanelModal();
      await reloadPanels();
      toast.success(t.toast.deleted);
    } catch (error) {
      setDeletePanelState((current) => ({ ...current, error: error instanceof Error ? error.message : t.errors.couldNotDelete, saving: false }));
      return;
    }
    setDeletePanelState((current) => ({ ...current, saving: false }));
  };

  return {
    panelEditor,
    setPanelEditor,
    credentialReveal,
    setCredentialReveal,
    deletePanelState,
    openCreatePanelModal,
    openEditPanelModal,
    closePanelEditor,
    openDeletePanelModal,
    closeDeletePanelModal,
    requestDeletePanelFromEditor,
    submitPanelEditor,
    confirmDeletePanel,
  };
}
