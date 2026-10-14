import React from 'react';
import {AbsoluteFill, Audio, Composition, registerRoot, staticFile, useCurrentFrame} from 'remotion';

const Cat = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  const beat = t * Math.PI * 4;
  const sway = Math.sin(beat / 2);
  const bounce = Math.abs(Math.sin(beat)) * 24;
  const arm = Math.sin(beat / 2) * 35;
  return <AbsoluteFill style={{background:'#160d35'}}>
    <Audio src={staticFile('disco.wav')} volume={0.75}/>
    <svg viewBox="0 0 720 960" width="720" height="960">
      <defs>
        <radialGradient id="bg"><stop stopColor="#672d88"/><stop offset="1" stopColor="#130d2d"/></radialGradient>
        <linearGradient id="fur" x2="0.9" y2="1"><stop stopColor="#ffc36d"/><stop offset="1" stopColor="#ed833f"/></linearGradient>
        <radialGradient id="halo"><stop stopColor="#fb8ae5" stopOpacity=".4"/><stop offset="1" stopColor="#fb8ae5" stopOpacity="0"/></radialGradient>
      </defs>
      <rect width="720" height="960" fill="url(#bg)"/>
      <circle cx="360" cy="510" r="380" fill="url(#halo)"/>
      {[0,1,2,3].map(i=><path key={i} d={`M ${i%2?630:90} 0 L ${160+i*115+Math.sin(t+i)*90} 770 L ${270+i*115+Math.sin(t+i)*90} 770 Z`} fill={i%2?'#58ebe6':'#f16cde'} opacity={0.045+0.025*Math.sin(beat+i)}/>)}
      <g transform={`translate(360 120) rotate(${t*9})`}>
        <circle r="59" fill="#bcc1ec"/>
        {Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>{
          const x=(c-4)*12,y=(r-4)*12;
          return x*x+y*y<2800?<rect key={`${r}-${c}`} x={x-5} y={y-5} width="10" height="10" rx="1" fill={(r+c)%3===0?'#ffffff':(r+c)%3===1?'#a282de':'#68dfe5'}/>:null;
        }))}
      </g>
      <path d="M360 0 V60" stroke="#c0a7df" strokeWidth="3"/>
      <text x="360" y="255" textAnchor="middle" fill="#ffedc8" fontFamily="sans-serif" fontSize="48" fontWeight="900" letterSpacing="7">MIAU DISCO</text>
      <text x="360" y="295" textAnchor="middle" fill="#ceafd9" fontFamily="sans-serif" fontSize="16" letterSpacing="5">EL RITMO ES FELINO</text>
      <path d="M0 770 H720 V960 H0Z" fill="#241344"/>
      {Array.from({length:5},(_,row)=>Array.from({length:8},(_,col)=><rect key={`${row}-${col}`} x={col*94-16} y={778+row*39} width="86" height="31" rx="4" fill={['#c04cb9','#4acbc7','#9867df','#fcbd69'][(row+col+Math.floor(t*2))%4]} opacity={0.2+0.13*Math.sin(beat+row+col)}/>))}
      <ellipse cx={360+sway*34} cy="781" rx={103-bounce*.6} ry="18" fill="#100921" opacity=".7"/>
      <g transform={`translate(${360+sway*34} ${600-bounce}) rotate(${sway*7})`} stroke="#64354b" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d={`M65 80 C 190 85, ${150+sway*35} -80, ${108+sway*25} -43`} fill="none" stroke="#eb9145" strokeWidth="29"/>
        <path d={`M65 80 C 190 85, ${150+sway*35} -80, ${108+sway*25} -43`} fill="none" stroke="#ffc36d" strokeWidth="14"/>
        <g transform={`translate(-43 98) rotate(${sway*22})`}><path d="M0 0 L-12 59" stroke="#ef994d" strokeWidth="34"/><ellipse cx="-23" cy="62" rx="32" ry="19" fill="#ffd495"/></g>
        <g transform={`translate(43 98) rotate(${-sway*22})`}><path d="M0 0 L12 59" stroke="#ef994d" strokeWidth="34"/><ellipse cx="23" cy="62" rx="32" ry="19" fill="#ffd495"/></g>
        <ellipse cy="23" rx="80" ry="103" fill="url(#fur)"/>
        <ellipse cy="46" rx="49" ry="65" fill="#ffe0aa" stroke="none"/>
        <g transform={`translate(-66 -23) rotate(${-38+arm})`}><path d="M0 0 Q-49 -16 -70 -76" fill="none" stroke="#f7ab58" strokeWidth="30"/><ellipse cx="-70" cy="-82" rx="21" ry="24" fill="#ffca80"/><path d="M-79 -88 V-79 M-69 -91 V-81" strokeWidth="3"/></g>
        <g transform={`translate(66 -23) rotate(${38+arm})`}><path d="M0 0 Q49 -16 70 -76" fill="none" stroke="#f7ab58" strokeWidth="30"/><ellipse cx="70" cy="-82" rx="21" ry="24" fill="#ffca80"/><path d="M79 -88 V-79 M69 -91 V-81" strokeWidth="3"/></g>
        <g transform={`translate(0 -120) rotate(${-sway*10})`}>
          <path d="M-86 -32 L-82 -108 L-25 -67 M86 -32 L82 -108 L25 -67" fill="#f7ad5a"/>
          <path d="M-71 -62 L-69 -91 L-45 -65 M71 -62 L69 -91 L45 -65" fill="#f098a3" stroke="none"/>
          <ellipse rx="102" ry="80" fill="url(#fur)"/>
          <path d="M-27 -73 L-18 -53 M0 -77 V-53 M27 -73 L18 -53" stroke="#ce743a" strokeWidth="9"/>
          <ellipse cx="-42" cy="22" rx="27" ry="16" fill="#f79080" opacity=".6" stroke="none"/>
          <ellipse cx="42" cy="22" rx="27" ry="16" fill="#f79080" opacity=".6" stroke="none"/>
          <path d="M-66 -6 Q-43 -30 -22 -6 M22 -6 Q43 -30 66 -6" fill="none" strokeWidth="7"/>
          <ellipse cx="-19" cy="33" rx="24" ry="19" fill="#ffe9bd" stroke="none"/><ellipse cx="19" cy="33" rx="24" ry="19" fill="#ffe9bd" stroke="none"/>
          <path d="M-10 19 Q0 12 10 19 L0 29Z" fill="#b65c76" strokeWidth="3"/>
          <path d="M0 29 V38 M-20 39 Q0 60 20 39" fill="none" strokeWidth="4"/>
          <path d="M-70 26 L-121 15 M-70 37 L-120 40 M70 26 L121 15 M70 37 L120 40" strokeWidth="3"/>
        </g>
        <path d="M-50 -45 Q0 -28 50 -45" stroke="#a55ce4" strokeWidth="13" fill="none"/>
        <circle cy="-32" r="13" fill="#ffdf76" strokeWidth="3"/>
      </g>
      {Array.from({length:12},(_,i)=>{
        const x=60+(i*137)%620,y=345+(i*79)%380;
        return <g key={i} transform={`translate(${x} ${y+Math.sin(t*3+i)*15}) rotate(${t*20+i*30})`} opacity={.35+.35*Math.sin(t*4+i)}><path d="M-7 0 H7 M0 -7 V7" stroke={i%2?'#ffe2a0':'#9dfff2'} strokeWidth="3"/></g>;
      })}
      <text x="360" y="922" textAnchor="middle" fill="#eadbf6" fontFamily="sans-serif" fontSize="18" letterSpacing="4">PATITAS ARRIBA • 120 BPM</text>
    </svg>
  </AbsoluteFill>;
};
registerRoot(()=> <Composition id="DancingCat" component={Cat} width={720} height={960} fps={30} durationInFrames={240}/>);
