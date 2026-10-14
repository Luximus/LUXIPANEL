import { fileExtBadge, humanFileSize, type UploadEntry } from "../hooks/useTicketUploads";
import { getMessages } from "../i18n";
import styles from "./UploadList.module.css";

export function UploadList({
  entries,
  onRemove,
  language,
}: {
  entries: UploadEntry[];
  onRemove: (id: string) => void;
  language?: string;
}) {
  const t = getMessages(language);
  if (entries.length === 0) {
    return <ul className="upload-list" data-empty="true" />;
  }
  return (
    <ul className="upload-list" data-empty="false">
      {entries.map((entry) => {
        const pct = Math.max(0, Math.min(100, Math.round(entry.progress)));
        const insetInlineEnd = `${100 - pct}%`;
        const statusClass =
          entry.status === "done"
            ? "upload-item--success"
            : entry.status === "error" || entry.status === "aborted"
              ? "upload-item--error"
              : "";
        const meta =
          entry.status === "uploading"
            ? `${humanFileSize(entry.size)} · ${pct}%`
            : entry.status === "done"
              ? `${humanFileSize(entry.size)} · ${t.uploads.statuses.ready}`
              : entry.status === "error"
                ? entry.error || t.uploads.statuses.errorFallback
                : t.uploads.statuses.cancelled;
        return (
          <li key={entry.id} className={`upload-item ${statusClass}`} data-upload-id={entry.id}>
            <div className="upload-item__main">
              <div className="upload-item__row">
                <span className="upload-item__icon">{fileExtBadge(entry.name, entry.type)}</span>
                <span className="upload-item__name" title={entry.name}>{entry.name}</span>
              </div>
              <div className="upload-item__progress" aria-hidden="true">
                <div
                  className={`upload-item__progress-bar ${styles.progressBar}`}
                  style={{ ["--upload-bar-end" as string]: insetInlineEnd }}
                />
              </div>
              <div className="upload-item__meta">{meta}</div>
            </div>
            <button
              type="button"
              className="upload-item__remove"
              aria-label={t.uploads.removeAria}
              onClick={() => onRemove(entry.id)}
            >
              ×
            </button>
          </li>
        );
      })}
    </ul>
  );
}
