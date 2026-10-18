// SPDX-License-Identifier: AGPL-3.0-only
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi, type Mock } from "vitest";
const network = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), del: vi.fn() }));
vi.mock("@/lib/api-client", async original => ({
  ...await original<Record<string, unknown>>(),
  api: { get: network.get, post: network.post, delete: network.del },
}));
import { useRealtimeVoice } from "@/components/floating-assistant/chat-pane/use-realtime-voice";
import { RealtimeRequests } from "@/components/floating-assistant/chat-pane/RealtimeRequests";
import { chatInputLocked } from "@/components/floating-assistant/chat-engine/input-lock";
import { resolveTargetScope, scopeHeaders, TARGET_SCOPE_SESSION_KEY, BRIDGE_SESSION_SESSION_KEY, CSRF_COOKIE_NAME } from "@/lib/api-client";
type Options = Parameters<typeof useRealtimeVoice>[0];
let opts: Options, current: ReturnType<typeof useRealtimeVoice>, root: Root, host: HTMLDivElement;
let mediaStop: Mock<() => void>, peerClose: Mock<() => void>;
let offer: Mock<() => Promise<{ type: string; sdp: string }>>, local: Mock<() => Promise<void>>;
type TestTrack = { enabled: boolean; stop: Mock<() => void> };
type TestStream = { getTracks: () => TestTrack[]; getAudioTracks: () => TestTrack[] };
let media: Mock<() => Promise<TestStream>>, remote: Mock<(answer: unknown) => Promise<void>>;
let streams: TestStream[], peers: TestPeer[], audios: TestAudio[];
class TestPeer {
  constructor() { peers.push(this); }
  connectionState = "new";
  ontrack?: (event: { streams: TestStream[] }) => void;
  onconnectionstatechange?: () => void;
  addTrack = vi.fn();
  createDataChannel = vi.fn();
  createOffer = offer;
  setLocalDescription = local;
  setRemoteDescription = vi.fn((answer: unknown) => remote(answer));
  close = vi.fn(() => peerClose());
}
class TestAudio {
  constructor() { audios.push(this); }
  autoplay = false;
  srcObject: TestStream | null = null;
  pause = vi.fn();
  play = vi.fn(async () => {});
}
function makeStream() {
  const track = { enabled: true, stop: vi.fn(() => mediaStop()) };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  streams.push(stream);
  return stream;
}
const ok = (data: unknown) => ({ ok: true, status: 200, data });
const requests = [
  { seq: 1, type: "permission_request", conversationId: "qa-worker", event: { id: "qa-request", tool: "files.write", title: "Cambio de prueba" } },
  { seq: 2, type: "ask", taskId: "qa-task", askedAt: "qa-when", questions: [{ id: "qa-q", type: "single", text: "Pregunta de prueba", options: ["Continuar QA"] }] },
];
function Harness() {
  current = useRealtimeVoice(opts);
  return createElement("div", null,
    createElement("button", { id: "qa-voice", onClick: current.toggle }, current.active ? "Terminar" : "Iniciar"),
    createElement(RealtimeRequests, { voice: current }));
}
const render = () => act(async () => root.render(createElement(Harness)));
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
};
const posts = () => network.post.mock.calls.map(([path, body]) => ({ path, body }));
function button(label: string) {
  const found = [...host.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent?.trim() === label);
  expect(found, "botón real: " + label).toBeDefined(); return found!;
}
async function change(patch: Partial<Options>) { opts = { ...opts, ...patch }; await render(); }
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks(); vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }); sessionStorage.clear();
  streams = []; peers = []; audios = [];
  sessionStorage.setItem(TARGET_SCOPE_SESSION_KEY, "qa-target-a");
  sessionStorage.setItem(BRIDGE_SESSION_SESSION_KEY, "qa-session-a");
  document.documentElement.lang = "es";
  document.cookie = CSRF_COOKIE_NAME + "=qa-csrf-a; path=/";
  network.get.mockImplementation(async (path: string) => ok(path.includes("/conversations/") ? { activeId: null } : { closed: false, events: requests }));
  network.post.mockResolvedValue(ok({ id: "qa-voice-a", sdp: "qa-answer" }));
  network.del.mockResolvedValue(ok({ ok: true }));
  mediaStop = vi.fn(); peerClose = vi.fn();
  offer = vi.fn(async () => ({ type: "offer", sdp: "qa-offer" })); local = vi.fn(async () => {});
  media = vi.fn(async () => makeStream()); remote = vi.fn(async (_answer: unknown) => {});
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: media } });
  vi.stubGlobal("RTCPeerConnection", TestPeer);
  vi.stubGlobal("Audio", TestAudio);
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("QA blocked external network"); }));
  opts = { enabled: true, canStart: true, chatKey: "qa-chat-a", conversationId: "qa-chat-a", ensureConversation: async () => "qa-chat-a", refresh: async () => {} };
  host = document.createElement("div"); document.body.append(host); root = createRoot(host); await render();
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); sessionStorage.clear();
  document.getElementById("messenger-link")?.remove();
  document.cookie = CSRF_COOKIE_NAME + "=; max-age=0; path=/";
  vi.useRealTimers(); vi.unstubAllGlobals();
});
async function hold(step: "createOffer" | "setLocalDescription") {
  const gate = deferred();
  if (step === "createOffer") offer.mockImplementationOnce(async () => { await gate.promise; return { type: "offer", sdp: "qa-offer" }; });
  else local.mockImplementationOnce(async () => { await gate.promise; });
  let running!: Promise<void>;
  await act(async () => { running = current.toggle(); });
  expect(step === "createOffer" ? offer : local).toHaveBeenCalledTimes(1);
  return async () => { await act(async () => { gate.resolve(); await running; }); };
}
it.each(["createOffer", "setLocalDescription"] as const)("H1: pérdida persistente durante %s impide POST", async step => {
  const finish = await hold(step);
  await change({ canStart: false }); await finish();
  expect(posts()).toEqual([]); expect(mediaStop).toHaveBeenCalled(); expect(peerClose).toHaveBeenCalled();
  expect(chatInputLocked("qa-chat-a")).toBe(false); expect(current.active).toBe(false);
});
it.each(["createOffer", "setLocalDescription"] as const)("H1: readmisión no revive el intento obsoleto durante %s", async step => {
  const finish = await hold(step);
  await change({ canStart: false }); await change({ canStart: true }); await finish();
  expect(posts()).toEqual([]); expect(current.active).toBe(false); expect(chatInputLocked("qa-chat-a")).toBe(false);
});
it.each(["createOffer", "setLocalDescription"] as const)("H1: ida y vuelta de target durante %s no revive el intento", async step => {
  const finish = await hold(step);
  sessionStorage.setItem(TARGET_SCOPE_SESSION_KEY, "qa-target-b"); await render();
  sessionStorage.setItem(TARGET_SCOPE_SESSION_KEY, "qa-target-a"); await render();
  await finish(); expect(posts()).toEqual([]);
});
it.each(["createOffer", "setLocalDescription"] as const)("H1: sesión cambiada en el mismo target durante %s invalida el intento", async step => {
  const finish = await hold(step);
  const target = resolveTargetScope(), prior = scopeHeaders(true);
  await change({ canStart: false });
  sessionStorage.setItem(BRIDGE_SESSION_SESSION_KEY, "qa-session-b");
  await change({ canStart: true });
  expect(resolveTargetScope()).toBe(target); expect(scopeHeaders(true)).not.toEqual(prior);
  await finish(); expect(posts()).toEqual([]);
});
it.each(["createOffer", "setLocalDescription"] as const)("H1: otro chat y retorno durante %s no rescatan el intento", async step => {
  const finish = await hold(step);
  await change({ chatKey: "qa-chat-b", conversationId: "qa-chat-b" });
  await change({ chatKey: "qa-chat-a", conversationId: "qa-chat-a" });
  await finish(); expect(posts()).toEqual([]);
});
async function live() {
  await act(async () => current.toggle());
  expect(current.phase).toBe("live"); expect(current.permissions).toHaveLength(1); expect(current.asks).toHaveLength(1);
  network.post.mockClear();
}
it.each(["Aprobar", "Aprobar y no preguntar más", "Continuar QA"])("H2: botón real %s no hace POST con canStart=false", async label => {
  await live(); await change({ canStart: false });
  await act(async () => button(label).click());
  expect(posts()).toEqual([]); expect(button(label).disabled).toBe(true);
});
it("H2: callbacks retenidos tampoco conceden acciones bloqueadas", async () => {
  await live(); const old = current, permission = current.permissions[0], question = current.asks[0];
  await change({ canStart: false });
  await expect(old.permission(permission, "allow")).rejects.toThrow();
  await expect(old.permission(permission, "always")).rejects.toThrow();
  await expect(old.answer(question, 0)).rejects.toThrow(); expect(posts()).toEqual([]);
});
it("Compatibilidad: Terminar real conserva cierre y libera input tras perder admisión", async () => {
  await live(); await change({ canStart: false });
  await act(async () => button("Terminar").click());
  expect(network.del).toHaveBeenCalledWith("/api/ai/realtime/sessions/qa-voice-a");
  expect(current.active).toBe(false); expect(chatInputLocked("qa-chat-a")).toBe(false); expect(posts()).toEqual([]);
});
it.each(["Aprobar", "Continuar QA"])("Compatibilidad: %s sigue permitido con admisión válida", async label => {
  await live(); await act(async () => button(label).click());
  expect(network.post).toHaveBeenCalledTimes(1);
  expect(posts()[0].path).toBe(label === "Aprobar" ? "/api/ai/agent/permission" : "/api/ai/realtime/sessions/qa-voice-a/answer");
});
it("Compatibilidad: una pregunta conservada permite un NUEVO clic tras readmisión", async () => {
  await live(); await change({ canStart: false }); await change({ canStart: true });
  await act(async () => button("Continuar QA").click());
  expect(network.post).toHaveBeenCalledTimes(1);
});

it.each(["createOffer", "setLocalDescription"] as const)("un inicio NUEVO tras readmisión sobrevive al resultado obsoleto de %s", async step => {
  const finish = await hold(step);
  const oldStream = streams[0], oldPeer = peers[0], oldAudio = audios[0];
  await change({ canStart: false }); await change({ canStart: true });
  expect(current.active).toBe(false);
  await act(async () => current.toggle());
  expect(current.phase).toBe("live");
  await finish();
  // A late event from the old WebRTC object cannot attach audio or stop the new call.
  await act(async () => {
    oldPeer.ontrack?.({ streams: [oldStream] });
    oldPeer.connectionState = "failed"; oldPeer.onconnectionstatechange?.();
    await vi.advanceTimersByTimeAsync(1500);
  });
  expect(network.post).toHaveBeenCalledTimes(1);
  expect(oldStream.getTracks()[0].stop).toHaveBeenCalled();
  expect(oldPeer.close).toHaveBeenCalled(); expect(oldPeer.setRemoteDescription).not.toHaveBeenCalled();
  expect(oldAudio.play).not.toHaveBeenCalled(); expect(oldAudio.srcObject).toBeNull();
  expect(streams[1].getTracks()[0].stop).not.toHaveBeenCalled();
  expect(peers[1].close).not.toHaveBeenCalled();
  expect(current.phase).toBe("live"); expect(current.error).toBe("");
  expect(chatInputLocked("qa-chat-a")).toBe(true);
});

it.each(["createOffer", "setLocalDescription"] as const)("la identidad de sesión invalida %s aunque canStart permanezca true", async step => {
  const finish = await hold(step), target = resolveTargetScope(), headers = scopeHeaders(true);
  sessionStorage.setItem(BRIDGE_SESSION_SESSION_KEY, "qa-session-b"); await render();
  expect(resolveTargetScope()).toBe(target); expect(scopeHeaders(true)).not.toEqual(headers);
  sessionStorage.setItem(BRIDGE_SESSION_SESSION_KEY, "qa-session-a"); await render();
  await finish();
  expect(posts()).toEqual([]); expect(current.active).toBe(false);
  expect(chatInputLocked("qa-chat-a")).toBe(false);
});

it.each(["usuario", "csrf", "proyecto"] as const)("cambiar %s invalida el intento aun conservando target y admisión", async identity => {
  const user = document.createElement("a"); user.id = "messenger-link"; user.setAttribute("data-me", "qa-user-a"); document.body.append(user);
  await change({ contextKey: "qa-project-a" });
  const finish = await hold("createOffer");
  if (identity === "usuario") user.setAttribute("data-me", "qa-user-b");
  if (identity === "csrf") document.cookie = CSRF_COOKIE_NAME + "=qa-csrf-b; path=/";
  await change(identity === "proyecto" ? { contextKey: "qa-project-b" } : {});
  await finish();
  expect(posts()).toEqual([]); expect(peerClose).toHaveBeenCalled();
  expect(chatInputLocked("qa-chat-a")).toBe(false);
});

it("un cambio de sesión detectado al resolver SDP sin render también libera el intento", async () => {
  const finish = await hold("createOffer");
  sessionStorage.setItem(BRIDGE_SESSION_SESSION_KEY, "qa-session-b");
  await finish();
  expect(posts()).toEqual([]); expect(peerClose).toHaveBeenCalled(); expect(mediaStop).toHaveBeenCalled();
  expect(chatInputLocked("qa-chat-a")).toBe(false);
});

it("el micrófono tardío se libera sin tocar los recursos del intento posterior autorizado", async () => {
  const gate = deferred(), oldStream = makeStream();
  media.mockImplementationOnce(async () => { await gate.promise; return oldStream; });
  const ensure = vi.fn(async () => "qa-chat-a"); await change({ ensureConversation: ensure });
  let pending!: Promise<void>;
  await act(async () => { pending = current.toggle(); });
  await change({ canStart: false }); await change({ canStart: true });
  await act(async () => current.toggle());
  await act(async () => { gate.resolve(); await pending; });
  expect(ensure).toHaveBeenCalledTimes(1); expect(network.post).toHaveBeenCalledTimes(1);
  expect(oldStream.getTracks()[0].stop).toHaveBeenCalled();
  expect(streams[1].getTracks()[0].stop).not.toHaveBeenCalled();
  expect(current.phase).toBe("live"); expect(chatInputLocked("qa-chat-a")).toBe(true);
});

it("el accept de creación tardía no adopta el chat del intento cancelado", async () => {
  const gate = deferred(), accepted = vi.fn(), fresh = vi.fn(async () => "qa-chat-a");
  await change({ ensureConversation: async accept => {
    await gate.promise; accepted(accept("qa-created-late")); return "qa-created-late";
  } });
  let pending!: Promise<void>;
  await act(async () => { pending = current.toggle(); });
  await change({ canStart: false }); await change({ canStart: true, ensureConversation: fresh });
  await act(async () => current.toggle());
  await act(async () => { gate.resolve(); await pending; });
  expect(accepted).toHaveBeenCalledWith(false);
  expect(network.post).toHaveBeenCalledTimes(1);
  expect(chatInputLocked("qa-created-late")).toBe(false);
  expect(chatInputLocked("qa-chat-a")).toBe(true); expect(current.phase).toBe("live");
});

it("una consulta previa tardía no crea canales ni sobrescribe la sesión nueva", async () => {
  const gate = deferred();
  network.get.mockImplementationOnce(async () => { await gate.promise; return ok({ activeId: "qa-old-remote" }); });
  let pending!: Promise<void>;
  await act(async () => { pending = current.toggle(); });
  await change({ canStart: false }); await change({ canStart: true });
  await act(async () => current.toggle());
  await act(async () => { gate.resolve(); await pending; });
  expect(peers).toHaveLength(1); expect(network.post).toHaveBeenCalledTimes(1);
  expect(current.previousId).toBeNull(); expect(current.error).toBe(""); expect(current.phase).toBe("live");
});

it.each(["readmisión", "sesión"] as const)("el POST tardío tras %s no aplica SDP ni afecta al inicio nuevo", async reason => {
  const gate = deferred();
  network.post.mockImplementationOnce(async () => { await gate.promise; return ok({ id: "qa-voice-old", sdp: "qa-late-answer" }); });
  let pending!: Promise<void>;
  await act(async () => { pending = current.toggle(); });
  if (reason === "readmisión") { await change({ canStart: false }); await change({ canStart: true }); }
  else { sessionStorage.setItem(BRIDGE_SESSION_SESSION_KEY, "qa-session-b"); await render(); }
  await act(async () => current.toggle());
  expect(current.phase).toBe("live");
  await act(async () => { gate.resolve(); await pending; });
  expect(peers[0].setRemoteDescription).not.toHaveBeenCalled();
  expect(peers[0].close).toHaveBeenCalled(); expect(peers[1].close).not.toHaveBeenCalled();
  expect(audios[0].play).not.toHaveBeenCalled(); expect(streams[1].getTracks()[0].stop).not.toHaveBeenCalled();
  expect(current.phase).toBe("live"); expect(chatInputLocked("qa-chat-a")).toBe(true);
  expect(network.post).toHaveBeenCalledTimes(2);
  if (reason === "readmisión") expect(network.del.mock.calls).toEqual([["/api/ai/realtime/sessions/qa-voice-old"]]);
  else expect(network.del).not.toHaveBeenCalled();
});

it("setRemoteDescription tardío no activa ni sondea un intento revocado y readmitido", async () => {
  const gate = deferred(); remote.mockImplementationOnce(async () => { await gate.promise; });
  let pending!: Promise<void>;
  await act(async () => { pending = current.toggle(); });
  expect(remote).toHaveBeenCalledTimes(1);
  await change({ canStart: false }); await change({ canStart: true });
  await act(async () => current.toggle());
  const reads = network.get.mock.calls.length;
  await act(async () => {
    gate.resolve(); await pending;
    peers[0].ontrack?.({ streams: [streams[0]] });
    peers[0].connectionState = "connected"; peers[0].onconnectionstatechange?.();
  });
  expect(network.get).toHaveBeenCalledTimes(reads);
  expect(audios[0].play).not.toHaveBeenCalled(); expect(audios[0].srcObject).toBeNull();
  expect(peers[0].close).toHaveBeenCalled(); expect(peers[1].close).not.toHaveBeenCalled();
  expect(current.phase).toBe("live"); expect(chatInputLocked("qa-chat-a")).toBe(true);
});

it("una sesión activa cambia de contexto sin reenviar cierre, permisos o respuestas antiguos", async () => {
  await live();
  const old = current, permission = old.permissions[0], question = old.asks[0];
  sessionStorage.setItem(BRIDGE_SESSION_SESSION_KEY, "qa-session-b"); await render();
  expect(mediaStop).toHaveBeenCalled(); expect(network.del).not.toHaveBeenCalled();
  expect(current.permissions).toEqual([]); expect(current.asks).toEqual([]);
  await act(async () => current.toggle());
  network.post.mockClear();
  await act(async () => {
    await old.permission(permission, "allow"); await old.permission(permission, "deny"); await old.answer(question, 0);
  });
  expect(posts()).toEqual([]); expect(current.permissions).toHaveLength(1); expect(current.asks).toHaveLength(1);
  expect(current.phase).toBe("live");
});

it("la respuesta tardía de una solicitud no resuelve la solicitud de otra sesión", async () => {
  await live();
  const gate = deferred(), old = current, question = old.asks[0];
  network.post.mockImplementationOnce(async () => { await gate.promise; return ok({ ok: true }); });
  let pending!: Promise<void>;
  await act(async () => { pending = old.answer(question, 0); });
  sessionStorage.setItem(BRIDGE_SESSION_SESSION_KEY, "qa-session-b"); await render();
  const refresh = vi.fn(async () => {}); await change({ refresh });
  await act(async () => current.toggle()); refresh.mockClear();
  await act(async () => { gate.resolve(); await pending; });
  expect(current.asks).toHaveLength(1); expect(refresh).not.toHaveBeenCalled();
});

it("un fallo tardío de SDP no cambia el error ni libera el input del nuevo intento", async () => {
  const gate = deferred();
  offer.mockImplementationOnce(async () => { await gate.promise; throw new Error("old offer failed"); });
  let pending!: Promise<void>;
  await act(async () => { pending = current.toggle(); });
  await change({ canStart: false }); await change({ canStart: true });
  await act(async () => current.toggle());
  await act(async () => { gate.resolve(); await pending; });
  expect(current.error).toBe(""); expect(current.phase).toBe("live");
  expect(chatInputLocked("qa-chat-a")).toBe(true); expect(peers[1].close).not.toHaveBeenCalled();
});
