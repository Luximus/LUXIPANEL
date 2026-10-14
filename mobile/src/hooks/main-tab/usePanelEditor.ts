import { useCallback, useEffect, useState, type MutableRefObject } from "react";
import { Alert } from "react-native";
import * as Clipboard from "expo-clipboard";
import {
  configurePanelSsh,
  createPanel,
  createSshKey,
  deletePanel,
  getPanelsData,
  testServerSshConnection,
  updatePanel,
  type PanelTaxonomy,
  type SshKeySummary,
} from "../../api/client";
import { savePanelsCache } from "../../storage/portalDataCache";
import type { Panel, PanelInvitation } from "../../types/models";
import type { DeletePanelState, PanelEditorState, PanelRow, ServerPingStatus } from "../../features/app/viewModels";
import type { Messages } from "../../i18n";
import { localizeCommonError } from "../../lib/error-localization";

/**
 * Sub-hook COHESIVO extraído de `useMainTabController` (fase de refactor <1000
 * líneas): editor de panel (crear/editar inline + submit con test SSH previo y
 * registro de primera llave) y el modal de borrado. Código movido verbatim; el
 * estado compartido (paneles, cache de estado, foco del carousel) entra por
 * parámetros. Contiene un único efecto (pre-selección de la primera llave SSH
 * al crear), autocontenido al estado del propio editor.
 */
export function usePanelEditor({
  token,
  userEmail,
  t,
  taxonomy,
  sshKeys,
  panels,
  setPanels,
  setInvitations,
  panelStatusCacheRef,
  setPendingFocusPanelId,
  refreshSshKeys,
  refreshPanelsData,
}: {
  token: string | null;
  userEmail: string | null;
  t: Messages;
  taxonomy: PanelTaxonomy["categories"];
  sshKeys: SshKeySummary[];
  panels: Panel[];
  setPanels: (next: Panel[]) => void;
  setInvitations: (next: PanelInvitation[]) => void;
  panelStatusCacheRef: MutableRefObject<Record<string, { status: ServerPingStatus; at: number }>>;
  setPendingFocusPanelId: (id: string | null) => void;
  refreshSshKeys: () => Promise<void>;
  refreshPanelsData: () => Promise<void>;
}) {
  const [panelEditor, setPanelEditor] = useState<PanelEditorState>({
    open: false, mode: "create", panelId: null, ip: "", port: "22", category: "", tags: [], accessUrl: "",
    sshUsername: "", sshKeyIds: [], sshPrivateKey: "", sshPassphrase: "",
    saving: false, error: "", invalidField: null,
  });
  const [deletePanelState, setDeletePanelState] = useState<DeletePanelState>({
    open: false, panelId: null, panelName: "", saving: false, error: "",
  });

  useEffect(() => {
    if (!panelEditor.open || panelEditor.mode !== "create") return;
    if (panelEditor.sshKeyIds.length > 0 || sshKeys.length === 0) return;
    setPanelEditor((current) => (current.sshKeyIds.length > 0 || !current.open || current.mode !== "create"
      ? current
      : { ...current, sshKeyIds: sshKeys[0]?.id ? [sshKeys[0].id] : [] }));
  }, [panelEditor.mode, panelEditor.open, panelEditor.sshKeyIds.length, sshKeys]);

  const openCreatePanelModal = () => {
    setPanelEditor({
      open: true, mode: "create", panelId: null, ip: "",
      port: "22",
      category: taxonomy[0]?.name ?? "", tags: [], accessUrl: "",
      sshUsername: "", sshKeyIds: sshKeys[0]?.id ? [sshKeys[0].id] : [],
      sshPrivateKey: "", sshPassphrase: "",
      saving: false, error: "", invalidField: null,
    });
  };

  // Memoizados (`setPanelEditor` es estable): si fueran funciones nuevas por
  // render, los efectos que los listan en deps (p. ej. el que sube el cromo del
  // drawer izquierdo vía `doCloseServerDrawer → closeServerDrawer`) correrían en
  // cada render y entrarían en bucle de setState ("Maximum update depth").
  const openEditPanelModal = useCallback((row: PanelRow) => {
    const currentKeyIds = row.source.sshKeyIds && row.source.sshKeyIds.length > 0
      ? row.source.sshKeyIds
      : row.source.sshKeyId
        ? [row.source.sshKeyId]
        : [];
    setPanelEditor({
      open: true, mode: "edit", panelId: row.source.id,
      ip: row.source.serverIp ?? "", port: String(row.source.serverPort ?? 22), category: row.source.category ?? "",
      tags: row.source.tags ?? [],
      accessUrl: row.source.customDomain ?? "",
      sshUsername: row.source.sshUsername ?? "", sshKeyIds: currentKeyIds,
      sshPrivateKey: "", sshPassphrase: "",
      saving: false, error: "", invalidField: null,
    });
  }, []);

  const closePanelEditor = useCallback(() => {
    // Limpia también `mode`/`panelId`: dejar `mode:"edit"` + `panelId` colgados tras
    // cerrar dejaba a `ServerDrawer.editing` (que no chequea `.open`) creyendo que
    // seguía editando ese panel → estados inconsistentes con el guard de siembra
    // (que sí chequea `.open`) y skeleton pegado al reabrir el tab Server.
    setPanelEditor((current) => ({ ...current, open: false, mode: "create", panelId: null, error: "", saving: false }));
  }, []);

  const openDeletePanelModal = (row: PanelRow) => {
    setDeletePanelState({
      open: true, panelId: row.source.id,
      panelName: row.source.licenseName || t.panelTable.fallbacks.thisPanel,
      saving: false, error: "",
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
      panelName: panel.licenseName || t.panelTable.fallbacks.thisPanel,
      saving: false,
      error: "",
    });
  }, [panelEditor.mode, panelEditor.panelId, panels, t.panelTable.fallbacks.thisPanel]);

  const submitPanelEditor = async (): Promise<string | null> => {
    if (!token) return null;
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
      setPanelEditor((c) => ({ ...c, error: t.errors.ipRequired, invalidField: "ip" })); return null;
    }
    // La URL de acceso es opcional (el panel puede registrarse antes de tener
    // LUXIPANEL desplegado), pero si viene debe parsear como URL http/https
    // (mismo criterio que el backend: default https al parsear).
    if (accessUrl) {
      const withScheme = /^https?:\/\//i.test(accessUrl) ? accessUrl : `https://${accessUrl}`;
      try {
        new URL(withScheme);
      } catch {
        setPanelEditor((c) => ({ ...c, error: t.errors.accessUrlInvalid, invalidField: "accessUrl" })); return null;
      }
    }
    const hasPrivateKey = panelEditor.sshPrivateKey.trim().length > 0;
    const hasKey = hasSharedKeys ? selectedKeyIds.length > 0 : hasPrivateKey;
    // SSH con llave propia (sin bóveda compartida): al CREAR exigimos los 3
    // campos (usuario, llave y passphrase). Al EDITAR, solo si el usuario está
    // registrando/reemplazando una llave (tecleó una privada). La passphrase
    // nunca es opcional al registrar una llave (el backend la usa para sudo -S).
    const isCreate = panelEditor.mode === "create";
    const requireFirstKeyFields = !hasSharedKeys && (isCreate || hasPrivateKey);
    if (requireFirstKeyFields) {
      if (!sshUsername) {
        setPanelEditor((c) => ({ ...c, error: t.errors.sshUserRequiredFirstKey, invalidField: "sshUsername" })); return null;
      }
      if (!hasPrivateKey) {
        setPanelEditor((c) => ({ ...c, error: t.errors.sshKeyRequiredFirst, invalidField: "sshPrivateKey" })); return null;
      }
      if (!panelEditor.sshPassphrase.trim()) {
        setPanelEditor((c) => ({ ...c, error: t.errors.sshPassphraseRequiredFirstKey, invalidField: "sshPassphrase" })); return null;
      }
    }

    setPanelEditor((c) => ({ ...c, saving: true, error: "", invalidField: null }));
    let createdPanelId: string | null = null;
    try {
      let primaryKeyId = selectedKeyIds[0] ?? "";
      let userForSsh = sshUsername;

      // Probar conexión SSH REAL ANTES de guardar (botón "Probar conexión"): al
      // CREAR con llave, si no conecta con el usuario+llave a ese servidor NO se
      // registra la llave ni se crea el panel. Usa la llave cruda (nueva) o la
      // sshKeyId (bóveda compartida). El usuario validado se usa para guardar.
      if (isCreate && hasKey) {
        const test = await testServerSshConnection({
          ip: panelEditor.ip.trim(),
          port: serverPort,
          sshUsername: sshUsername || undefined,
          ...(hasSharedKeys
            ? { sshKeyId: primaryKeyId }
            : { sshKey: panelEditor.sshPrivateKey, passphrase: panelEditor.sshPassphrase }),
        }, token);
        if (!test.connected) {
          setPanelEditor((c) => ({ ...c, saving: false, error: test.error || t.errors.connectionFailed, invalidField: null }));
          return null;
        }
        if (test.username) userForSsh = test.username;
      }

      if (!hasSharedKeys && hasKey) {
        const created = await createSshKey({
          linuxUsername: sshUsername, sshKey: panelEditor.sshPrivateKey, passphrase: panelEditor.sshPassphrase,
        }, token);
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
            ip: panelEditor.ip.trim(), port: serverPort, sshUsername: userForSsh,
            sshKeyId: primaryKeyId || null,
            sshKeyIds: hasSharedKeys ? selectedKeyIds : (primaryKeyId ? [primaryKeyId] : []),
            saveCredentials: true,
          }
        : {
            ip: panelEditor.ip.trim(), port: serverPort, sshUsername: "",
            saveCredentials: false,
          };

      if (panelEditor.mode === "create") {
        const created = await createPanel({
          serverIp: panelEditor.ip.trim(),
          serverPort,
          category: panelEditor.category.trim() || undefined,
          tags: tags.join(",") || undefined,
          customDomain: accessUrl || undefined,
        }, token);
        const panelId = created.panel?.id;
        if (!panelId) throw new Error(t.errors.couldNotGetCreatedPanel);
        await configurePanelSsh(panelId, sshPayload, token);
        createdPanelId = panelId;
        // Credencial de conexión por-panel (lxp_live_): solo viene en claro UNA
        // vez, al crear. La mostramos con opción de copiar para que el usuario la
        // pegue en el .env de su caja LUXIPANEL (luego solo se ve enmascarada).
        if (typeof created.panelCredential === "string" && created.panelCredential.trim()) {
          const secret = created.panelCredential;
          Alert.alert(
            t.panelEditor.credRevealTitle,
            `${secret}\n\n${t.panelEditor.credOnceWarning}`,
            [
              { text: t.panelEditor.credCopy, onPress: () => { void Clipboard.setStringAsync(secret); } },
              { text: t.common.accept },
            ],
          );
        }
      } else if (panelEditor.panelId) {
        await updatePanel(panelEditor.panelId, {
          category: panelEditor.category.trim() || null,
          tags: tags.join(",") || null,
          customDomain: accessUrl || null,
        }, token);
        await configurePanelSsh(panelEditor.panelId, sshPayload, token);
      }

      const data = await getPanelsData(token);
      setPanels(data.panels);
      setInvitations(data.invitations);
      await savePanelsCache(userEmail, { panels: data.panels, invitations: data.invitations });
      // Una edición pudo cambiar IP/credenciales: invalida el cache de estado de
      // ese panel para re-sondearlo en el próximo refresh y no reusar el viejo.
      if (panelEditor.panelId) delete panelStatusCacheRef.current[panelEditor.panelId];
      closePanelEditor();
      // Panel recién creado: el carousel se desplazará a él (actualizar vista).
      if (createdPanelId) setPendingFocusPanelId(createdPanelId);
      return createdPanelId;
    } catch (error) {
      setPanelEditor((c) => ({
        ...c,
        error: localizeCommonError(error, t, t.errors.couldNotSave),
      }));
      return null;
    } finally {
      setPanelEditor((c) => ({ ...c, saving: false }));
    }
  };

  const confirmDeletePanel = async () => {
    if (!token || !deletePanelState.panelId) return;
    const panelIdToDelete = deletePanelState.panelId;
    setDeletePanelState((c) => ({ ...c, saving: true, error: "" }));
    try {
      await deletePanel(panelIdToDelete, token);
      closeDeletePanelModal();
      if (panelEditor.open && panelEditor.panelId === panelIdToDelete) {
        closePanelEditor();
      }
      await refreshPanelsData();
    } catch (error) {
      setDeletePanelState((c) => ({
        ...c,
        error: localizeCommonError(error, t, t.errors.couldNotDelete),
        saving: false,
      }));
      return;
    }
    setDeletePanelState((c) => ({ ...c, saving: false }));
  };

  return {
    panelEditor, setPanelEditor,
    openCreatePanelModal, openEditPanelModal, closePanelEditor,
    submitPanelEditor, requestDeletePanelFromEditor,
    deletePanelState, openDeletePanelModal, closeDeletePanelModal, confirmDeletePanel,
  };
}
