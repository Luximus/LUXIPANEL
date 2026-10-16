import { beforeEach, afterEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  app: {currentState:"active"}, proxy: vi.fn(), show: vi.fn(), hide: vi.fn(), media: vi.fn(),
  stop: vi.fn(), peerClose: vi.fn(), permissions: vi.fn(), track: {enabled:true,stop:vi.fn()},
}));
vi.mock("react-native", () => ({AppState:m.app,Platform:{OS:"ios",Version:18},PermissionsAndroid:{}}));
vi.mock("../../api/client", () => ({luxAssistantProxy:m.proxy}));
vi.mock("../../lib/store-reset", () => ({registerStoreReset:vi.fn()}));
vi.mock("../../lib/server-calls", () => ({getServerCallSnapshot:()=>null}));
vi.mock("../../api/serverApi", () => ({getDirect:()=>({baseUrl:"https://panel.example",jwt:"jwt"})}));
vi.mock("./realtime-pcm",()=>({createRealtimePcmAudio: async ()=>{m.media();return {connect:async()=>{},close:async()=>m.track.stop(),setMuted:(value:boolean)=>{m.track.enabled=!value;}};}}));
vi.mock("react-native-audio-api", () => ({
  AudioManager:{
    requestRecordingPermissions:m.permissions, setAudioSessionOptions:vi.fn(),
    setAudioSessionActivity:vi.fn(async()=>{}),observeAudioInterruptions:vi.fn(),
    addSystemEventListener:vi.fn(()=>({remove(){}})),
  },
  RecordingNotificationManager:{show:m.show,hide:m.hide,addEventListener:vi.fn(()=>({remove(){}}))},
}));
import {startRealtimeVoice,stopRealtimeVoice,muteRealtimeVoice} from "./realtime-voice";
import {voiceInputLocked} from "./input-lock";
const input={panelId:"panel",token:"test-token",conversationId:"chat"};
beforeEach(()=>{
  vi.clearAllMocks(); m.app.currentState="active";m.track.enabled=true;
  m.permissions.mockResolvedValue("Granted"); m.show.mockResolvedValue(undefined);m.hide.mockResolvedValue(undefined);
  m.media.mockResolvedValue({getTracks:()=>[m.track],getAudioTracks:()=>[m.track]});
  m.proxy.mockImplementation(async(_p,_t,method,path)=>{
    if(method==="DELETE")return {ok:true};
    if(path==="/api/auth/ws-token")return {token:"ws-token"};
    if(path.includes("/conversations/"))return {ok:true,activeId:null};
    if(method==="POST")return {ok:true,id:"voice1",sdp:"answer"};
    return {ok:true,closed:false,events:[]};
  });
});
afterEach(async()=>{await stopRealtimeVoice();});
it("requires foreground start before opening microphone or provider",async()=>{
  m.app.currentState="background";
  await expect(startRealtimeVoice(input)).rejects.toThrow("abierta");
  expect(m.media).not.toHaveBeenCalled();expect(m.proxy).not.toHaveBeenCalled();
});
it("keeps microphone and text exclusion in background; muting does not unlock text",async()=>{
  await startRealtimeVoice(input);
  expect(voiceInputLocked("panel")).toBe(true); expect(m.show).toHaveBeenCalled();
  m.app.currentState="background"; muteRealtimeVoice(true);
  expect(m.track.enabled).toBe(false);expect(voiceInputLocked("panel")).toBe(true);
  expect(m.track.stop).not.toHaveBeenCalled();
  await stopRealtimeVoice();
  expect(m.track.stop).toHaveBeenCalled();expect(voiceInputLocked("panel")).toBe(false);
  expect(m.proxy.mock.calls.some(call=>String(call[3]).includes("/cancel"))).toBe(false);
});
it("does not create a call when microphone permission is refused",async()=>{
  m.permissions.mockResolvedValue("Denied");
  await startRealtimeVoice(input);
  expect(m.media).not.toHaveBeenCalled();expect(m.proxy).not.toHaveBeenCalled();
  expect(voiceInputLocked("panel")).toBe(false);
});
it("checks a previous unconfirmed session before creating another call",async()=>{
  m.proxy.mockResolvedValue({ok:true,activeId:"previous"});
  await startRealtimeVoice(input);
  expect(m.proxy.mock.calls.some(call=>call[2]==="POST")).toBe(false);
  expect(m.track.stop).toHaveBeenCalled();
});

it("renews a background call without reopening the microphone or enabling text",async()=>{
  vi.useFakeTimers();
  try {
    await startRealtimeVoice(input);
    m.app.currentState="background";
    const original=m.proxy.getMockImplementation()!;
    let renewed=false;
    m.proxy.mockImplementation(async(...args)=>{
      if(args[2]==="GET" && String(args[3]).includes("/realtime/sessions/") && !renewed) {
        renewed=true;
        return {ok:true,closed:true,events:[{seq:1,type:"renew"}]};
      }
      return original(...args);
    });
    await vi.advanceTimersByTimeAsync(2000);
    expect(m.proxy.mock.calls.filter(call=>call[2]==="POST")).toHaveLength(2);
    expect(m.media).toHaveBeenCalledTimes(1);
    expect(m.permissions).toHaveBeenCalledTimes(1);
    expect(m.track.stop).not.toHaveBeenCalled();
    expect(voiceInputLocked("panel")).toBe(true);
  } finally {
    await stopRealtimeVoice();
    vi.useRealTimers();
  }
});
