import { type RefObject } from "react";
import { Paperclip, Send, Square, X } from "lucide-react";
import type { AssistantStrings } from "./types";

/**
 * Barra de composición: adjuntar archivo, textarea autoexpandible (Enter envía,
 * Shift+Enter salto de línea) y botón enviar/detener según `busy`. Bloqueada
 * cuando el SSH no conecta (`blocked`), con el motivo como placeholder.
 */
export function Composer({
  t,
  busy,
  token,
  blocked,
  input,
  attachment,
  unavailableReason,
  fileRef,
  taRef,
  onSubmit,
  onInputChange,
  onPickFile,
  onRemoveAttachment,
  onStop,
  onFocus,
}: {
  t: AssistantStrings;
  busy: boolean;
  token: string;
  blocked: boolean;
  input: string;
  attachment: { name: string; dataBase64: string } | null;
  unavailableReason: string | null;
  fileRef: RefObject<HTMLInputElement | null>;
  taRef: RefObject<HTMLTextAreaElement | null>;
  onSubmit: () => void;
  onInputChange: (value: string) => void;
  onPickFile: (file: File | null) => void;
  onRemoveAttachment: () => void;
  onStop: () => void;
  onFocus: () => void;
}) {
  return (
    <form
      className="server-assistant__composer"
      onSubmit={(event) => { event.preventDefault(); onSubmit(); }}
    >
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={(e) => { onPickFile(e.target.files?.[0] ?? null); e.target.value = ""; }}
      />
      <button
        type="button"
        className="lp-icon-btn tooltip tooltip-top"
        onClick={() => fileRef.current?.click()}
        disabled={busy || !token || blocked}
        aria-label={t.attach}
        data-tip={t.attach}
      >
        <Paperclip size={15} />
      </button>
      <div className="server-assistant__input-wrap">
        {attachment ? (
          <span className="server-assistant__chip">
            <Paperclip size={12} className="inline mr-1" />{attachment.name}
            <button type="button" onClick={onRemoveAttachment} aria-label="x"><X size={11} /></button>
          </span>
        ) : null}
        <textarea
          ref={taRef}
          rows={1}
          className="server-assistant__input"
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
            }
          }}
          onFocus={onFocus}
          placeholder={blocked ? unavailableReason ?? t.unavailGeneric : t.placeholder}
          disabled={busy || !token || blocked}
        />
      </div>
      {busy ? (
        <button
          type="button"
          className="lp-icon-btn server-assistant__stop tooltip tooltip-top"
          onClick={onStop}
          aria-label={t.stop}
          data-tip={t.stop}
        >
          <Square size={13} />
        </button>
      ) : (
        <button
          type="submit"
          className="lp-icon-btn tooltip tooltip-top"
          disabled={(!input.trim() && !attachment) || !token || blocked}
          aria-label={t.send}
          data-tip={t.send}
        >
          <Send size={15} />
        </button>
      )}
    </form>
  );
}
