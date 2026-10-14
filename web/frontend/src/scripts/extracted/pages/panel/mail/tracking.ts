// Mail page — Track Delivery tab (report table, column picker, detail dialog).
import { createTablePages } from "/scripts/extracted/lib/table-pages.js";
import { api,resolveTargetScope } from "/scripts/extracted/lib/mail-api-client.js?v=20260930a";
import { setCollapsed } from "/scripts/extracted/lib/dom.js";
import type { MailTrackColumnKey, MailTrackDeliveryItem, MailTrackDeliveryStatus } from "./state";
import { S, TRACK_DEFAULT_COLUMNS } from "./state";
import { escapeHtml, fmt, t } from "./dom";
import { updateMailTabCounts } from "./settings";

const trackPages=createTablePages({tableId:"mail-track-delivery-tbody",events:window,scope:resolveTargetScope,reload:()=>loadTrackDeliveryReport(),field:"items",rowKey:row=>`${row.queueId}:${row.recipient}:${row.sentTime}`});

const TRACK_STATUS_LABEL: Record<MailTrackDeliveryStatus, string> = {
  success: t("tracking.statuses.success", "Success"),
  deferred: t("tracking.statuses.deferred", "Deferred"),
  failure: t("tracking.statuses.failure", "Failure"),
  in_progress: t("tracking.statuses.inProgress", "In-Progress"),
};

const TRACK_COLUMN_LABEL: Record<MailTrackColumnKey, string> = {
  event: t("tracking.columns.event", "Event"),
  fromAddress: t("tracking.columns.fromAddress", "From Address"),
  sentTime: t("tracking.columns.sentTime", "Sent Time"),
  spamScore: t("tracking.columns.spamScore", "Spam Score"),
  recipient: t("tracking.columns.recipient", "Recipient"),
  domain: t("tracking.columns.domain", "Domain"),
  queueId: t("tracking.columns.id", "ID"),
  result: t("tracking.columns.result", "Result"),
  actions: t("tracking.columns.actions", "Actions"),
};

function setTrackDeliveryError(message: string | null) {
  const el = document.getElementById("mail-track-delivery-error");
  if (!el) return;
  if (!message) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.textContent = message;
  el.classList.remove("hidden");
}

function formatTrackDeliveryTime(value: string): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(document.documentElement.lang || undefined);
}

function getTrackDeliveryCellValue(item: MailTrackDeliveryItem, column: MailTrackColumnKey): string {
  switch (column) {
    case "event":
      return TRACK_STATUS_LABEL[item.status] || t("tracking.statuses.unknown", "Unknown");
    case "fromAddress":
      return item.fromAddress || "-";
    case "sentTime":
      return formatTrackDeliveryTime(item.sentTime);
    case "spamScore":
      return item.spamScore == null ? "-" : String(item.spamScore);
    case "recipient":
      return item.recipient || "-";
    case "domain":
      return (item.recipient.split("@")[1] || "").trim().toLowerCase() || "-";
    case "queueId":
      return item.queueId || "-";
    case "result":
      return item.result || "-";
    case "actions":
      return "";
  }
}

function getTrackVisibleColumns(): MailTrackColumnKey[] {
  const ordered = Object.keys(TRACK_COLUMN_LABEL) as MailTrackColumnKey[];
  const visible = ordered.filter((key) => S.mailTrackColumns.has(key));
  if (!visible.length) return ["event"];
  return visible;
}

function renderTrackColumnsHeader(columns: MailTrackColumnKey[]) {
  const thead = document.getElementById("mail-track-delivery-thead");
  if (!thead) return;
  thead.innerHTML = `
    <tr class="border-b border-border text-muted-foreground">
      ${columns.map((column) => `<th class="px-2 py-1.5 text-left">${escapeHtml(TRACK_COLUMN_LABEL[column])}</th>`).join("")}
    </tr>
  `;
}

export function syncTrackColumnCheckboxes() {
  const checkboxes = Array.from(document.querySelectorAll<HTMLInputElement>("input[data-track-column]"));
  for (const input of checkboxes) {
    const key = input.dataset.trackColumn as MailTrackColumnKey | undefined;
    if (!key) continue;
    input.checked = S.mailTrackColumns.has(key);
  }
  const allToggle = document.getElementById("mail-track-delivery-columns-all") as HTMLInputElement | null;
  if (allToggle) {
    allToggle.checked = checkboxes.length > 0 && checkboxes.every((input) => input.checked);
  }
}

function rebuildTrackColumnsFromInputs() {
  const selected = new Set<MailTrackColumnKey>();
  document.querySelectorAll<HTMLInputElement>("input[data-track-column]").forEach((input) => {
    const key = input.dataset.trackColumn as MailTrackColumnKey | undefined;
    if (!key) return;
    if (input.checked) selected.add(key);
  });
  if (!selected.size) {
    selected.add("event");
  }
  S.mailTrackColumns = selected;
  renderTrackDeliveryTable();
}

export function setTrackModeButtons() {
  const allBtn = document.getElementById("mail-track-delivery-show-all");
  const blockedBtn = document.getElementById("mail-track-delivery-show-blocked");
  if (allBtn) {
    allBtn.className = S.mailTrackDeliveryMode === "all"
      ? "rounded-md border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs text-primary"
      : "rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent";
  }
  if (blockedBtn) {
    blockedBtn.className = S.mailTrackDeliveryMode === "blocked_failed"
      ? "rounded-md border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs text-primary"
      : "rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent";
  }
}

function openTrackDetails(item: MailTrackDeliveryItem) {
  const dialog = document.getElementById("mail-track-delivery-detail-dialog") as HTMLDialogElement | null;
  const meta = document.getElementById("mail-track-delivery-detail-meta");
  const raw = document.getElementById("mail-track-delivery-detail-raw");
  if (!dialog || !meta || !raw) return;
  meta.textContent = fmt(t("tracking.detailMeta", "Event: {event} | ID: {id} | Recipient: {recipient}"), { event: TRACK_STATUS_LABEL[item.status], id: item.queueId || "-", recipient: item.recipient || "-" });
  raw.textContent = item.raw || item.result || "-";
  dialog.showModal();
}

export function renderTrackDeliveryTable() {
  const tbody = document.getElementById("mail-track-delivery-tbody");
  const summary = document.getElementById("mail-track-delivery-summary");
  const matches = document.getElementById("mail-track-delivery-matches");
  if (!tbody) return;
  const columns = getTrackVisibleColumns();
  renderTrackColumnsHeader(columns);
  syncTrackColumnCheckboxes();

  if (!S.mailTrackDeliveryItems.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${columns.length}" class="px-2 py-6 text-center text-muted-foreground">${t("tracking.noRecordsFound", "No records found.")}</td>
      </tr>
    `;
    if (summary) summary.textContent = t("tracking.zeroRecords", "0 records");
    if (matches) matches.textContent = t("tracking.matchesZeroRecords", "The search matches 0 records.");
    return;
  }

  tbody.innerHTML = S.mailTrackDeliveryItems.map((item, index) => `
    <tr class="border-b border-border last:border-0">
      ${columns.map((column) => {
        if (column === "actions") {
          return `
            <td class="px-2 py-1.5">
              <button type="button" data-track-detail-index="${index}" class="rounded border border-border px-2 py-0.5 text-[11px] hover:bg-accent">
                ${t("actions.view", "View")}
              </button>
            </td>
          `;
        }
        return `<td class="px-2 py-1.5">${escapeHtml(getTrackDeliveryCellValue(item, column))}</td>`;
      }).join("")}
    </tr>
  `).join("");

  tbody.querySelectorAll<HTMLButtonElement>("button[data-track-detail-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.trackDetailIndex ?? "-1");
      if (!Number.isFinite(index) || index < 0 || index >= S.mailTrackDeliveryItems.length) return;
      openTrackDetails(S.mailTrackDeliveryItems[index]!);
    });
  });

  if (summary) summary.textContent = fmt(t("tracking.recordsCount", "{count} records"), { count: S.mailTrackDeliveryItems.length });
  if (matches) matches.textContent = fmt(t("tracking.matchesRecords", "The search matches {count} records."), { count: S.mailTrackDeliveryItems.length });
}

export async function loadTrackDeliveryReport() {
  setTrackDeliveryError(null);
  setTrackModeButtons();

  const recipient = ((document.getElementById("mail-track-delivery-recipient") as HTMLInputElement | null)?.value ?? "").trim().toLowerCase();
  const showSuccess = (document.getElementById("mail-track-delivery-show-success") as HTMLInputElement | null)?.checked !== false;
  const showDeferred = (document.getElementById("mail-track-delivery-show-deferred") as HTMLInputElement | null)?.checked !== false;
  const showFailures = (document.getElementById("mail-track-delivery-show-failures") as HTMLInputElement | null)?.checked !== false;
  const showInProgress = (document.getElementById("mail-track-delivery-show-inprogress") as HTMLInputElement | null)?.checked !== false;
  const maxRaw = Number((document.getElementById("mail-track-delivery-max-results") as HTMLSelectElement | null)?.value ?? "250");
  const max = Number.isFinite(maxRaw) ? Math.max(25, Math.min(500, Math.floor(maxRaw))) : 250;

  const runButton = document.getElementById("mail-track-delivery-run") as HTMLButtonElement | null;
  if (runButton) runButton.disabled = true;

  try {
    const res = await trackPages.read<{ items: MailTrackDeliveryItem[]; total: number; retainedDays: number }>(params=>api.get("/api/mail/track-delivery", {
      params: {
        ...params,
        recipient: recipient || undefined,
        mode: S.mailTrackDeliveryMode,
        max,
        showSuccess: showSuccess ? "1" : "0",
        showDeferred: showDeferred ? "1" : "0",
        showFailures: showFailures ? "1" : "0",
        showInProgress: showInProgress ? "1" : "0",
      },
    }),JSON.stringify([recipient,S.mailTrackDeliveryMode,max,showSuccess,showDeferred,showFailures,showInProgress]));
    if(res.code==="TARGET_SCOPE_CHANGED")return;

    if (!res.ok) {
      setTrackDeliveryError(res.error ?? t("errors.trackDeliveryLoadFailed", "No se pudo cargar Track Delivery."));
      return;
    }

    const payload = res.data && typeof res.data === "object" ? res.data : { items: [] };
    const rawItems = Array.isArray(payload.items) ? payload.items : [];
    const validStatus = new Set<MailTrackDeliveryStatus>(["success", "deferred", "failure", "in_progress"]);
    S.mailTrackDeliveryItems = rawItems
      .map((entry) => ({
        queueId: String((entry as any).queueId ?? ""),
        sentTime: String((entry as any).sentTime ?? ""),
        fromAddress: String((entry as any).fromAddress ?? "").trim().toLowerCase(),
        recipient: String((entry as any).recipient ?? "").trim().toLowerCase(),
        status: validStatus.has((entry as any).status) ? (entry as any).status as MailTrackDeliveryStatus : "in_progress",
        result: String((entry as any).result ?? ""),
        spamScore: typeof (entry as any).spamScore === "number" ? (entry as any).spamScore : null,
        raw: String((entry as any).raw ?? ""),
      }));
    renderTrackDeliveryTable();
    updateMailTabCounts();
  } finally {
    if (runButton) runButton.disabled = false;
  }
}

export const closeTrackDeliveryDetailDialog = () => (document.getElementById("mail-track-delivery-detail-dialog") as HTMLDialogElement | null)?.close();

document.getElementById("mail-track-delivery-detail-close")?.addEventListener("click", closeTrackDeliveryDetailDialog);

document.getElementById("mail-track-delivery-show-all")?.addEventListener("click", () => {
  S.mailTrackDeliveryMode = "all";
  setTrackModeButtons();
  S.mailTrackDeliveryLoaded = true;
  void loadTrackDeliveryReport();
});

document.getElementById("mail-track-delivery-show-blocked")?.addEventListener("click", () => {
  S.mailTrackDeliveryMode = "blocked_failed";
  setTrackModeButtons();
  S.mailTrackDeliveryLoaded = true;
  void loadTrackDeliveryReport();
});

document.getElementById("mail-track-delivery-run")?.addEventListener("click", () => {
  S.mailTrackDeliveryLoaded = true;
  void loadTrackDeliveryReport();
});

document.getElementById("mail-track-delivery-max-results")?.addEventListener("change", () => {
  S.mailTrackDeliveryLoaded = true;
  void loadTrackDeliveryReport();
});

document.getElementById("mail-track-delivery-show-success")?.addEventListener("change", () => {
  S.mailTrackDeliveryLoaded = true;
  void loadTrackDeliveryReport();
});

document.getElementById("mail-track-delivery-show-deferred")?.addEventListener("change", () => {
  S.mailTrackDeliveryLoaded = true;
  void loadTrackDeliveryReport();
});

document.getElementById("mail-track-delivery-show-failures")?.addEventListener("change", () => {
  S.mailTrackDeliveryLoaded = true;
  void loadTrackDeliveryReport();
});

document.getElementById("mail-track-delivery-show-inprogress")?.addEventListener("change", () => {
  S.mailTrackDeliveryLoaded = true;
  void loadTrackDeliveryReport();
});

document.getElementById("mail-track-delivery-columns-toggle")?.addEventListener("click", (event) => {
  event.stopPropagation();
  const panel = document.getElementById("mail-track-delivery-columns-panel");
  if (!panel) return;
  setCollapsed(panel);
});

document.getElementById("mail-track-delivery-columns-close")?.addEventListener("click", () => {
  setCollapsed(document.getElementById("mail-track-delivery-columns-panel"), true);
});

document.getElementById("mail-track-delivery-columns-reset")?.addEventListener("click", () => {
  S.mailTrackColumns = new Set<MailTrackColumnKey>(TRACK_DEFAULT_COLUMNS);
  syncTrackColumnCheckboxes();
  renderTrackDeliveryTable();
});

document.getElementById("mail-track-delivery-columns-all")?.addEventListener("change", (event) => {
  const checked = (event.target as HTMLInputElement).checked;
  document.querySelectorAll<HTMLInputElement>("input[data-track-column]").forEach((input) => {
    input.checked = checked;
  });
  rebuildTrackColumnsFromInputs();
});

document.querySelectorAll<HTMLInputElement>("input[data-track-column]").forEach((input) => {
  input.addEventListener("change", () => {
    rebuildTrackColumnsFromInputs();
  });
});
