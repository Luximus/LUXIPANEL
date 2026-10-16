import { EventEmitter } from "node:events";
import { afterEach,expect,it,vi } from "vitest";
import { RealtimePcmRelay } from "./realtime-pcm.js";
class Socket extends EventEmitter {
  readyState=1; bufferedAmount=0; sent:any[]=[];
  send(s:string){this.sent.push(JSON.parse(s));}
  close(){this.readyState=3;this.emit("close");}
  terminate(){this.close();} ping(){}
}
let relay:RealtimePcmRelay|undefined;
afterEach(()=>{relay?.close();});
it("accepts PCM only and never forwards tools, settings, or approvals from a phone",()=>{
  const send=vi.fn(),end=vi.fn(),ws=new Socket();
  relay=new RealtimePcmRelay(send,end);relay.attach(ws as any);
  ws.emit("message",Buffer.alloc(4800),true);
  expect(send).toHaveBeenCalledWith({type:"input_audio_buffer.append",audio:Buffer.alloc(4800).toString("base64")});
  send.mockClear();
  for(const type of ["session.update","response.create","conversation.item.create","permission_approve"])
    ws.emit("message",Buffer.from(JSON.stringify({type})),false);
  expect(send).not.toHaveBeenCalled();
  expect(()=>relay!.attach(new Socket() as any)).toThrow();
});
it("limits truncation to audio actually emitted and rejects invalid audio lengths",()=>{
  const send=vi.fn(),end=vi.fn(),ws=new Socket();
  relay=new RealtimePcmRelay(send,end);relay.attach(ws as any);
  relay.forward({type:"response.output_audio.delta",item_id:"i1",delta:Buffer.alloc(4800).toString("base64")});
  ws.emit("message",Buffer.from(JSON.stringify({type:"truncate",itemId:"forged",playedMs:50})),false);
  expect(send).not.toHaveBeenCalled();
  ws.emit("message",Buffer.from(JSON.stringify({type:"truncate",itemId:"i1",playedMs:99999})),false);
  expect(send).toHaveBeenCalledWith({type:"conversation.item.truncate",item_id:"i1",content_index:0,audio_end_ms:100});
  ws.emit("message",Buffer.alloc(3),true);expect(end).toHaveBeenCalled();
});
it("ends a broken media connection and bounds output backpressure",()=>{
  const end=vi.fn(),ws=new Socket();
  relay=new RealtimePcmRelay(vi.fn(),end);relay.attach(ws as any);
  ws.bufferedAmount=2_000_001;relay.push({type:"audio"});expect(end).toHaveBeenCalled();
});
