import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {createRealtimePcmAudio} from "./realtime-pcm";
class Socket {
  static all:Socket[]=[]; readyState=1;bufferedAmount=0;sent:any[]=[];
  onmessage:any;onclose:any;onerror:any;
  constructor(public url:string){Socket.all.push(this);queueMicrotask(()=>this.message({type:"ready"}));}
  message(value:any){this.onmessage?.({data:JSON.stringify(value)});}
  send(value:any){this.sent.push(value);}
  close(){this.readyState=3;this.onclose?.();}
}
let engine:Awaited<ReturnType<typeof createRealtimePcmAudio>>|undefined;
const m={onAudio:undefined as any,start:vi.fn(),stop:vi.fn(),close:vi.fn(),clear:vi.fn(),enqueue:vi.fn(),queue:{} as any};
const audio:any={
  AudioRecorder:class {onAudioReady(_o:any,fn:any){m.onAudio=fn;}clearOnAudioReady(){}start(){return m.start();}stop(){m.stop();}},
  AudioContext:class {
    destination={};close(){return m.close();}
    createBufferQueueSource(){return m.queue;}
    createBuffer(_c:number,n:number){return {copyToChannel:vi.fn(),length:n};}
  },
};
beforeEach(()=>{
  vi.clearAllMocks();Socket.all=[];vi.stubGlobal("WebSocket",Socket);
  m.start.mockResolvedValue({status:"success"});m.close.mockResolvedValue(undefined);m.enqueue.mockReturnValue("buf1");
  m.queue={connect(){},start(){},stop(){},disconnect(){},clearBuffers:m.clear,enqueueBuffer:m.enqueue,onBufferEnded:undefined};
});
afterEach(async()=>{await engine?.close();vi.unstubAllGlobals();});
it("streams PCM, mutes without releasing microphone, and renews socket without reopening native audio",async()=>{
  engine=await createRealtimePcmAudio(audio,vi.fn());await engine.connect("wss://panel/audio");
  const frame={numFrames:2,buffer:{getChannelData:()=>new Float32Array([-1,1])}};
  m.onAudio(frame);expect(Array.from(new Uint8Array(Socket.all[0].sent[0]))).toEqual([0,128,255,127]);
  engine.setMuted(true);m.onAudio(frame);expect(Socket.all[0].sent).toHaveLength(2);
  await engine.connect("wss://panel/new");expect(m.start).toHaveBeenCalledTimes(1);expect(m.stop).not.toHaveBeenCalled();
  m.onAudio(frame);expect(Socket.all[1].sent).toHaveLength(0);
});
it("clears unheard audio on interruption and reports playback bounded to completed buffers",async()=>{
  engine=await createRealtimePcmAudio(audio,vi.fn());await engine.connect("wss://panel/audio");
  const ws=Socket.all[0];ws.message({type:"audio",itemId:"i1",audio:Buffer.alloc(4800).toString("base64")});
  ws.message({type:"interrupt"});
  expect(ws.sent.map(s=>typeof s==="string"?JSON.parse(s):s)).toContainEqual({type:"truncate",itemId:"i1",playedMs:0});
  expect(m.clear).toHaveBeenCalled();
});
it("distinguishes provider renewal from network loss and frees capture on close",async()=>{
  const disconnect=vi.fn();engine=await createRealtimePcmAudio(audio,disconnect);await engine.connect("wss://panel/audio");
  Socket.all[0].message({type:"renew"});Socket.all[0].close();expect(disconnect).toHaveBeenCalledWith(true);
  await engine.close();expect(m.stop).toHaveBeenCalled();expect(m.close).toHaveBeenCalled();
});
