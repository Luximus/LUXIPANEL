import type { CallSession } from "../api/serverUserApi";
export type AudioCall = {
  close: () => Promise<void>;
  setMuted: (value: boolean) => void;
  setLanguage: (lang: string, translate: boolean) => void;
};
type AudioEvent = {
  status?: string;
  caption?: string;
  error?: string;
  muted?: boolean;
};
import { createCallClient } from "@tolqia/client";
export async function createAudioCall(
  session: CallSession,
  baseUrl: string,
  onEvent: (event: AudioEvent) => void,
  settings: { muted: boolean; lang: string; translate: boolean },
): Promise<AudioCall> {
  const client = createCallClient({
    wsUrl: session.wsUrl,
    baseUrl,
    token: session.token,
    startMuted: settings.muted,
  });
  client.on("state", (state) =>
    onEvent({
      status: state.joined
        ? state.connection === "connected"
          ? "active"
          : state.connection
        : state.meetingEnded || state.removed
          ? "ended"
          : state.connection,
      muted: state.muted,
    }),
  );
  client.on("caption", (caption) => onEvent({ caption: caption.text }));
  client.on("error", (error) => onEvent({ error: error.code }));
  client.setLanguage(settings.lang, settings.translate);
  try {
    await client.join();
  } catch (error) {
    await client.close();
    throw error;
  }
  return {
    close: () => client.leave(),
    setMuted: (value) => client.setMuted(value),
    setLanguage: (lang, translate) => client.setLanguage(lang, translate),
  };
}
