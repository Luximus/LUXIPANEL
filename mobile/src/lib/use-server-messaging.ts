import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  messagingApi,
  userRequest,
  type Conversation,
  type Directory,
  type Message,
} from "../api/serverUserApi";
import { trackChatActivity, publishChatPreferences } from "./chat-activity";
import { CHAT_DEFAULTS, type ChatPreferences } from "./use-server-preferences";
import { subscribeServerChat } from "./server-chat-stream";
export function useServerMessaging(serverId: string, visible: boolean) {
  const api = useMemo(() => messagingApi(serverId), [serverId]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [directory, setDirectory] = useState<Directory>({
    users: [],
    groups: [],
  });
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [groupsExpanded, setGroupsExpanded] = useState(false),
    [groupPage, setGroupPage] = useState(0);
  const groupInitialized = useRef(false);
  const [preferences, setPreferences] =
    useState<ChatPreferences>(CHAT_DEFAULTS);
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    void userRequest<ChatPreferences>(serverId, "GET", "/api/preferences/chat")
      .then((value) => {
        if (alive) {
          setPreferences(value);
          publishChatPreferences(serverId, value);
          if (!groupInitialized.current) {
            groupInitialized.current = true;
            setGroupsExpanded(!value.groups.collapsedByDefault);
          }
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [visible, serverId]);
  const [me, setMe] = useState("");
  useEffect(() => {
    let alive = true;
    void userRequest<{ username: string }>(serverId, "GET", "/api/preferences")
      .then((profile) => {
        if (alive) setMe(profile.username);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [serverId]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const current = useRef({ active, visible });
  current.current = { active, visible };
  const generation = useRef(0);
  useEffect(
    () => trackChatActivity(serverId, { convId: active, visible }),
    [serverId, active, visible],
  );
  const refresh = useCallback(async () => {
    try {
      const [rows, people] = await Promise.all([
        api.conversations(),
        api.directory(),
      ]);
      setConversations(rows);
      setDirectory(people);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }, [api]);
  useEffect(() => {
    if (!visible) return;
    void refresh();
    const timer = setInterval(() => void refresh(), 30000);
    return () => clearInterval(timer);
  }, [visible, refresh]);
  const select = useCallback(
    async (id: string) => {
      const version = ++generation.current;
      setActive(id);
      setLoading(true);
      setError("");
      try {
        const rows = await api.messages(id);
        if (version !== generation.current) return;
        setMessages(rows);
        if (current.current.visible) {
          await api.read(id);
          setConversations((previous) =>
            previous.map((row) =>
              row.id === id ? { ...row, unread: false } : row,
            ),
          );
        }
      } catch (e) {
        if (version === generation.current)
          setError(e instanceof Error ? e.message : "Error");
      } finally {
        if (version === generation.current) setLoading(false);
      }
    },
    [api],
  );
  useEffect(
    () =>
      subscribeServerChat(serverId, (event) => {
        if (event.type === "chat:message") {
          const payload = event.data as { message?: Message };
          const message = payload.message ?? (event.data as Message);
          if (message.convId === current.current.active) {
            setMessages((previous) => {
              const found = previous.some((row) => row.id === message.id);
              return found
                ? previous.map((row) => (row.id === message.id ? message : row))
                : [...previous, message];
            });
            if (current.current.visible) void api.read(message.convId);
          }
          void api
            .conversations()
            .then(setConversations)
            .catch(() => {});
        }
        if (event.type === "chat:read")
          void api
            .conversations()
            .then(setConversations)
            .catch(() => {});
      }),
    [serverId, api],
  );
  useEffect(() => {
    if (visible && active) void api.read(active).catch(() => {});
  }, [visible, active, api]);
  useEffect(
    () => () => {
      generation.current++;
    },
    [serverId],
  );
  const create = async (payload: unknown) => {
    setBusy(true);
    try {
      const conversation = await api.create(payload);
      await refresh();
      await select(conversation.id);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const older = async () => {
    const id = active,
      first = messages[0];
    if (!id || !first || busy) return;
    setBusy(true);
    const version = generation.current;
    try {
      const rows = await api.messages(id, first.createdAt);
      if (version === generation.current)
        setMessages((previous) => [
          ...rows.filter((row) => !previous.some((item) => item.id === row.id)),
          ...previous,
        ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };
  const send = async (
    attachments: Array<{
      name: string;
      mimeType: string;
      dataBase64: string;
    }> = [],
  ) => {
    const id = active;
    if (!id || busy) return false;
    const draft = drafts[id] ?? "";
    if (!draft.trim() && !attachments.length) return false;
    setBusy(true);
    try {
      const message = await api.send(id, draft, attachments);
      if (current.current.active === id)
        setMessages((previous) =>
          previous.some((row) => row.id === message.id)
            ? previous
            : [...previous, message],
        );
      setDrafts((previous) =>
        previous[id] === draft ? { ...previous, [id]: "" } : previous,
      );
      setError("");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const size = Number(preferences.groups.latestPageSize) || 5;
  const groups = conversations.filter((row) => row.kind !== "dm");
  const rows = [
    ...conversations.filter((row) => row.kind === "dm"),
    ...(groupsExpanded
      ? groups.slice(groupPage * size, (groupPage + 1) * size)
      : []),
  ];
  return {
    api,
    me,
    preferences,
    rows,
    groupsExpanded,
    setGroupsExpanded,
    groupPage,
    setGroupPage,
    groupPageCount: Math.ceil(groups.length / size),
    older,
    clearSelection: () => {
      generation.current++;
      setActive(null);
    },
    conversations,
    directory,
    active,
    messages,
    draft: active ? (drafts[active] ?? "") : "",
    setDraft: (value: string) => {
      if (active) setDrafts((previous) => ({ ...previous, [active]: value }));
    },
    select,
    create,
    send,
    refresh,
    error,
    setError,
    busy,
    loading,
    setMessages,
  };
}
