import math, struct, wave
from pathlib import Path
rate = 44100
duration = 8
notes = [130.81,130.81,155.56,174.61,130.81,196,174.61,155.56]
samples = bytearray()
for i in range(rate * duration):
    t = i / rate
    q = t % .5
    kick = math.sin(2*math.pi*(48*q + 9*(1-math.exp(-q*35)))) * math.exp(-q*19) * .55
    step = t % .25
    freq = notes[int(t*4)%len(notes)]
    bass = (math.sin(2*math.pi*freq*t) + .25*math.sin(2*math.pi*freq*2*t)) * math.exp(-step*10) * .19
    hat = (math.sin(i*1.73)+math.sin(i*2.39)) * math.exp(-step*100) * .07
    clapq = (t+.5)%1
    clap = (math.sin(i*2.71)+math.sin(i*1.19)) * math.exp(-clapq*32) * .10
    melody = math.sin(2*math.pi*freq*4*t) * math.exp(-step*15) * .075
    fade = min(1,t*12,(duration-t)*10)
    value = int(max(-1,min(1,(kick+bass+hat+clap+melody)*fade))*30000)
    samples.extend(struct.pack('<h', value))
with wave.open(str(Path(__file__).parent/'public'/'disco.wav'),'wb') as audio:
    audio.setnchannels(1); audio.setsampwidth(2); audio.setframerate(rate); audio.writeframes(samples)
