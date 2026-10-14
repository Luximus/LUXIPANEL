import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { styles } from "./ImportExportModal.styles";
import { AlertTriangle, Check, Download, FolderOpen, Upload } from "lucide-react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import {
  createPanel,
  createPanelCategory,
  createPanelTag,
  createSshKey,
  exportPanelData,
  type PanelDataExport,
} from "../api/client";
import { formatMessage, getMessages } from "../i18n";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { FormSheet } from "./ui/FormSheet";
import { Button } from "./ui/Button";
import { SegmentedControl } from "./ui/SegmentedControl";
import { localizeCommonError } from "../lib/error-localization";

type Mode = "export" | "import";

type Selection = {
  panels: boolean;
  taxonomy: boolean;
  ssh: boolean;
};

type ImportSummary = {
  panelsCreated: number;
  sshCreated: number;
  failures: number;
};

const DEFAULT_SELECTION: Selection = { panels: true, taxonomy: true, ssh: false };

export function ImportExportModal({
  open,
  mode = "export",
  onClose,
  token,
  language,
  onAfterImport,
}: {
  open: boolean;
  mode: Mode;
  onClose: () => void;
  token: string;
  language?: string;
  onAfterImport?: () => void;
}) {
  // Export e Import siempre disponibles. El 2FA del export (si el usuario activó
  // el scope `export`) lo pide el reintento central del helper `request`.
  const canExport = true;
  const t = getMessages(language);
  const tr = t.importExport;
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");

  const [selection, setSelection] = useState<Selection>(DEFAULT_SELECTION);
  const [activeTab, setActiveTab] = useState<Mode>(mode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pickedFile, setPickedFile] = useState<{ uri: string; name: string } | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const SWIPE_THRESHOLD = 64;
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!open) {
      setSelection(DEFAULT_SELECTION);
      setBusy(false);
      setError("");
      setPickedFile(null);
      setSummary(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setActiveTab(canExport ? mode : "import");
  }, [open, mode, canExport]);

  const toggle = (key: keyof Selection) => setSelection((s) => ({ ...s, [key]: !s[key] }));
  const handleTabSwipeEnd = React.useCallback((dx: number, dy: number) => {
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0 && activeTab === "export") setActiveTab("import");
    if (dx > 0 && activeTab === "import" && canExport) setActiveTab("export");
  }, [activeTab, canExport]);

  const handleExport = async () => {
    if (!selection.panels && !selection.taxonomy && !selection.ssh) {
      setError(tr.errors.noSelection);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await exportPanelData({
        includePanels: selection.panels,
        includeTaxonomy: selection.taxonomy,
        includeSsh: selection.ssh,
      }, token);
      const json = JSON.stringify(data, null, 2);
      const filename = `luxipanel-export-${Date.now()}.json`;
      const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? "";
      const path = `${dir}${filename}`;
      await FileSystem.writeAsStringAsync(path, json);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, {
          mimeType: "application/json",
          dialogTitle: tr.exportTitle,
        });
      }
      onClose();
    } catch (e) {
      setError(localizeCommonError(e, t, tr.errors.exportFailed));
    } finally {
      setBusy(false);
    }
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setPickedFile({ uri: asset.uri, name: asset.name ?? "import.json" });
      setError("");
    } catch (e) {
      setError(localizeCommonError(e, t, tr.errors.readFailed));
    }
  };

  const handleImport = async () => {
    if (!pickedFile) {
      setError(tr.errors.readFailed);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const text = await FileSystem.readAsStringAsync(pickedFile.uri);
      let parsed: PanelDataExport;
      try {
        parsed = JSON.parse(text);
      } catch {
        setError(tr.errors.invalidFile);
        setBusy(false);
        return;
      }

      let panelsCreated = 0;
      let sshCreated = 0;
      let failures = 0;

      if (selection.taxonomy && Array.isArray(parsed.taxonomy)) {
        for (const cat of parsed.taxonomy) {
          try {
            const created = await createPanelCategory(cat.name, token);
            const id = created.category?.id;
            if (id && Array.isArray(cat.tags)) {
              for (const tag of cat.tags) {
                try { await createPanelTag(id, tag, token); } catch { failures++; }
              }
            }
          } catch { failures++; }
        }
      }

      if (selection.ssh && Array.isArray(parsed.sshKeys)) {
        for (const key of parsed.sshKeys) {
          if (!key.privateKey) { failures++; continue; }
          try {
            await createSshKey({
              linuxUsername: key.linuxUsername || "root",
              sshKey: key.privateKey,
            }, token);
            sshCreated++;
          } catch { failures++; }
        }
      }

      if (selection.panels && Array.isArray(parsed.panels)) {
        for (const panel of parsed.panels) {
          if (!panel.serverIp) { failures++; continue; }
          try {
            await createPanel({
              serverIp: panel.serverIp,
              customDomain: panel.customDomain ?? undefined,
              category: panel.panelCategory ?? undefined,
              tags: (panel.panelTags ?? []).join(",") || undefined,
            }, token);
            panelsCreated++;
          } catch { failures++; }
        }
      }

      setSummary({ panelsCreated, sshCreated, failures });
      onAfterImport?.();
    } catch (e) {
      setError(localizeCommonError(e, t, tr.errors.importFailed));
    } finally {
      setBusy(false);
    }
  };

  const SelectionRow = ({ label, value, onToggle, warn }: { label: string; value: boolean; onToggle: () => void; warn?: string }) => (
    <Pressable onPress={onToggle} style={[styles.row, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
      <View style={[styles.checkbox, { borderColor: tokens.border, backgroundColor: value ? tokens.brand : "transparent" }]}>
        {value ? <Check size={12} color="#fff" strokeWidth={3} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: tokens.textSecondary, fontSize: 14 }}>{label}</Text>
        {warn ? (
          <View style={styles.warnRow}>
            <AlertTriangle size={12} color={tokens.warning} />
            <Text style={{ color: tokens.warning, fontSize: 11, flex: 1 }}>{warn}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );

  return (
    <FormSheet
      visible={open}
      onClose={onClose}
      title={activeTab === "export" ? tr.exportTitle : tr.importTitle}
      language={language}
      footer={
        <>
          <Button label={tr.cancel} variant="ghost" onPress={onClose} />
          {activeTab === "export" ? (
            <Button
              label={busy ? tr.exporting : tr.exportAction}
              variant="primary"
              onPress={handleExport}
              loading={busy}
              disabled={busy}
              icon={<Download size={14} color="#fff" />}
            />
          ) : (
            <Button
              label={busy ? tr.importing : tr.importAction}
              variant="primary"
              onPress={handleImport}
              loading={busy}
              disabled={busy || !pickedFile}
              icon={<Upload size={14} color="#fff" />}
            />
          )}
        </>
      }
    >
      <Text style={{ color: tokens.textMuted, fontSize: 13 }}>
        {activeTab === "export" ? tr.exportSubtitle : tr.importSubtitle}
      </Text>
      {canExport ? (
        <View style={[styles.tabsRow, { borderBottomColor: tokens.border }]}>
          <SegmentedControl
            fill
            items={[
              { key: "export", label: tr.exportTitle },
              { key: "import", label: tr.importTitle },
            ]}
            value={activeTab}
            onChange={(key) => setActiveTab(key as Mode)}
          />
        </View>
      ) : null}

      <View
        onTouchStart={(event) => {
          const { pageX, pageY } = event.nativeEvent;
          touchStartRef.current = { x: pageX, y: pageY };
        }}
        onTouchEnd={(event) => {
          if (!touchStartRef.current) return;
          const { pageX, pageY } = event.nativeEvent;
          const dx = pageX - touchStartRef.current.x;
          const dy = pageY - touchStartRef.current.y;
          touchStartRef.current = null;
          handleTabSwipeEnd(dx, dy);
        }}
      >
        <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>{tr.sectionsTitle}</Text>
        <SelectionRow label={tr.panelsLabel} value={selection.panels} onToggle={() => toggle("panels")} />
        <SelectionRow label={tr.taxonomyLabel} value={selection.taxonomy} onToggle={() => toggle("taxonomy")} />
        <SelectionRow label={tr.sshLabel} value={selection.ssh} onToggle={() => toggle("ssh")} warn={selection.ssh ? tr.sshWarning : undefined} />

        {activeTab === "import" ? (
          <View>
            <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>{tr.fileLabel}</Text>
            <Button label={tr.pickFile} variant="ghost" onPress={handlePickFile} icon={<FolderOpen size={14} color={tokens.textSecondary} />} />
            <Text style={{ color: tokens.textMuted, fontSize: 12, marginTop: 6 }}>
              {pickedFile?.name ?? tr.noFileSelected}
            </Text>
          </View>
        ) : null}
      </View>

      {error ? (
        <View style={[styles.errorBox, { borderColor: tokens.danger, backgroundColor: tokens.bgSecondary }]}>
          <Text style={{ color: tokens.danger, fontSize: 13 }}>{error}</Text>
        </View>
      ) : null}

      {summary ? (
        <View style={[styles.summaryBox, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
          <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>{tr.summaryTitle}</Text>
          <Text style={{ color: tokens.textSecondary, fontSize: 13 }}>
            {formatMessage(tr.summaryPanelsCreated, { count: summary.panelsCreated })}
          </Text>
          <Text style={{ color: tokens.textSecondary, fontSize: 13 }}>
            {formatMessage(tr.summarySshCreated, { count: summary.sshCreated })}
          </Text>
          <Text style={{ color: summary.failures > 0 ? tokens.danger : tokens.textSecondary, fontSize: 13 }}>
            {formatMessage(tr.summaryFailures, { count: summary.failures })}
          </Text>
        </View>
      ) : null}
    </FormSheet>
  );
}

