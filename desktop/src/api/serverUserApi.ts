import { callServerApi, type HttpMethod } from "./serverApi";
export interface Conversation {
  id: string;
  displayTitle: string;
  kind: "dm" | "group" | "linux-group";
  members: string[];
  unread: boolean;
  lastMessagePreview?: string;
}
export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
}
export interface Message {
  id: string;
  convId: string;
  from: string;
  fromDisplayName?: string;
  body: string;
  createdAt: string;
  editedAt?: string;
  deletedAt?: string;
  attachments: Attachment[];
  system?: { call?: { id: string } };
}
export interface Directory {
  users: Array<{
    username: string;
    displayName: string;
    online: boolean;
    status?: string;
  }>;
  groups: Array<{ name: string; members: unknown[] }>;
}
export interface CallView {
  id: string;
  convId: string;
  state: "ringing" | "active" | "ended";
  kind: "dm" | "group";
  startedBy: string;
  participants: Array<{
    id: string;
    displayName: string;
    state: string;
    lang: string;
    translate: boolean;
  }>;
  translation: { enabled: boolean; reason?: string };
}
export interface CallSession {
  call: CallView;
  token: string;
  expiresAt: number;
  wsUrl: string;
  joined: boolean;
}
export class ServerUserError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
/** Panel envelopes and bare /preferences/ui responses share this entrypoint. */
export async function userRequest<T>(
  serverId: string,
  method: HttpMethod,
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await callServerApi(serverId, "", method, path, body);
  if (!response.ok)
    throw new ServerUserError(
      response.code ?? "REQUEST_FAILED",
      response.error ?? "No se pudo completar la operación.",
    );
  const envelope = response.data as { data?: T; ok?: boolean } | undefined;
  if (envelope && Object.prototype.hasOwnProperty.call(envelope, "data"))
    return envelope.data as T;
  return response.data as T;
}
const conversationPath = (id: string) =>
  `/api/chat/conversations/${encodeURIComponent(id)}`;
export function messagingApi(serverId: string) {
  return {
    conversations: () =>
      userRequest<Conversation[]>(serverId, "GET", "/api/chat/conversations"),
    directory: () =>
      userRequest<Directory>(serverId, "GET", "/api/chat/directory"),
    messages: (id: string, before?: string) =>
      userRequest<Message[]>(
        serverId,
        "GET",
        `${conversationPath(id)}/messages?limit=100${before ? `&before=${encodeURIComponent(before)}` : ""}`,
      ),
    create: (payload: unknown) =>
      userRequest<Conversation>(
        serverId,
        "POST",
        "/api/chat/conversations",
        payload,
      ),
    send: (
      id: string,
      body: string,
      attachments: Array<{
        name: string;
        mimeType: string;
        dataBase64: string;
      }>,
    ) =>
      userRequest<Message>(
        serverId,
        "POST",
        `${conversationPath(id)}/messages`,
        { body, attachments },
      ),
    read: (id: string) =>
      userRequest(serverId, "POST", `${conversationPath(id)}/read`),
    edit: (id: string, messageId: string, body: string) =>
      userRequest<Message>(
        serverId,
        "PATCH",
        `${conversationPath(id)}/messages/${encodeURIComponent(messageId)}`,
        { body },
      ),
    remove: (id: string, messageId: string) =>
      userRequest<Message>(
        serverId,
        "DELETE",
        `${conversationPath(id)}/messages/${encodeURIComponent(messageId)}`,
      ),
    attachments: (id: string) =>
      userRequest<Attachment[]>(
        serverId,
        "GET",
        `${conversationPath(id)}/attachments`,
      ),
    transcript: (id: string, messageId: string) =>
      userRequest<{
        segments: Array<{
          text: string;
          speakerDisplayName?: string;
          translatedText?: string;
        }>;
      }>(
        serverId,
        "GET",
        `${conversationPath(id)}/messages/${encodeURIComponent(messageId)}/transcript`,
      ),
    profile: () =>
      userRequest<{ showOnline: boolean; statusMessage: string }>(
        serverId,
        "GET",
        "/api/chat/me/profile",
      ),
    saveProfile: (patch: unknown) =>
      userRequest(serverId, "PUT", "/api/chat/me/profile", patch),
    startCall: (id: string) =>
      userRequest<CallSession>(
        serverId,
        "POST",
        `${conversationPath(id)}/call`,
        {},
      ),
    call: (id: string) =>
      userRequest<CallView>(
        serverId,
        "GET",
        `/api/chat/calls/${encodeURIComponent(id)}`,
      ),
    activeCall: (id: string) =>
      userRequest<CallView | null>(
        serverId,
        "GET",
        `${conversationPath(id)}/call`,
      ),
    accept: (id: string) =>
      userRequest<CallSession>(
        serverId,
        "POST",
        `/api/chat/calls/${encodeURIComponent(id)}/accept`,
        {},
      ),
    reject: (id: string) =>
      userRequest(
        serverId,
        "POST",
        `/api/chat/calls/${encodeURIComponent(id)}/reject`,
        {},
      ),
    end: (id: string) =>
      userRequest(
        serverId,
        "POST",
        `/api/chat/calls/${encodeURIComponent(id)}/end`,
        {},
      ),
  };
}
