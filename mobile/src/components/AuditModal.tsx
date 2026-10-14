import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Modal } from "./ui/Modal";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { getPanelAudit, type ServerAuditEntry } from "../api/client";
import { getMessages } from "../i18n";

function metaSummary(meta: unknown): string {
  if (meta == null) return "—";
  if (typeof meta === "string") return meta;
  try {
    return JSON.stringify(meta);
  } catch {
    return "—";
  }
}

export function AuditModal({
  open,
  panelId,
  panelName,
  token,
  language,
  onClose,
}: {
  open: boolean;
  panelId: string | null;
  panelName?: string;
  token: string | null;
  language?: string;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const t = getMessages(language);
  const [rows, setRows] = useState<ServerAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !panelId || !token) return;
    let alive = true;
    setLoading(true);
    setError(null);
    getPanelAudit(token, panelId, 200)
      .then((data) => {
        if (alive) setRows(data);
      })
      .catch(() => {
        if (alive) setError(t.audit.error);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, panelId, token, t]);

  return (
    <Modal visible={open} onClose={onClose} title={panelName ? `${t.audit.title} — ${panelName}` : t.audit.title} language={language}>
      {loading ? (
        <ActivityIndicator size="small" color={tokens.brand} />
      ) : error ? (
        <Text style={{ color: tokens.danger }}>{error}</Text>
      ) : rows.length === 0 ? (
        <Text style={{ color: tokens.textMuted }}>{t.audit.empty}</Text>
      ) : (
        rows.map((e, idx) => (
          <View
            key={e.id}
            style={{ paddingVertical: 8, borderBottomWidth: idx === rows.length - 1 ? 0 : 1, borderBottomColor: tokens.border }}
          >
            <Text style={{ color: tokens.textPrimary, fontWeight: "600", fontSize: 13 }}>{e.action}</Text>
            <Text style={{ color: tokens.textMuted, fontSize: 12 }}>
              {new Date(e.createdAt).toLocaleString()} · {e.actor}
              {e.ip ? ` · ${e.ip}` : ""}
            </Text>
            <Text style={{ color: tokens.textSecondary, fontSize: 12 }} numberOfLines={3}>
              {metaSummary(e.meta)}
            </Text>
          </View>
        ))
      )}
    </Modal>
  );
}
