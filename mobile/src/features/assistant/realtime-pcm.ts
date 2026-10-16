import type * as Audio from "react-native-audio-api";
export type RealtimePcmAudio = {connect(url: string): Promise<void>; close(): Promise<void>; setMuted(value: boolean): void};
/** Uses the audio engine already included in the QR development client. */
export async function createRealtimePcmAudio(audio: typeof Audio, onDisconnect: (renew: boolean) => void): Promise<RealtimePcmAudio> {
  const context = new audio.AudioContext({sampleRate:24000});
  const recorder = new audio.AudioRecorder();
  let queue = context.createBufferQueueSource();
  queue.connect(context.destination); queue.start();
  let socket: WebSocket | undefined, generation=0, closed=false, muted=false;
  let pending: {id:string;itemId:string;ms:number}[]=[];
  const played = new Map<string,number>();
  let queuedMs=0;
  const trackQueue = () => {
    queue.onBufferEnded = e => {
      const index=pending.findIndex(p=>p.id===e.bufferId);
      if(index<0)return;
      const row=pending.splice(index,1)[0]; queuedMs=Math.max(0,queuedMs-row.ms);
      played.set(row.itemId,(played.get(row.itemId)??0)+row.ms);
      if(played.size>12)played.delete(played.keys().next().value!);
    };
  };
  trackQueue();
  const clearAudio=()=>{
    queue.clearBuffers();pending=[];queuedMs=0;
  };
  const close=async()=>{
    if(closed)return; closed=true;generation++;
    socket?.close();recorder.clearOnAudioReady();
    for(const fn of [()=>recorder.stop(),()=>queue.stop(),()=>queue.disconnect(),()=>queue.clearBuffers()]) {
      try{fn();}catch{/* release all resources */}
    }
    await context.close();
  };
  recorder.onAudioReady({sampleRate:24000,bufferLength:2400,channelCount:1},({buffer,numFrames})=>{
    if(closed||muted||socket?.readyState!==1)return;
    if(socket.bufferedAmount>48000){socket.close();return;}
    const pcm=new ArrayBuffer(numFrames*2),view=new DataView(pcm);
    const samples=buffer.getChannelData(0);
    for(let i=0;i<numFrames;i++){
      const value=Math.max(-1,Math.min(1,samples[i]??0));
      view.setInt16(i*2,value<0?value*32768:value*32767,true);
    }
    socket.send(pcm);
  });
  try {const result=await recorder.start();if(result.status==="error")throw new Error(result.message);}
  catch(error){await close();throw error;}
  return {
    close,
    setMuted(value){muted=value;if(value&&socket?.readyState===1)socket.send(JSON.stringify({type:"mute"}));},
    async connect(url){
      const current=++generation;socket?.close();clearAudio();
      if(closed)throw new Error("La voz terminó.");
      const ws=socket=new WebSocket(url); let renewing=false;
      await new Promise<void>((resolve,reject)=>{
        let ready=false;
        const timer=setTimeout(()=>{reject(new Error("El audio no respondió a tiempo."));ws.close();},15000);
        ws.onmessage=event=>{
          if(closed||current!==generation)return;
          try{
            const msg=JSON.parse(String(event.data));
            if(msg.type==="ready"){ready=true;clearTimeout(timer);resolve();}
            else if(msg.type==="renew"){renewing=true;}
            else if(msg.type==="interrupt"){
              const items=[...new Set(pending.map(p=>p.itemId))];clearAudio();
              for(const itemId of items)ws.send(JSON.stringify({type:"truncate",itemId,playedMs:played.get(itemId)??0}));
            } else if(msg.type==="audio"&&typeof msg.audio==="string"){
              const raw=atob(msg.audio);
              if(raw.length%2||raw.length>96000)throw new Error("Audio inválido");
              const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0)),view=new DataView(bytes.buffer);
              const samples=new Float32Array(bytes.length/2);
              for(let i=0;i<samples.length;i++)samples[i]=view.getInt16(i*2,true)/32768;
              const ms=samples.length/24;
              if(queuedMs+ms>30000){ws.close();return;}
              const buffer=context.createBuffer(1,samples.length,24000);buffer.copyToChannel(samples,0,0);
              pending.push({id:queue.enqueueBuffer(buffer),itemId:String(msg.itemId),ms});queuedMs+=ms;
            }
          }catch{reject(new Error("No se pudo reproducir el audio."));ws.close();}
        };
        ws.onerror=()=>{clearTimeout(timer);reject(new Error("No se pudo conectar el audio."));};
        ws.onclose=()=>{
          clearTimeout(timer);
          if(closed||current!==generation)return;
          clearAudio();
          if(!ready)reject(new Error("La conexión de audio terminó."));
          else onDisconnect(renewing);
        };
      });
    },
  };
}
