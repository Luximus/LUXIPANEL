"""Verify actual native Kling speech locally; this never synthesizes speech."""
from pathlib import Path
import json, subprocess, sys, os, wave
import numpy as np
os.environ['HF_HUB_DISABLE_XET']='1'
os.environ['HF_HUB_DISABLE_IMPLICIT_TOKEN']='1'
from faster_whisper import WhisperModel

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'out'/'kling30'
source=OUT/'01-infrastructure-ai.mp4'
if not source.exists():raise RuntimeError('The actual Higgsfield first video has not been delivered')
audio=OUT/'native-master-voice.wav'
subprocess.run(['ffmpeg','-v','error','-nostdin','-threads','1','-i',str(source),'-vn','-ac','1','-ar','16000','-c:a','pcm_s16le','-y',str(audio)],check=True)
model=WhisperModel('small',device='cpu',compute_type='int8',cpu_threads=2,download_root=str(OUT/'whisper-models'))
with wave.open(str(audio),'rb') as wav:
 samples=np.frombuffer(wav.readframes(wav.getnframes()),dtype=np.int16).astype(np.float32)/32768
segments,info=model.transcribe(samples,language='es',beam_size=5,word_timestamps=True,vad_filter=False,condition_on_previous_text=False,initial_prompt='LUXIPANEL. Agentes de IA. Android. Luxipanel punto com.')
records=[]
for s in segments:
 records.append({'start':s.start,'end':s.end,'text':s.text.strip(),'averageLogProbability':s.avg_logprob,'noSpeechProbability':s.no_speech_prob,'words':[{'start':w.start,'end':w.end,'word':w.word.strip(),'probability':w.probability} for w in (s.words or [])]})
report={'source':'Native audio of actual first Higgsfield Kling 3.0 Standard generation','sourceVideo':str(source),'audio':str(audio),'transcriptionModel':'Whisper small multilingual, local CPU','language':info.language,'duration':info.duration,'transcript':' '.join(s['text'] for s in records),'segments':records,'accepted':False,'acceptanceStatus':'Requires inspection of actual speech and script coverage','generatedTtsUsed':False}
(OUT/'native-narration-transcription.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'transcript':report['transcript'],'segments':[{k:v for k,v in s.items() if k!='words'} for s in records],'accepted':False},ensure_ascii=False),flush=True)
