// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { ViewTransition, useViewDirection } from "@/components/ui/ViewTransition";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import { MediaCarousel, type MediaItem } from "@/components/ui/MediaCarousel";
import { ModalShell } from "@/components/ui/ModalShell";
import type { TurnAttachment } from "./chat-engine";
import { mergeNamespaces, useAssistantI18n } from "./i18n";

type ConversationMediaMessages = {
  download: string;
  close: string;
  previous: string;
  next: string;
  all: string;
  images: string;
  documents: string;
  attachmentsTitle: string;
  mediaTitle: string;
  emptyConversation: string;
  imagesSection: string;
  documentsSection: string;
  clickToExpand: string;
  emptyImages: string;
  emptyDocuments: string;
  uploadToChat: string;
  attachToChat: string;
  attachFailed: string;
};

// Type-only fallback string shape; actual strings live in the i18n locale files
// (assistant.conversationMedia.*) and are deep-merged at runtime via mergeNamespaces.
const conversationMediaFallback: ConversationMediaMessages = {
  download: "",
  close: "",
  previous: "",
  next: "",
  all: "",
  images: "",
  documents: "",
  attachmentsTitle: "",
  mediaTitle: "",
  emptyConversation: "",
  imagesSection: "",
  documentsSection: "",
  clickToExpand: "",
  emptyImages: "",
  emptyDocuments: "",
  uploadToChat: "",
  attachToChat: "",
  attachFailed: "",
};

/** True para adjuntos que se pueden renderizar como imagen. */
export function isImageAttachment(a: TurnAttachment): boolean {
  return a.mimeType.startsWith("image/");
}

/** Ícono tabler según el tipo MIME del documento (no-imagen). */
function fileIcon(mimeType: string): string {
  if (mimeType === "application/pdf") return "ti-file-type-pdf";
  if (mimeType.startsWith("text/")) return "ti-file-text";
  if (mimeType.includes("zip") || mimeType.includes("compressed") || mimeType.includes("tar")) return "ti-file-zip";
  if (mimeType.includes("word") || mimeType.includes("document")) return "ti-file-type-doc";
  if (mimeType.includes("sheet") || mimeType.includes("excel") || mimeType.includes("csv")) return "ti-file-type-xls";
  if (mimeType.startsWith("audio/")) return "ti-file-music";
  if (mimeType.startsWith("video/")) return "ti-file-x"; // genérico de video
  return "ti-file";
}

// ── Carrusel / lightbox de imágenes ─────────────────────────────────────────

/**
 * Visor a pantalla completa de TODAS las imágenes de la conversación. Ahora es
 * un WRAPPER sobre `ui/MediaCarousel` (mismo markup/animación, sin cambio
 * visual): traduce `TurnAttachment[]` al contrato `MediaItem[]` y le pasa las
 * etiquetas del namespace del asistente.
 */
export function ImageCarousel({
  images,
  index,
  onNavigate,
  onClose,
}: {
  images: TurnAttachment[];
  index: number;
  onNavigate: (next: number) => void;
  onClose: () => void;
}) {
  const i18n = useAssistantI18n() as ReturnType<typeof useAssistantI18n> & {
    conversationMedia?: Partial<ConversationMediaMessages>;
  };
  const t = mergeNamespaces(conversationMediaFallback, i18n.conversationMedia);

  const items: MediaItem[] = useMemo(
    () =>
      images.map((a, i) => ({
        id: `${a.url}-${i}`,
        name: a.name,
        mimeType: a.mimeType,
        url: a.url,
        kind: a.mimeType === "application/pdf" ? "pdf" : "image",
      })),
    [images],
  );

  if (!items.length) return null;

  return (
    <MediaCarousel
      items={items}
      index={index}
      onNavigate={onNavigate}
      onClose={onClose}
      variant="fullscreen"
      labels={{ download: t.download, close: t.close, previous: t.previous, next: t.next }}
    />
  );
}

// ── Navegador de adjuntos (imágenes + documentos) con pestañas ───────────────

type MediaTab = "all" | "images" | "docs";
const MEDIA_TAB_ORDER: readonly MediaTab[] = ["all", "images", "docs"];

/**
 * Modal que lista TODOS los adjuntos de la conversación con pestañas para
 * filtrar por tipo. Las imágenes se muestran como cuadrícula de miniaturas
 * (al hacer clic se abre el carrusel); los documentos como filas con descarga.
 */
export function AttachmentsBrowser({
  attachments,
  imageUrls,
  onOpenImage,
  onUpload,
  onAttachExisting,
  onClose,
}: {
  attachments: TurnAttachment[];
  imageUrls?: ReadonlyMap<string, string>;
  /** Recibe el índice DENTRO de la lista de imágenes (no de todos los adjuntos). */
  onOpenImage: (imageIndex: number) => void;
  onUpload?: () => void;
  onAttachExisting?: (attachment: TurnAttachment) => Promise<void>;
  onClose: () => void;
}) {
  const i18n = useAssistantI18n() as ReturnType<typeof useAssistantI18n> & {
    conversationMedia?: Partial<ConversationMediaMessages>;
  };
  const t = mergeNamespaces(conversationMediaFallback, i18n.conversationMedia);
  const [tab, setTab] = useState<MediaTab>("all");
  const [attaching, setAttaching] = useState<string | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);

  const attachExisting = async (attachment: TurnAttachment) => {
    if (!onAttachExisting || attaching) return;
    setAttachError(null);
    setAttaching(attachment.url);
    try {
      await onAttachExisting(attachment);
      onClose();
    } catch {
      setAttachError(t.attachFailed || "No se pudo adjuntar el archivo al chat.");
    } finally {
      setAttaching(null);
    }
  };

  const images = useMemo(() => attachments.filter(isImageAttachment), [attachments]);
  const docs = useMemo(() => attachments.filter((a) => !isImageAttachment(a)), [attachments]);

  const tabs: Array<{ id: MediaTab; label: string; icon: string; count: number }> = [
    { id: "all", label: t.all, icon: "ti-paperclip", count: attachments.length },
    { id: "images", label: t.images, icon: "ti-photo", count: images.length },
    { id: "docs", label: t.documents, icon: "ti-file", count: docs.length },
  ];

  const tabDirection = useViewDirection(tab, MEDIA_TAB_ORDER);
  const showImages = tab === "all" || tab === "images";
  const showDocs = tab === "all" || tab === "docs";

  return (
    <ModalShell
      onClose={onClose}
      icon="ti-photo"
      title={t.mediaTitle || "Multimedia"}
      closeLabel={t.close}
      bodyClassName="flex flex-col !overflow-hidden !p-0"
    >
      {/* Pestañas de filtro (fijas) */}
      <div className="flex shrink-0 gap-1 border-b border-border px-2 py-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-200 ease-out ${
              tab === t.id ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:bg-accent"
            }`}
          >
            <i className={`ti ${t.icon} text-sm`} aria-hidden></i>
            {t.label}
            <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">{t.count}</span>
          </button>
        ))}
      </div>

      {onUpload && (
        <div className="border-b border-border px-4 py-2">
          <button type="button" onClick={onUpload} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent">
            <i className="ti ti-upload text-sm" aria-hidden />
            {t.uploadToChat || "Subir archivos al chat"}
          </button>
        </div>
      )}
      {attachError && <p role="alert" className="px-4 pt-2 text-xs text-red-500">{attachError}</p>}

      {/* Contenido (scroll) */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {attachments.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t.emptyConversation}</p>
        ) : (
          /* Cambio de pestaña con la transición de vista (motion.css). */
          <ViewTransition viewKey={tab} direction={tabDirection} className="space-y-4">
            {showImages && images.length > 0 && (
              <div>
                {tab === "all" && (
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t.imagesSection}</p>
                )}
                <div className="grid grid-cols-3 gap-2 @xl:grid-cols-4">
                  {images.map((a, i) => (
                    <div key={`${a.url}-${i}`} className="min-w-0">
                      <button
                        type="button"
                        disabled={a.url.startsWith("/api/") && !imageUrls?.has(a.url)}
                        onClick={() => onOpenImage(i)}
                        title={`${a.name} · ${t.clickToExpand}`}
                        className="group relative aspect-square overflow-hidden rounded-lg border border-border/40 disabled:cursor-wait"
                      >
                        {a.url.startsWith("/api/") && !imageUrls?.has(a.url) ? (
                          <span className="flex h-full w-full items-center justify-center text-muted-foreground"><i className="ti ti-photo text-2xl" aria-hidden="true" /></span>
                        ) : (
                          <img src={imageUrls?.get(a.url) ?? a.url} alt={a.name} className="h-full w-full object-cover transition group-hover:opacity-80" loading="lazy" />
                        )}
                        <span className="absolute bottom-1 right-1 rounded bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100">
                          <i className="ti ti-arrows-maximize text-[10px]" aria-hidden></i>
                        </span>
                      </button>
                      {onAttachExisting && (
                        <button type="button" onClick={() => void attachExisting(a)} disabled={attaching !== null} className="mt-1 inline-flex w-full items-center justify-center gap-1 rounded-md px-1 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50">
                          <i className="ti ti-paperclip" aria-hidden />{t.attachToChat || "Adjuntar al chat"}
                        </button>
                      )}
                    </div>
                    ))}
                  </div>
                </div>
              )}

              {showDocs && docs.length > 0 && (
                <div>
                  {tab === "all" && (
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t.documentsSection}</p>
                  )}
                  <div className="space-y-1.5">
                    {docs.map((a, i) => (
                      <div key={`${a.url}-${i}`} className="flex min-w-0 items-center gap-1">
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        download={a.name}
                        title={a.name}
                        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-sm no-underline transition-colors hover:bg-accent"
                      >
                        <i className={`ti ${fileIcon(a.mimeType)} shrink-0 text-lg text-muted-foreground`} aria-hidden></i>
                        <span className="min-w-0 flex-1 truncate text-foreground">{a.name}</span>
                        <i className="ti ti-download shrink-0 text-sm text-muted-foreground" aria-hidden></i>
                      </a>
                      {onAttachExisting && (
                        <button type="button" onClick={() => void attachExisting(a)} disabled={attaching !== null} title={t.attachToChat || "Adjuntar al chat"} aria-label={`${t.attachToChat || "Adjuntar al chat"}: ${a.name}`} className="shrink-0 rounded-md border border-border p-2 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50">
                          <i className="ti ti-paperclip text-sm" aria-hidden />
                        </button>
                      )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Estado vacío por-pestaña */}
              {tab === "images" && images.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">{t.emptyImages}</p>
              )}
              {tab === "docs" && docs.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">{t.emptyDocuments}</p>
              )}
          </ViewTransition>
          )}
      </div>
    </ModalShell>
  );
}
