import { Bot, Check, Loader2, Paperclip, Terminal as TerminalIcon, X } from "lucide-react";
import { ProviderIcon, PROVIDER_META } from "../ProviderIcon";
import { MessageContent, type MarkdownLabels } from "../ServerAssistantMarkdown";
import { AssistantActionCard } from "../AssistantActionCard";
import { stripAnsi } from "../../lib/strip-ansi";
import { formatDuration, formatTime, formatTokens } from "./format";
import type { AssistantStrings, ChatMsg } from "./types";

/** Tres puntos pulsantes hasta el primer delta (port de PendingDot de LUXIPANEL). */
export function PendingDot() {
  return (
    <span className="server-assistant__typing" aria-hidden>
      <span className="animate-pulse">•</span>
      <span className="animate-pulse [animation-delay:150ms]">•</span>
      <span className="animate-pulse [animation-delay:300ms]">•</span>
    </span>
  );
}

/** Meta del turno: hora · duración · tokens (port de TurnMeta de LUXIPANEL). */
export function TurnMeta({ msg, language, t }: { msg: ChatMsg; language?: string; t: AssistantStrings }) {
  if (msg.pending || !msg.at) return null;
  const isUser = msg.role === "user";
  return (
    <span className={`server-assistant__turn-meta ${isUser ? "server-assistant__turn-meta--user" : ""}`}>
      <span className="tabular-nums">{formatTime(msg.at, language)}</span>
      {!isUser && typeof msg.durationMs === "number" ? (
        <>
          <span aria-hidden>·</span>
          <span className="tabular-nums" title={t.durationTitle}>{formatDuration(msg.durationMs)}</span>
        </>
      ) : null}
      {!isUser && msg.tokens && msg.tokens.total > 0 ? (
        <>
          <span aria-hidden>·</span>
          <span
            className="tabular-nums"
            title={`${t.tokensTitle} — in ${msg.tokens.input.toLocaleString()} / out ${msg.tokens.output.toLocaleString()}${msg.tokens.estimated ? " (~)" : ""}`}
          >
            {formatTokens(msg.tokens.total)}{msg.tokens.estimated ? "~" : ""} tok
          </span>
        </>
      ) : null}
    </span>
  );
}

/**
 * Un turno del chat, estilo LUXIPANEL: usuario a la derecha (burbuja índigo con
 * la esquina sup-der recortada, meta de hora); asistente a la izquierda con
 * avatar cuadrado redondeado del proveedor + header hora · duración · tokens y
 * burbuja muted de ancho completo con la esquina sup-izq recortada.
 */
export function TurnView({
  msg,
  provider,
  language,
  t,
  mdLabels,
  serverUser,
  token,
  consumedKeyBase,
  consumed,
  onConsume,
  onActionResult,
}: {
  msg: ChatMsg;
  provider: string;
  language?: string;
  t: AssistantStrings;
  mdLabels: MarkdownLabels;
  serverUser?: string;
  token: string;
  consumedKeyBase: string;
  consumed: Set<string>;
  onConsume: (key: string) => void;
  onActionResult: (text: string) => void;
}) {
  const isUser = msg.role === "user";
  const providerMeta = PROVIDER_META[provider] ?? null;

  if (isUser) {
    return (
      <div className="server-assistant__turn server-assistant__turn--user">
        <div className="server-assistant__bubble server-assistant__bubble--user" title={serverUser || t.you}>
          {msg.content ? <MessageContent text={msg.content} labels={mdLabels} /> : null}
          {msg.attachmentName ? (
            <span className="server-assistant__att"><Paperclip size={12} className="inline mr-1" />{msg.attachmentName}</span>
          ) : null}
          <TurnMeta msg={msg} language={language} t={t} />
        </div>
      </div>
    );
  }

  return (
    <div className="server-assistant__turn">
      <div className="server-assistant__turn-head">
        <span
          className="server-assistant__turn-avatar"
          style={providerMeta ? { background: `color-mix(in srgb, ${providerMeta.tint} 14%, transparent)`, color: providerMeta.tint } : undefined}
          aria-hidden
        >
          {providerMeta ? <ProviderIcon id={provider} style={{ fontSize: "0.85rem" }} /> : <Bot size={13} />}
        </span>
        <TurnMeta msg={msg} language={language} t={t} />
      </div>
      <div className="server-assistant__bubble server-assistant__bubble--assistant">
        {msg.content
          ? (msg.cli
            ? <pre className="server-assistant__term-body server-assistant__term-body--history">{stripAnsi(msg.content)}</pre>
            : <MessageContent text={stripAnsi(msg.content)} labels={mdLabels} />)
          : msg.pending && !(msg.tools?.length)
            ? <PendingDot />
            : null}
        {(msg.tools ?? []).length > 0 ? (
          <div className="server-assistant__tools">
            {(msg.tools ?? []).map((tool) => {
              const isCli = tool.name.endsWith(".cli");
              return (
                <details key={tool.id} className="server-assistant__tool" open={isCli && !tool.done}>
                  <summary className="server-assistant__tool-sum">
                    {!tool.done
                      ? <Loader2 size={11} className="animate-spin" />
                      : tool.success
                        ? <Check size={11} className="text-emerald-500" />
                        : <X size={11} className="text-amber-500" />}
                    {isCli ? <TerminalIcon size={11} /> : null}
                    <span className="font-mono">{tool.name}</span>
                  </summary>
                  {isCli ? (
                    <div className="server-assistant__term">
                      {tool.output ? <pre className="server-assistant__term-body">{stripAnsi(tool.output)}</pre> : null}
                    </div>
                  ) : tool.output ? (
                    <pre className="server-assistant__tool-pre">{stripAnsi(tool.output)}</pre>
                  ) : null}
                </details>
              );
            })}
          </div>
        ) : null}
        {(msg.actions ?? []).map((a, idx) => {
          if (a.type !== "client_action") return null;
          const key = `${consumedKeyBase}:${idx}`;
          return (
            <AssistantActionCard
              key={key}
              action={a}
              token={token}
              language={language ?? "es"}
              disabled={consumed.has(key)}
              onResult={onActionResult}
              onDone={() => onConsume(key)}
            />
          );
        })}
      </div>
    </div>
  );
}
