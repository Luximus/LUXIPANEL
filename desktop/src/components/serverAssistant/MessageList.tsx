import { type RefObject } from "react";
import { ArrowDown, Loader2, RefreshCw, Server, ServerOff, ShieldCheck } from "lucide-react";
import { ProviderIcon, PROVIDER_META } from "../ProviderIcon";
import { type MarkdownLabels } from "../ServerAssistantMarkdown";
import type { Messages } from "../../i18n";
import { TurnView } from "./TurnView";
import { TypingHint } from "./TypingHint";
import { StartTiles } from "./StartTiles";
import type { AssistantStrings, ChatMsg } from "./types";

/**
 * Zona de mensajes del asistente: panel de "bloqueado" (SSH sin conectar, con
 * botón aprobar-huella / refrescar), estado vacío con typewriter, los turnos y
 * el botón flotante "ir al final". El scroll lo controla el contenedor vía
 * `listRef`/`onListScroll`; aquí solo se pinta.
 */
export function MessageList({
  t,
  language,
  listRef,
  onListScroll,
  blocked,
  noData,
  isFingerprint,
  unavailableReason,
  notice,
  approvingFp,
  refreshingStatus,
  onApproveFingerprint,
  onRefreshStatus,
  token,
  messages,
  provider,
  emptyHint,
  st,
  quickReplies,
  providerLabel,
  hasActiveAgent,
  onPickQuickReply,
  onFocusComposer,
  mdLabels,
  serverUser,
  consumed,
  onConsume,
  onActionResult,
  stick,
  onJumpLatest,
}: {
  t: AssistantStrings;
  language?: string;
  listRef: RefObject<HTMLDivElement | null>;
  onListScroll: () => void;
  blocked: boolean;
  noData?: boolean;
  isFingerprint: boolean;
  unavailableReason: string | null;
  notice: string | null;
  approvingFp: boolean;
  refreshingStatus: boolean;
  onApproveFingerprint: () => void;
  onRefreshStatus: () => void;
  token: string;
  messages: ChatMsg[];
  provider: string;
  emptyHint: string[];
  /** i18n standalone (quickStart* de `StartTiles`). */
  st: Messages["serverStandalone"];
  /** Sugerencias muestreadas para las tarjetas del estado vacío. */
  quickReplies: string[];
  /** Etiqueta del proveedor activo para el título de `StartTiles`. */
  providerLabel: string;
  /** Con agente activo el estado vacío es simple (sin tarjetas). */
  hasActiveAgent: boolean;
  /** Click en una tarjeta → envía ese texto como primer mensaje. */
  onPickQuickReply: (text: string) => void;
  /** Enlace "O escribe tu mensaje abajo" → enfoca el composer. */
  onFocusComposer: () => void;
  mdLabels: MarkdownLabels;
  serverUser?: string;
  consumed: Set<string>;
  onConsume: (key: string) => void;
  onActionResult: (text: string) => void;
  stick: boolean;
  onJumpLatest: () => void;
}) {
  const providerMeta = PROVIDER_META[provider] ?? null;

  return (
    <>
      <div ref={listRef} className="server-assistant__list" onScroll={onListScroll}>
        {blocked ? (
          <div className="server-assistant__blocked">
            <ServerOff size={26} />
            <p>{unavailableReason}</p>
            {noData ? null : isFingerprint ? (
              <button type="button" className="server-assistant__approve" onClick={onApproveFingerprint} disabled={approvingFp || !token}>
                {approvingFp ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                {approvingFp ? t.approving : t.approveFp}
              </button>
            ) : (
              <button type="button" className="server-assistant__approve server-assistant__approve--ghost" onClick={onRefreshStatus} disabled={refreshingStatus || !token}>
                {refreshingStatus ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {refreshingStatus ? t.refreshing : t.refresh}
              </button>
            )}
            {notice ? <p className="server-assistant__notice">{notice}</p> : null}
          </div>
        ) : null}
        {!blocked && messages.length === 0 && !notice ? (
          hasActiveAgent ? (
            /* Con agente activo: estado vacío SIMPLE (icono del proveedor +
               typewriter), sin tarjetas de puntos de partida. */
            <div className="server-assistant__empty">
              {providerMeta ? (
                <ProviderIcon id={provider} className="server-assistant__empty-icon" style={{ fontSize: "30px", color: providerMeta.tint }} />
              ) : (
                <Server size={30} className="server-assistant__empty-icon" />
              )}
              <TypingHint phrases={emptyHint} />
            </div>
          ) : (
            /* Chat nuevo sin agente: "puntos de partida" clicables (paridad
               LUXIPANEL/app) que envían la sugerencia como primer mensaje. */
            <StartTiles
              quickReplies={quickReplies}
              providerLabel={providerLabel}
              st={st}
              onPick={onPickQuickReply}
              onFocusComposer={onFocusComposer}
            />
          )
        ) : null}
        {!blocked && messages.map((m, i) => (
          <TurnView
            key={i}
            msg={m}
            provider={provider}
            language={language}
            t={t}
            mdLabels={mdLabels}
            serverUser={serverUser}
            token={token}
            consumedKeyBase={`m${i}`}
            consumed={consumed}
            onConsume={onConsume}
            onActionResult={onActionResult}
          />
        ))}
        {!blocked && notice ? <p className="server-assistant__notice">{notice}</p> : null}
      </div>

      {!stick ? (
        <button type="button" className="server-assistant__jump" onClick={onJumpLatest} aria-label={t.jumpLatest} title={t.jumpLatest}>
          <ArrowDown size={14} />
        </button>
      ) : null}
    </>
  );
}
