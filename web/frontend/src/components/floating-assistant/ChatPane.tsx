// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * ChatPane — one provider's chat surface: projects + conversation list + chat
 * + input. Thin orchestrator: it wires the `useChatPane` view-model to the
 * `ChatSidebar` / `ChatMain` sub-views and the top-level modals. All state,
 * effects and handlers live in `./chat-pane/use-chat-pane`; the presentational
 * pieces live under `./chat-pane/*`. Public props (`ChatPaneProps`) + the named
 * `ChatPane` export are unchanged.
 */
import { formatAssistantMessage } from "./i18n";
import { ProjectModal } from "./ProjectModal";
import { AssistantFileEditorModal } from "./AssistantFileEditorModal";
import { ImageCarousel, AttachmentsBrowser } from "./ConversationMedia";
import { ConnectorsManagerModal, ConnectorBrowseModal } from "./OfficeConnectors";
import { AttachmentSourceModal } from "./AttachmentSourceModal";
import { ModalShell } from "@/components/ui/ModalShell";
import { useChatPane, type ChatPaneProps } from "./chat-pane/use-chat-pane";
import { ChatSidebar } from "./chat-pane/ChatSidebar";
import { ChatMain } from "./chat-pane/ChatMain";
import { useAttachmentImages } from "./chat-pane/use-attachment-images";
import { resolvePanelApiPath, scopeHeaders } from "@/lib/api-client";
import { useEffect, useSyncExternalStore } from "react";
import { workspaceState } from "./workspace-state";

export type { ChatPaneProps };

/** One provider's chat surface: projects + conversation list + chat + input. */
export function ChatPane(props: ChatPaneProps) {
  const vm = useChatPane(props);
  const previewSurface = useSyncExternalStore(workspaceState.subscribe, workspaceState.getSnapshot).surface;
  useEffect(() => {
    if (props.active) workspaceState.setContext(props.provider, props.mode, vm.activeChatProject ?? vm.currentProject);
  }, [props.active, props.provider, props.mode, vm.activeChatProject, vm.currentProject]);
  useEffect(() => {
    if (!props.active) return;
    const refresh = () => { void vm.reloadProjects(); };
    window.addEventListener("lxp:assistant:projects-updated", refresh);
    return () => window.removeEventListener("lxp:assistant:projects-updated", refresh);
  }, [props.active, vm.reloadProjects]);
  useEffect(() => {
    if (props.active && previewSurface) {
      vm.setListOpen(false);
      vm.setMobileListOpen(false);
    }
  }, [props.active, previewSurface]);
  useEffect(() => {
    if (!props.active || !vm.projects.length) return;
    const url = new URL(window.location.href);
    const requested = url.searchParams.get("project");
    if (!requested || !vm.projects.some((project) => project.id === requested)) return;
    vm.setCurrentProjectId(requested);
    vm.newConversation();
    url.searchParams.delete("project");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [props.active, vm.projects]);
  const {
    addFiles,
    attachSourceOpen,
    attachments,
    browseConnector,
    browserOpen,
    confirmDelete,
    confirmDeleteConversation,
    connectors,
    connectorsManagerOpen,
    convAttachments,
    convImages,
    ct,
    currentProjectId,
    editorPath,
    fileInputRef,
    galleryIndex,
    mobileListOpen,
    modalProject,
    mode,
    model,
    projects,
    provider,
    refreshConnectors,
    reloadProjects,
    selectedModel,
    setAttachSourceOpen,
    setAttachments,
    setBrowseConnectorId,
    setBrowserOpen,
    setConfirmDelete,
    setConnectorsManagerOpen,
    setCurrentProjectId,
    setEditorPath,
    setGalleryIndex,
    setMobileListOpen,
    setModalProject,
    setStagedGalleryIndex,
    stagedGalleryIndex,
    stagedMedia,
    support,
  } = vm;
  const attachmentImages = useAttachmentImages(convAttachments);
  return (
    <div className="flex h-full min-h-0 relative">
      {modalProject !== null && (
        <ProjectModal
          project={modalProject === "new" ? null : modalProject}
          allProjects={projects}
          onLaunchAgent={props.onLaunchAgent}
          onClose={() => setModalProject(null)}
          onSaved={(p) => {
            void reloadProjects();
            setCurrentProjectId(p.id);
          }}
          onDeleted={(id) => {
            void reloadProjects();
            if (currentProjectId === id) setCurrentProjectId(null);
          }}
          onRefresh={() => void reloadProjects()}
        />
      )}
      {editorPath && (
        <AssistantFileEditorModal path={editorPath} onClose={() => setEditorPath(null)} />
      )}

      <ChatSidebar vm={vm} />
      {/* Backdrop móvil de la lista: siempre montado y fundido con el estándar
          de movimiento (motion.css `.lxp-fade`, 200ms ease-out) en vez de
          montar/desmontar en seco. Cerrado → sin eventos ni foco. */}
      <button
        type="button"
        onClick={() => setMobileListOpen(false)}
        aria-label={ct.closeList ?? "Cerrar lista"}
        aria-hidden={!mobileListOpen}
        tabIndex={mobileListOpen ? 0 : -1}
        data-open={mobileListOpen ? "true" : "false"}
        className="lxp-fade sm:hidden fixed inset-0 z-40 bg-black/80 backdrop-blur-sm"
      />

      <ChatMain vm={vm} attachmentImages={attachmentImages} />
      {/* Navegador de adjuntos (imágenes + documentos) con pestañas. */}
      {browserOpen && (
        <AttachmentsBrowser
          attachments={convAttachments}
          imageUrls={attachmentImages}
          onOpenImage={(imageIndex) => setGalleryIndex(imageIndex)}
          onUpload={support.enabled ? () => { setBrowserOpen(false); setAttachSourceOpen(true); } : undefined}
          onAttachExisting={support.enabled ? async (attachment) => {
            const response = await fetch(resolvePanelApiPath(attachment.url), { credentials: "include", headers: scopeHeaders() });
            if (!response.ok) throw new Error(`Attachment download failed: ${response.status}`);
            const blob = await response.blob();
            if (!await addFiles([new File([blob], attachment.name, { type: attachment.mimeType || blob.type })])) {
              throw new Error("Attachment is unsupported by the active model");
            }
          } : undefined}
          onClose={() => setBrowserOpen(false)}
        />
      )}

      {/* Carrusel a pantalla completa de todas las imágenes de la conversación. */}
      {galleryIndex !== null && convImages.length > 0 && (
        <ImageCarousel
          images={convImages.map((image) => ({ ...image, url: attachmentImages.get(image.url) ?? image.url }))}
          index={galleryIndex}
          onNavigate={(next) => setGalleryIndex(next)}
          onClose={() => setGalleryIndex(null)}
        />
      )}

      {/* Mismo carrusel para los adjuntos STAGED (imágenes + PDFs) aún sin enviar. */}
      {stagedGalleryIndex !== null && stagedMedia.length > 0 && (
        <ImageCarousel
          images={stagedMedia}
          index={stagedGalleryIndex}
          onNavigate={(next) => setStagedGalleryIndex(next)}
          onClose={() => setStagedGalleryIndex(null)}
        />
      )}

      {/* Conectores de oficina: gestor de conexiones + navegador de archivos. */}
      {connectorsManagerOpen && (
        <ConnectorsManagerModal
          connectors={connectors}
          onClose={() => setConnectorsManagerOpen(false)}
          onChanged={() => void refreshConnectors()}
        />
      )}
      {browseConnector && (
        <ConnectorBrowseModal
          connector={browseConnector}
          onClose={() => setBrowseConnectorId(null)}
          onAttach={(file) => setAttachments((prev) => [...prev, file])}
        />
      )}
      {support.enabled && (
        <AttachmentSourceModal
          open={attachSourceOpen}
          support={support}
          provider={provider}
          mode={mode}
          model={selectedModel || model}
          onClose={() => setAttachSourceOpen(false)}
          onPickLocal={() => fileInputRef.current?.click()}
          onAttachServerFiles={addFiles}
        />
      )}

      {/* Confirmación de borrado de conversación (sustituye el window.confirm nativo). */}
      {confirmDelete && (
        <ModalShell onClose={() => setConfirmDelete(null)}>
          <div className="flex h-full flex-col">
            <div className="flex items-start gap-3 px-5 pt-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-500">
                <i className="ti ti-trash text-xl" aria-hidden></i>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">{ct.deleteChatTitle ?? "Eliminar"}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatAssistantMessage(ct.deleteConfirm ?? "¿Eliminar {label}? Esta acción no se puede deshacer.", { label: confirmDelete.label })}
                </p>
              </div>
            </div>
            <div className="mt-auto flex justify-end gap-2 px-5 py-4">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {ct.cancel ?? "Cancelar"}
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteConversation()}
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                {ct.deleteChatTitle ?? "Eliminar"}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
