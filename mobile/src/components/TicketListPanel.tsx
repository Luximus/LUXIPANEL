import * as React from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { Plus, RefreshCw, ChevronRight } from "lucide-react-native";
import { getTickets } from "../api/client";
import type { Ticket } from "../types/models";
import { getThemeTokens } from "../theme/colors";
import { Button } from "./ui/Button";
import { IconButton } from "./ui/IconButton";
import { ticketStrings, tkStatusLabel, tkPriorityLabel, tkFormatDate } from "./ticketHubStrings";

type Tokens = ReturnType<typeof getThemeTokens>;

function statusColor(tokens: Tokens, s: string): string {
  return s === "open" ? tokens.brandLight
    : s === "in_progress" ? tokens.warning
    : s === "resolved" ? tokens.success
    : tokens.textMuted;
}

/** Panel "Mis tickets" del hub del asistente (app RN). Espejo del web/desktop. */
export default function TicketListPanel({
  token,
  language,
  isDark,
  reloadKey,
  onOpenTicket,
  onNewTicket,
}: {
  token: string;
  language: string;
  isDark: boolean;
  reloadKey?: number;
  onOpenTicket: (id: string) => void;
  onNewTicket: () => void;
}) {
  const t = ticketStrings(language);
  const tokens = getThemeTokens(isDark);
  const [tickets, setTickets] = React.useState<Ticket[] | null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setTickets(await getTickets(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.loadError);
    } finally {
      setBusy(false);
    }
  }, [token, t.loadError]);

  React.useEffect(() => {
    void load();
  }, [load, reloadKey]);

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <View style={{ flexDirection: "row", gap: 8, padding: 10, borderBottomWidth: 1, borderBottomColor: tokens.border }}>
        <View style={{ flex: 1 }}>
          <Button variant="primary" label={t.newTicket} icon={<Plus size={16} />} onPress={onNewTicket} />
        </View>
        <IconButton variant="secondary" size={40} onPress={() => void load()} accessibilityLabel={t.loading} icon={<RefreshCw size={16} color={tokens.textMuted} />} />
      </View>

      {tickets === null ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={tokens.brand} />
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 10, gap: 8 }}
          ListEmptyComponent={
            <Text style={{ color: tokens.textMuted, textAlign: "center", marginTop: 24, fontSize: 13 }}>
              {error || t.noTickets}
            </Text>
          }
          renderItem={({ item }) => {
            const unread = item.lastResponderRole === "admin" && item.status !== "closed";
            const sc = statusColor(tokens, item.status);
            return (
              <Pressable
                onPress={() => onOpenTicket(item.id)}
                style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: tokens.border, borderRadius: 14, backgroundColor: tokens.bgCard, padding: 12 }}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: sc }}>{tkStatusLabel(t, item.status).toUpperCase()}</Text>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: tokens.textMuted }}>· {tkPriorityLabel(t, item.priority)}</Text>
                    {unread ? <Text style={{ fontSize: 11, fontWeight: "700", color: tokens.brandLight }}>· {t.awaitingYou}</Text> : null}
                  </View>
                  <Text numberOfLines={2} style={{ fontSize: 14, fontWeight: "700", color: tokens.textPrimary }}>{item.title}</Text>
                  <Text style={{ fontSize: 11, color: tokens.textMuted }}>{tkFormatDate(item.createdAt, language)}</Text>
                </View>
                <ChevronRight size={16} color={tokens.textMuted} />
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
