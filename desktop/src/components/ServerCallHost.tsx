import {
  initializeChatNotifications,
  useIncomingRing,
} from "../lib/server-chat-notifications";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  initializeServerCalls,
  useServerCall,
  reportCallError,
  acceptServerCall,
  rejectServerCall,
  endServerCall,
  muteServerCall,
  translateServerCall,
} from "../lib/server-calls";
import { serverUserText } from "../i18n/server-user-messages";
import { loadSessionState } from "../lib/session-state";
export function ServerCallHost() {
  useEffect(() => {
    const calls = initializeServerCalls(),
      notifications = initializeChatNotifications();
    return () => {
      notifications();
      calls();
    };
  }, []);
  const [minimized, setMinimized] = useState(false);
  const call = useServerCall(),
    t = serverUserText(loadSessionState().language);
  useIncomingRing(Boolean(call?.incoming && call.ringtone));
  if (!call) return null;
  const action = (operation: () => Promise<unknown>) => {
    void operation().catch(reportCallError);
  };
  return createPortal(
    <section
      aria-label={t("chat.call.rowActive")}
      className="fixed left-1/2 top-16 z-[30000] w-[min(90vw,600px)] -translate-x-1/2 space-y-3 rounded-2xl border border-base-300 bg-base-100 p-5 shadow-xl"
    >
      <button
        className="btn btn-ghost btn-xs float-right"
        onClick={() => setMinimized((value) => !value)}
      >
        {t(minimized ? "chat.call.expand" : "chat.call.minimize")}
      </button>
      <h2 className="font-semibold">
        {call.incoming ? t("chat.call.incoming") : t("chat.call.rowActive")}
      </h2>
      {call.incoming ? (
        <div className="flex gap-2">
          <button
            className="btn btn-primary"
            onClick={() => action(acceptServerCall)}
          >
            {t("chat.call.accept")}
          </button>
          <button
            className="btn btn-error"
            onClick={() => action(rejectServerCall)}
          >
            {t("chat.call.reject")}
          </button>
        </div>
      ) : (
        <>
          <p role="status">
            {call.status === "connecting"
              ? t("chat.call.connecting")
              : call.error
                ? t("chat.call.error")
                : call.session?.call.participants
                    .map((person) => person.displayName)
                    .join(", ")}
          </p>
          <div className="flex gap-2">
            <button className="btn" onClick={muteServerCall}>
              {t(call.muted ? "chat.call.unmute" : "chat.call.mute")}
            </button>
            <button
              className="btn btn-error"
              onClick={() => action(endServerCall)}
            >
              {t("chat.call.hangUp")}
            </button>
          </div>
          {!minimized && (
            <>
              <label className="flex items-center gap-3">
                {t("chat.settings.calls.language")}
                <input
                  className="input w-20"
                  value={call.lang}
                  onChange={(event) =>
                    translateServerCall(event.target.value, call.translate)
                  }
                />
              </label>
              <label className="flex items-center gap-3">
                <input
                  className="checkbox"
                  type="checkbox"
                  checked={call.translate}
                  onChange={(event) =>
                    translateServerCall(call.lang, event.target.checked)
                  }
                />
                {t("chat.settings.calls.translate")}
              </label>
              {call.captions.slice(-3).map((caption, index) => (
                <p key={index}>{caption}</p>
              ))}
            </>
          )}
        </>
      )}
    </section>,
    document.body,
  );
}
