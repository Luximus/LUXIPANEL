import { serverUserText } from "../i18n/server-user-messages";
import { loadSessionState } from "./session-state";
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
import {
  WsTransport,
  resolveWsUrl,
  encodeAudioFrame,
  pcm16ToFloat,
  CLIENT_VERSION,
} from "@tolqia/client";
import { PcmFramer } from "./pcm-framer";
export async function createAudioCall(
  session: CallSession,
  baseUrl: string,
  onEvent: (event: AudioEvent) => void,
  settings: { muted: boolean; lang: string; translate: boolean },
): Promise<AudioCall> {
  // Load the native microphone module only when the user joins a call.
  const {
    AudioManager,
    AudioRecorder,
    AudioContext,
    RecordingNotificationManager,
  } = await import("react-native-audio-api");
  if ((await AudioManager.requestRecordingPermissions()) !== "Granted")
    throw new Error("Permite el micrófono para unirte a la llamada.");
  AudioManager.setAudioSessionOptions({
    iosCategory: "playAndRecord",
    iosMode: "voiceChat",
    iosOptions: ["defaultToSpeaker", "allowBluetoothHFP"],
  });
  await AudioManager.setAudioSessionActivity(true);
  const context = new AudioContext({ sampleRate: 16000 });
  const queue = context.createBufferQueueSource();
  queue.connect(context.destination);
  const recorder = new AudioRecorder();
  let closed = false,
    muted = settings.muted,
    sequence = 0,
    elapsed = 0,
    started = false;
  const buffers: string[] = [];
  queue.onBufferEnded = (event) => {
    const index = buffers.indexOf(event.bufferId);
    if (index >= 0) buffers.splice(index, 1);
  };
  const transport = new WsTransport({
    url: resolveWsUrl(session.wsUrl, baseUrl, session.token),
    handshake: () => [
      {
        type: "hello",
        clientVersion: CLIENT_VERSION,
        codecs: ["pcm16"],
        sampleRate: 16000,
      },
      { type: "mute", muted },
      { type: "language", lang: settings.lang, translate: settings.translate },
    ],
  });
  const framer = new PcmFramer();
  const close = async () => {
    if (closed) return;
    closed = true;
    transport.sendControl({ type: "leave" });
    transport.close();
    recorder.clearOnAudioReady();
    interruptions?.remove();
    pauseNotification?.remove();
    resumeNotification?.remove();
    for (const release of [
      () => recorder.stop(),
      () => queue.stop(),
      () => queue.disconnect(),
      () => queue.clearBuffers(),
    ]) {
      try {
        release();
      } catch {
        /* release remaining resources even if already stopped */
      }
    }
    await Promise.allSettled([
      context.close(),
      RecordingNotificationManager.hide(),
      AudioManager.setAudioSessionActivity(false),
    ]);
  };
  transport.on("state", (status) => {
    onEvent({ status });
    if (status !== "connected") {
      queue.clearBuffers();
      buffers.length = 0;
      framer.reset();
    }
  });
  transport.on("audio", (frame) => {
    if (closed) return;
    if (buffers.length >= 8) {
      queue.dequeueBuffer(buffers.shift()!);
    }
    const samples = pcm16ToFloat(frame.samples);
    const buffer = context.createBuffer(1, samples.length, 16000);
    buffer.copyToChannel(samples, 0, 0);
    buffers.push(queue.enqueueBuffer(buffer));
    if (!started && buffers.length >= 4) {
      queue.start();
      started = true;
    }
  });
  transport.on("control", (message) => {
    if (message.type === "caption") onEvent({ caption: message.text });
    if (message.type === "ended") {
      onEvent({ status: "ended" });
      void close();
    }
    if (message.type === "error") onEvent({ error: message.code });
  });
  transport.on("closed", (event) => {
    onEvent({ status: "closed", error: event.reason });
    void close();
  });
  recorder.onAudioReady(
    { sampleRate: 16000, bufferLength: 320, channelCount: 1 },
    ({ buffer, numFrames }) => {
      if (closed) return;
      const mono = new Float32Array(numFrames);
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const source = buffer.getChannelData(channel);
        for (let i = 0; i < numFrames; i++)
          mono[i] += (source[i] ?? 0) / buffer.numberOfChannels;
      }
      for (const samples of framer.push(mono, buffer.sampleRate)) {
        if (!muted)
          transport.sendAudio(encodeAudioFrame(sequence++, elapsed, samples));
        elapsed += 20;
      }
    },
  );
  AudioManager.observeAudioInterruptions(true);
  const interruptions = AudioManager.addSystemEventListener(
    "interruption",
    (event) => {
      if (event.type === "began") {
        recorder.pause();
        queue.pause();
        framer.reset();
        onEvent({ status: "interrupted" });
      } else if (event.shouldResume && !closed) {
        void AudioManager.setAudioSessionActivity(true)
          .then(() => {
            recorder.resume();
            queue.start();
            onEvent({ status: "active" });
          })
          .catch(() => onEvent({ error: "audio-session" }));
      }
    },
  );
  const pauseNotification = RecordingNotificationManager.addEventListener(
    "recordingNotificationPause",
    () => {
      muted = true;
      recorder.pause();
      transport.sendControl({ type: "mute", muted: true });
      onEvent({ muted: true });
    },
  );
  const resumeNotification = RecordingNotificationManager.addEventListener(
    "recordingNotificationResume",
    () => {
      muted = false;
      recorder.resume();
      transport.sendControl({ type: "mute", muted: false });
      onEvent({ muted: false });
    },
  );
  try {
    await context.resume();
    await RecordingNotificationManager.show({
      title: "LUXIPANEL",
      contentText: serverUserText(loadSessionState().language)(
        "chat.call.rowActive",
      ),
      paused: muted,
    });
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        offWelcome();
        offClosed();
        reject(new Error("No se pudo conectar la llamada."));
      }, 15000);
      const offWelcome = transport.on("control", (message) => {
        if (message.type === "welcome") {
          clearTimeout(timeout);
          offWelcome();
          offClosed();
          resolve();
        }
      });
      const offClosed = transport.on("closed", () => {
        clearTimeout(timeout);
        offWelcome();
        offClosed();
        reject(new Error("La llamada terminó."));
      });
      transport.connect();
    });
    const result = await recorder.start();
    if (result.status === "error") throw new Error(result.message);
  } catch (error) {
    await close();
    throw error;
  }
  return {
    close,
    setMuted: (value) => {
      muted = value;
      transport.sendControl({ type: "mute", muted: value });
      void RecordingNotificationManager.show({ paused: value });
    },
    setLanguage: (lang, translate) =>
      transport.sendControl({ type: "language", lang, translate }),
  };
}
