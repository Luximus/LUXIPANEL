import { useCallback, useMemo, useRef, useState } from "react";
import { uploadTicketAttachment, type UploadController } from "../api/client";
import type { TicketAttachment } from "../types/models";
import { formatMessage, getMessages } from "../i18n";

export const MAX_TICKET_ATTACHMENTS = 5;
/** Límite por archivo por defecto (fallback). El límite real es dinámico por
 *  rol y llega vía `maxFileBytes` (resuelto server-side en /portal/me). */
export const MAX_TICKET_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_TICKET_ATTACHMENTS_TOTAL_BYTES = 5 * 1024 * 1024;

export type UploadStatus = "uploading" | "done" | "error" | "aborted";

export type UploadEntry = {
  id: string;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: UploadStatus;
  result?: TicketAttachment;
  error?: string;
};

function makeId(): string {
  return `up_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export type UseTicketUploadsResult = {
  entries: UploadEntry[];
  add: (files: FileList | File[]) => { rejected: { name: string; reason: string }[] };
  remove: (id: string) => void;
  clear: () => void;
  ready: TicketAttachment[];
  hasPending: boolean;
  totalBytes: number;
  count: number;
  remaining: number;
};

export function useTicketUploads(
  getToken: () => string | null,
  language?: string,
  { maxFileBytes }: { maxFileBytes?: number } = {},
): UseTicketUploadsResult {
  const t = getMessages(language);
  // Límite por archivo dinámico por rol; fallback al fijo si no se pasó.
  const perFileBytes = maxFileBytes && maxFileBytes > 0 ? maxFileBytes : MAX_TICKET_ATTACHMENT_BYTES;
  const perFileMb = Math.round(perFileBytes / (1024 * 1024));
  // El tope total nunca puede ser menor que el límite por archivo (si no, un
  // único archivo válido sería rechazado por el total → UX incoherente).
  const totalBytesLimit = Math.max(MAX_TICKET_ATTACHMENTS_TOTAL_BYTES, perFileBytes);
  const totalMb = Math.round(totalBytesLimit / (1024 * 1024));
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const controllersRef = useRef<Map<string, UploadController>>(new Map());

  const updateEntry = useCallback((id: string, patch: Partial<UploadEntry>) => {
    setEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }, []);

  const remove = useCallback((id: string) => {
    const controller = controllersRef.current.get(id);
    if (controller) {
      try { controller.abort(); } catch { /* ignore */ }
      controllersRef.current.delete(id);
    }
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const clear = useCallback(() => {
    for (const controller of controllersRef.current.values()) {
      try { controller.abort(); } catch { /* ignore */ }
    }
    controllersRef.current.clear();
    setEntries([]);
  }, []);

  const add = useCallback(
    (files: FileList | File[]): { rejected: { name: string; reason: string }[] } => {
      const rejected: { name: string; reason: string }[] = [];
      const incoming = Array.from(files);
      const token = getToken();
      if (!token) {
        for (const file of incoming) rejected.push({ name: file.name, reason: t.uploads.rejections.sessionExpired });
        return { rejected };
      }

      setEntries((current) => {
        let runningTotal = current.reduce((sum, entry) => sum + entry.size, 0);
        const remainingSlots = Math.max(0, MAX_TICKET_ATTACHMENTS - current.length);

        const accepted: UploadEntry[] = [];
        let slotsLeft = remainingSlots;

        for (const file of incoming) {
          if (slotsLeft <= 0) {
            rejected.push({ name: file.name, reason: formatMessage(t.uploads.rejections.maxFiles, { n: MAX_TICKET_ATTACHMENTS }) });
            continue;
          }
          if (file.size > perFileBytes) {
            rejected.push({ name: file.name, reason: formatMessage(t.uploads.rejections.perFileLimit, { n: perFileMb }) });
            continue;
          }
          if (runningTotal + file.size > totalBytesLimit) {
            rejected.push({ name: file.name, reason: formatMessage(t.uploads.rejections.totalLimit, { n: totalMb }) });
            continue;
          }

          const id = makeId();
          accepted.push({
            id,
            name: file.name,
            size: file.size,
            type: file.type || "application/octet-stream",
            progress: 0,
            status: "uploading",
          });
          runningTotal += file.size;
          slotsLeft--;

          const controller = uploadTicketAttachment(file, token, ({ pct }) => {
            updateEntry(id, { progress: pct });
          });
          controllersRef.current.set(id, controller);

          controller.promise
            .then((attachment) => {
              controllersRef.current.delete(id);
              updateEntry(id, { progress: 100, status: "done", result: attachment });
            })
            .catch((error: unknown) => {
              controllersRef.current.delete(id);
              const message = error instanceof Error ? error.message : t.uploads.statuses.errorFallback;
              const isAbort = message === t.uploads.rejections.uploadCancelled;
              updateEntry(id, { status: isAbort ? "aborted" : "error", error: message });
            });
        }

        return [...current, ...accepted];
      });

      return { rejected };
    },
    [getToken, updateEntry, t, perFileBytes, perFileMb, totalBytesLimit, totalMb],
  );

  const ready = useMemo<TicketAttachment[]>(
    () => entries.filter((entry) => entry.status === "done" && entry.result).map((entry) => entry.result as TicketAttachment),
    [entries],
  );

  const hasPending = useMemo(() => entries.some((entry) => entry.status === "uploading"), [entries]);
  const totalBytes = useMemo(() => entries.reduce((sum, entry) => sum + entry.size, 0), [entries]);
  const count = entries.length;
  const remaining = Math.max(0, MAX_TICKET_ATTACHMENTS - count);

  return { entries, add, remove, clear, ready, hasPending, totalBytes, count, remaining };
}

export function humanFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function fileExtBadge(name: string, type: string): string {
  const dot = name.lastIndexOf(".");
  if (dot >= 0 && dot < name.length - 1) {
    return name.slice(dot + 1).slice(0, 4).toUpperCase();
  }
  if (type.startsWith("image/")) return "IMG";
  if (type.startsWith("video/")) return "VID";
  return "FILE";
}
