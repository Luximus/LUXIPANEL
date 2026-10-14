import * as React from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { RefreshCw, X } from "lucide-react-native";
import { getAssistantTasks, cancelAssistantTask, ackAssistantTask, type AssistantTask } from "../api/client";
import { getThemeTokens } from "../theme/colors";
import { IconButton } from "./ui/IconButton";
import { ticketStrings, tkTaskLabel, tkFormatDate } from "./ticketHubStrings";

type Tokens = ReturnType<typeof getThemeTokens>;

function statusColor(tokens: Tokens, s: string): string {
  return s === "pending" ? tokens.brandLight
    : s === "running" ? tokens.warning
    : s === "done" ? tokens.success
    : s === "error" ? tokens.danger
    : tokens.textMuted;
}

/**
 * Panel "Tareas" del hub del asistente (app RN). Espejo del web/desktop: lista los
 * comandos al agente del servidor que corren en background, con estado y
 * resultado. Al abrirlo marca como leídas las terminadas (limpia el badge).
 */
export default function TasksPanel({
  token,
  language,
  isDark,
  reloadKey,
  onUnreadChange,
}: {
  token: string;
  language: string;
  isDark: boolean;
  reloadKey?: number;
  onUnreadChange?: (n: number) => void;
}) {
  const t = ticketStrings(language);
  const tokens = getThemeTokens(isDark);
  const [tasks, setTasks] = React.useState<AssistantTask[] | null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const res = await getAssistantTasks(token);
      setTasks(res.tasks);
      const unreadIds = res.tasks.filter((x) => x.unread).map((x) => x.id);
      if (unreadIds.length > 0) {
        await Promise.all(unreadIds.map((id) => ackAssistantTask(id, token)));
        onUnreadChange?.(0);
      } else {
        onUnreadChange?.(res.unread);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.tasksLoadError);
    } finally {
      setBusy(false);
    }
  }, [token, t.tasksLoadError, onUnreadChange]);

  React.useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const cancel = React.useCallback(
    async (id: string) => {
      await cancelAssistantTask(id, token);
      void load();
    },
    [token, load],
  );

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <View style={{ flexDirection: "row", justifyContent: "flex-end", padding: 10, borderBottomWidth: 1, borderBottomColor: tokens.border }}>
        <IconButton variant="secondary" size={40} onPress={() => void load()} accessibilityLabel={t.loading} icon={<RefreshCw size={16} color={tokens.textMuted} />} />
      </View>

      {tasks === null ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={tokens.brand} />
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 10, gap: 8 }}
          ListEmptyComponent={
            <Text style={{ color: tokens.textMuted, textAlign: "center", marginTop: 24, fontSize: 13 }}>
              {error || t.noTasks}
            </Text>
          }
          renderItem={({ item }) => {
            const sc = statusColor(tokens, item.status);
            return (
              <View style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 14, backgroundColor: tokens.bgCard, padding: 12, gap: 6 }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: sc }}>{tkTaskLabel(t, item.status).toUpperCase()}</Text>
                  {item.panel ? <Text style={{ fontSize: 11, color: tokens.textMuted }}>· {item.panel}</Text> : null}
                </View>
                <Text style={{ fontSize: 14, fontWeight: "700", color: tokens.textPrimary }}>{item.instruction}</Text>
                {item.status === "done" && item.result ? (
                  <View style={{ borderRadius: 8, borderWidth: 1, borderColor: tokens.border, padding: 8 }}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: tokens.textMuted, marginBottom: 2 }}>{t.taskResult.toUpperCase()}</Text>
                    <Text selectable style={{ fontSize: 12, color: tokens.textPrimary, fontFamily: "monospace" }}>{item.result}</Text>
                  </View>
                ) : null}
                {item.status === "error" && item.error ? (
                  <View style={{ borderRadius: 8, borderWidth: 1, borderColor: tokens.danger, padding: 8 }}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: tokens.danger, marginBottom: 2 }}>{t.taskErrorDetail.toUpperCase()}</Text>
                    <Text selectable style={{ fontSize: 12, color: tokens.textPrimary }}>{item.error}</Text>
                  </View>
                ) : null}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 11, color: tokens.textMuted }}>{tkFormatDate(item.createdAt, language)}</Text>
                  {item.status === "pending" ? (
                    <Pressable onPress={() => void cancel(item.id)} accessibilityLabel={t.cancel} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <X size={14} color={tokens.textMuted} />
                      <Text style={{ fontSize: 12, color: tokens.textMuted }}>{t.cancel}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
