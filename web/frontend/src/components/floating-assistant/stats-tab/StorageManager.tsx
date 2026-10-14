// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useCallback, useEffect, useState } from "react";
import { openConfirm } from "@/lib/confirm";
import DataTable, {
  type DataTableColumnConfig,
  type DataTableFilterConfig,
  type DataTableI18n,
  type DataTableValueBadgeConfig,
} from "@/components/ui/DataTable";
import { assistantStorageApi, formatBytes, type StorageUsage } from "../assistant-api";
import { useAssistantI18n } from "../i18n";
import { Box } from "./atoms";

export function StorageManager() {
  const t = useAssistantI18n().statsTab;
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"" | "images" | "chats">("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setUsage(await assistantStorageApi.usage());
    } catch {
      setUsage(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function clearImages() {
    if (!(await openConfirm(t.confirmClearImages, { variant: "danger" }))) return;
    setBusy("images");
    try {
      await assistantStorageApi.clearImages();
      await reload();
    } finally {
      setBusy("");
    }
  }

  async function clearChats() {
    if (!(await openConfirm(t.confirmClearChats, { variant: "danger" }))) return;
    setBusy("chats");
    try {
      await assistantStorageApi.clearChats();
      await reload();
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium">
          <i className="ti ti-database mr-1" aria-hidden></i>
          {t.storage}
        </p>
        <button type="button" onClick={() => void reload()} className="rounded border border-border px-2 py-0.5 text-[11px] hover:bg-accent">
          <i className="ti ti-refresh mr-1" aria-hidden></i>
          {t.refresh}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Box label={t.imagesAttachments} value={loading ? "..." : formatBytes(usage?.imagesBytes ?? 0)} />
        <Box label={t.chatsHistory} value={loading ? "..." : formatBytes(usage?.chatsBytes ?? 0)} />
        <Box label={t.total} value={loading ? "..." : formatBytes(usage?.totalBytes ?? 0)} highlight />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void clearImages()}
          disabled={busy !== "" || !(usage?.imagesBytes)}
          className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-600 hover:bg-amber-500/20 disabled:opacity-50"
        >
          <i className={`ti ${busy === "images" ? "ti-loader-2 animate-spin" : "ti-photo-off"}`} aria-hidden></i>
          {t.clearImages}
        </button>
        <button
          type="button"
          onClick={() => void clearChats()}
          disabled={busy !== ""}
          className="inline-flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-xs text-red-600 hover:bg-red-500/20 disabled:opacity-50"
        >
          <i className={`ti ${busy === "chats" ? "ti-loader-2 animate-spin" : "ti-trash"}`} aria-hidden></i>
          {t.clearChats}
        </button>
      </div>
    </div>
  );
}

