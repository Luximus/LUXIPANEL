import { useEffect, useRef, useState } from "react";
import type { ModuleProps } from "../module-host";
import { useNativeModuleVisible } from "../module-visibility";
import { useServerMessaging } from "../../../lib/use-server-messaging";
import { startServerCall } from "../../../lib/server-calls";
import { downloadServerFile } from "../../../api/serverApi";
import { serverUserText } from "../../../i18n/server-user-messages";
import type { Message } from "../../../api/serverUserApi";
export function MessagingModule({ serverId, language }: ModuleProps) {
  const visible = useNativeModuleVisible(),
    chat = useServerMessaging(serverId, visible),
    t = serverUserText(language);
  const [creating, setCreating] = useState(false),
    [title, setTitle] = useState(""),
    [members, setMembers] = useState<string[]>([]),
    [query, setQuery] = useState(""),
    [editing, setEditing] = useState<Message | null>(null),
    [editBody, setEditBody] = useState(""),
    [deleting, setDeleting] = useState<Message | null>(null),
    [transcript, setTranscript] = useState("");
  const [files, setFiles] = useState<
    Record<
      string,
      Array<{ name: string; mimeType: string; dataBase64: string }>
    >
  >({});
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!visible) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (creating || editing || deleting || transcript) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (transcript) setTranscript("");
        else if (deleting) setDeleting(null);
        else if (editing) setEditing(null);
        else setCreating(false);
      }
    };
    window.addEventListener("keydown", close, true);
    return () => window.removeEventListener("keydown", close, true);
  }, [visible, creating, editing, deleting, transcript]);
  const safely = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (error) {
      chat.setError(
        error instanceof Error ? error.message : t("chat.errorLoad"),
      );
    }
  };
  const pending = chat.active ? (files[chat.active] ?? []) : [];
  const selected = chat.conversations.find((row) => row.id === chat.active);
  const download = (id: string, name: string) =>
    safely(async () => {
      const blob = await downloadServerFile(
        serverId,
        "",
        `/api/chat/attachments/${encodeURIComponent(id)}`,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  return (
    <div
      className="flex h-[calc(100dvh-10rem)] min-h-0 gap-4"
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <aside className="flex w-64 shrink-0 flex-col gap-2 overflow-auto">
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setCreating(true)}
        >
          {t("chat.newConversation")}
        </button>
        <input
          className="input w-full"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("chat.searchPlaceholder")}
        />
        {chat.rows
          .filter((row) =>
            row.displayTitle.toLowerCase().includes(query.toLowerCase()),
          )
          .map((row) => (
            <button
              key={row.id}
              onClick={() => void chat.select(row.id)}
              className={`rounded-xl p-3 text-start ${row.id === chat.active ? "bg-primary/15" : "bg-base-200"}`}
            >
              <span className={row.unread ? "font-bold" : ""}>
                {row.displayTitle}
              </span>
              <span className="block truncate text-xs opacity-60">
                {row.lastMessagePreview}
              </span>
            </button>
          ))}
        <button
          className="btn btn-ghost btn-sm"
          aria-expanded={chat.groupsExpanded}
          onClick={() => chat.setGroupsExpanded((value) => !value)}
        >
          {t("chat.sections.groups")} {chat.groupsExpanded ? "−" : "+"}
        </button>
        {chat.groupsExpanded && chat.groupPageCount > 1 && (
          <div className="flex gap-2">
            <button
              className="btn btn-xs"
              disabled={!chat.groupPage}
              onClick={() => chat.setGroupPage((value) => value - 1)}
            >
              {t("chat.pager.prev")}
            </button>
            <button
              className="btn btn-xs"
              disabled={chat.groupPage >= chat.groupPageCount - 1}
              onClick={() => chat.setGroupPage((value) => value + 1)}
            >
              {t("chat.pager.next")}
            </button>
          </div>
        )}
      </aside>
      <section className="flex min-w-0 flex-1 flex-col gap-3">
        {chat.error ? (
          <p role="alert" className="text-error">
            {chat.error}
          </p>
        ) : null}
        {selected ? (
          <>
            <header className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">{selected.displayTitle}</h2>
              <button
                className="btn btn-sm"
                onClick={() =>
                  void safely(() => startServerCall(serverId, selected.id))
                }
              >
                {t("chat.call.action")}
              </button>
            </header>
            <div className="min-h-0 flex-1 space-y-3 overflow-auto">
              <button
                className="btn btn-ghost btn-xs"
                disabled={chat.busy}
                onClick={() => void chat.older()}
              >
                {t("chat.pager.prev")}
              </button>
              {chat.messages.map((message) => (
                <article
                  key={message.id}
                  className={`rounded-xl bg-base-200 ${chat.preferences.appearance.density === "compact" ? "p-2" : "p-3"} ${chat.preferences.appearance.fontSize === "sm" ? "text-sm" : chat.preferences.appearance.fontSize === "lg" ? "text-lg" : "text-base"}`}
                >
                  <div className="text-xs opacity-60">
                    {message.fromDisplayName || t("chat.unknownUser")} ·{" "}
                    {new Date(message.createdAt).toLocaleString(language)}
                  </div>
                  <p className="whitespace-pre-wrap break-words">
                    {message.deletedAt
                      ? t("chat.deletedMessage")
                      : message.body}
                  </p>
                  {message.attachments?.map((file) => (
                    <button
                      key={file.id}
                      className="btn btn-ghost btn-xs"
                      onClick={() => void download(file.id, file.name)}
                    >
                      {file.name}
                    </button>
                  ))}
                  {!message.deletedAt && message.from === chat.me ? (
                    <div className="flex gap-2">
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => {
                          setEditing(message);
                          setEditBody(message.body);
                        }}
                      >
                        {t("chat.edit")}
                      </button>
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => setDeleting(message)}
                      >
                        {t("chat.delete")}
                      </button>
                    </div>
                  ) : null}
                  {!message.deletedAt && message.system ? (
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() =>
                        void safely(async () => {
                          const response = await chat.api.transcript(
                            selected.id,
                            message.id,
                          );
                          setTranscript(
                            response.segments
                              .map(
                                (segment) =>
                                  `${segment.speakerDisplayName ?? ""}: ${segment.text}`,
                              )
                              .join("\n") || t("chat.call.transcript.empty"),
                          );
                        })
                      }
                    >
                      {t("chat.call.transcript.open")}
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
            <div>
              {pending.map((file, index) => (
                <button
                  key={index}
                  className="btn btn-ghost btn-xs"
                  onClick={() =>
                    setFiles((previous) => ({
                      ...previous,
                      [selected.id]: pending.filter((_, i) => i !== index),
                    }))
                  }
                >
                  {file.name} ×
                </button>
              ))}
            </div>
            <textarea
              className="textarea w-full"
              value={chat.draft}
              onChange={(event) => chat.setDraft(event.target.value)}
              placeholder={t("chat.composerPlaceholder")}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  chat.preferences.general.enterSends &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  const id = selected.id;
                  void chat.send(pending).then((sent) => {
                    if (sent)
                      setFiles((previous) => ({ ...previous, [id]: [] }));
                  });
                }
              }}
            />
            <div className="flex gap-2">
              <button className="btn" onClick={() => picker.current?.click()}>
                {t("chat.attach")}
              </button>
              <button
                className="btn btn-primary"
                disabled={chat.busy}
                onClick={() => {
                  const id = selected.id;
                  void chat.send(pending).then((sent) => {
                    if (sent)
                      setFiles((previous) => ({ ...previous, [id]: [] }));
                  });
                }}
              >
                {t("chat.send")}
              </button>
            </div>
            <input
              type="file"
              ref={picker}
              hidden
              multiple
              onChange={(event) => {
                const chosen = Array.from(event.target.files ?? []),
                  id = selected.id;
                event.target.value = "";
                void safely(async () => {
                  const attached = await Promise.all(
                    chosen.map(
                      (file) =>
                        new Promise<{
                          name: string;
                          mimeType: string;
                          dataBase64: string;
                        }>((resolve, reject) => {
                          if (file.size > 15_000_000) {
                            reject(new Error("20 MB"));
                            return;
                          }
                          const reader = new FileReader();
                          reader.onerror = reject;
                          reader.onload = () =>
                            resolve({
                              name: file.name,
                              mimeType: file.type || "application/octet-stream",
                              dataBase64: String(reader.result).split(",")[1],
                            });
                          reader.readAsDataURL(file);
                        }),
                    ),
                  );
                  setFiles((previous) => ({
                    ...previous,
                    [id]: [...(previous[id] ?? []), ...attached],
                  }));
                });
              }}
            />
          </>
        ) : (
          <p className="m-auto opacity-60">{t("chat.selectConversation")}</p>
        )}
      </section>
      {creating ? (
        <div
          role="dialog"
          aria-label={t("chat.newConversation")}
          className="absolute inset-0 z-20 overflow-auto bg-base-100 p-5"
        >
          <button
            className="btn btn-sm float-right"
            onClick={() => setCreating(false)}
          >
            {t("chat.close")}
          </button>
          <h3>{t("chat.newConversation")}</h3>
          {chat.error && (
            <p role="alert" className="text-error">
              {chat.error}
            </p>
          )}
          {chat.directory.users.map((user) => (
            <div key={user.username} className="flex gap-3">
              <button
                className="btn btn-ghost"
                onClick={() =>
                  void safely(async () => {
                    const created = await chat.create({
                      kind: "dm",
                      username: user.username,
                    });
                    if (created) setCreating(false);
                  })
                }
              >
                {user.displayName || t("chat.unknownUser")}
              </button>
              <input
                type="checkbox"
                checked={members.includes(user.username)}
                aria-label={user.displayName}
                onChange={() =>
                  setMembers((previous) =>
                    previous.includes(user.username)
                      ? previous.filter((id) => id !== user.username)
                      : [...previous, user.username],
                  )
                }
              />
            </div>
          ))}
          {chat.directory.groups.map((group) => (
            <button
              key={group.name}
              className="btn"
              onClick={() =>
                void safely(async () => {
                  const created = await chat.create({
                    kind: "linux-group",
                    group: group.name,
                  });
                  if (created) setCreating(false);
                })
              }
            >
              {group.name}
            </button>
          ))}
          <input
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t("chat.newChat.customName")}
          />
          <button
            className="btn btn-primary"
            disabled={!title.trim() || !members.length}
            onClick={() =>
              void safely(async () => {
                const created = await chat.create({
                  kind: "group",
                  title,
                  members,
                });
                if (created) setCreating(false);
              })
            }
          >
            {t("chat.newChat.create")}
          </button>
        </div>
      ) : null}
      {editing ? (
        <div role="dialog" className="absolute inset-0 z-20 bg-base-100 p-5">
          {chat.error && (
            <p role="alert" className="text-error">
              {chat.error}
            </p>
          )}
          <textarea
            className="textarea w-full"
            value={editBody}
            onChange={(event) => setEditBody(event.target.value)}
          />
          <button
            className="btn btn-primary"
            onClick={() =>
              void safely(async () => {
                const updated = await chat.api.edit(
                  editing.convId,
                  editing.id,
                  editBody,
                );
                chat.setMessages((previous) =>
                  previous.map((row) =>
                    row.id === updated.id ? updated : row,
                  ),
                );
                setEditing(null);
              })
            }
          >
            {t("chat.save")}
          </button>
          <button className="btn" onClick={() => setEditing(null)}>
            {t("chat.cancel")}
          </button>
        </div>
      ) : null}
      {deleting ? (
        <div role="dialog" className="absolute inset-0 z-20 bg-base-100 p-5">
          {chat.error && (
            <p role="alert" className="text-error">
              {chat.error}
            </p>
          )}
          <button
            className="btn btn-error"
            onClick={() =>
              void safely(async () => {
                const updated = await chat.api.remove(
                  deleting.convId,
                  deleting.id,
                );
                chat.setMessages((previous) =>
                  previous.map((row) =>
                    row.id === updated.id ? updated : row,
                  ),
                );
                setDeleting(null);
              })
            }
          >
            {t("chat.delete")}
          </button>
          <button className="btn" onClick={() => setDeleting(null)}>
            {t("chat.cancel")}
          </button>
        </div>
      ) : null}
      {transcript ? (
        <div
          role="dialog"
          className="absolute inset-0 z-20 overflow-auto bg-base-100 p-5"
        >
          <button className="btn" onClick={() => setTranscript("")}>
            {t("chat.close")}
          </button>
          <pre className="whitespace-pre-wrap">{transcript}</pre>
        </div>
      ) : null}
    </div>
  );
}
