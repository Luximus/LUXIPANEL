import React, { useCallback, useEffect, useRef, useState } from "react";
import { getMessages } from "../../i18n";
import { loadSessionState } from "../../lib/session-state";
import { ConfirmationModal } from "./ConfirmationModal";

type Choice = { text: string; style?: "cancel" | "destructive" | "default"; onPress?: () => unknown | Promise<unknown> };
type Request = { title: string; message: string; choices: Choice[] };

/** Local to its owner: showing or cancelling never closes the surrounding UI. */
export function useConfirmation(language = loadSessionState().language) {
  const [request, setRequest] = useState<Request | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = useRef<Request | null>(null);
  const running = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (!running.current) current.current?.choices.find(choice => choice.style === "cancel")?.onPress?.();
      current.current = null;
    };
  }, []);
  const askConfirmation = useCallback((title: string, message: string, choices: Choice[]) => {
    if (current.current || running.current) return;
    current.current = { title, message, choices };
    setError("");
    setRequest(current.current);
  }, []);
  const cancel = () => {
    if (running.current) return;
    const pending = current.current;
    current.current = null;
    setRequest(null);
    pending?.choices.find(choice => choice.style === "cancel")?.onPress?.();
  };
  const submit = async () => {
    const pending = current.current;
    if (!pending || running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await pending.choices.find(choice => choice.style !== "cancel")?.onPress?.();
      if (!alive.current) return;
      if (result === false) { setError(getMessages(language).common.error); return; }
      current.current = null;
      setRequest(null);
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : getMessages(language).common.error);
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const action = request?.choices.find(choice => choice.style !== "cancel");
  const confirmation = request ? <ConfirmationModal visible title={request.title} message={request.message}
    language={language} danger={action?.style === "destructive"} submitting={busy} error={error}
    confirmLabel={action?.text ?? getMessages(language).common.accept}
    cancelLabel={request?.choices.find(choice => choice.style === "cancel")?.text ?? getMessages(language).common.cancel}
    onCancel={cancel} onConfirm={() => void submit()} /> : null;
  return { askConfirmation, confirmation };
}
