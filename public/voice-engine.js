/* Nexora V6 speech engine. Local, free browser TTS by default.
 * Optional password-protected ElevenLabs TTS uses server-side secrets and
 * per-character timing for approximate lip-sync. No AI chatbot is involved. */
(() => {
  'use strict';
  const clamp=(n,lo=0,hi=1)=>Math.min(hi,Math.max(lo,n));
  const english=voice=>/^(en[-_]|en$)/i.test(voice.lang||'');
  const voiceRank=v=>{
    const s=(v.name||'').toLowerCase();
    return (/natural|neural|premium|enhanced|online/.test(s)?50:0)+
      (/aria|ava|jenny|samantha|daniel|serena|andrew|jason|steffan|ryan/.test(s)?23:0)+
      (v.localService?5:0);
  };
  // Facial shapes approximated from text, not an actual phoneme/face-tracking model.
  function mouthForText(text,index){
    const chars=String(text||'');const c=(chars[index]||'').toLowerCase();
    if(!c || /[\s.,!?;:]/.test(c))return {open:0,round:0,wide:0};
    if(/[bmp]/.test(c))return {open:.07,round:0,wide:.08};
    if(/[oquw]/.test(c))return {open:.47,round:.9,wide:.04};
    if(/[aeyi]/.test(c))return {open:.75,round:.06,wide:.95};
    if(/[fv]/.test(c))return {open:.14,round:0,wide:.47};
    if(/[cdgknt]/.test(c))return {open:.35,round:.1,wide:.48};
    return {open:.42,round:.18,wide:.53};
  }
  function charAtTime(alignment,seconds){
    if(!alignment||!Array.isArray(alignment.characters))return -1;
    const starts=alignment.character_start_times_seconds, ends=alignment.character_end_times_seconds;
    if(!Array.isArray(starts)||!Array.isArray(ends))return -1;
    let lo=0,hi=starts.length-1;
    while(lo<=hi){const m=(lo+hi)>>>1;if(starts[m]<=seconds)lo=m+1;else hi=m-1;}
    return hi>=0&&seconds<ends[hi]+.02?hi:-1;
  }
  function decodeAudio(base64){
    const text=atob(base64);const bytes=new Uint8Array(text.length);
    for(let i=0;i<text.length;i++)bytes[i]=text.charCodeAt(i);
    return new Blob([bytes],{type:'audio/mpeg'});
  }
  function init({motion,onState,onStatus,onVoiceInfo}={}){
    let seq=0,controller=null,audioURL=null,raf=0,browserPulse=0,source='browser',selectedVoice='auto';
    let audio=null,audioContext=null,analyser=null,sourceNode=null,studioAvailable=false;
    let voices=[];
    const setState=(value)=>onState?.(value);
    const status=(value)=>onStatus?.(value);
    function stop(){
      seq++;
      if(controller){controller.abort();controller=null;}
      if(browserPulse){clearInterval(browserPulse);browserPulse=0;}
      if(raf){cancelAnimationFrame(raf);raf=0;}
      try{window.speechSynthesis?.cancel();}catch{}
      if(audio){audio.pause();audio.removeAttribute('src');audio.load();}
      if(audioURL){URL.revokeObjectURL(audioURL);audioURL=null;}
      motion?.setSpeaking(false);motion?.setMouth?.({open:0,round:0,wide:0});
      setState('idle');
    }
    function finish(token,label='FINISHED · SELECT ANOTHER QUESTION'){
      if(token!==seq)return;
      if(browserPulse){clearInterval(browserPulse);browserPulse=0;}
      if(raf){cancelAnimationFrame(raf);raf=0;}
      motion?.setSpeaking(false);motion?.setMouth?.({open:0,round:0,wide:0});
      setState('idle');status(label);
    }
    function availableVoices(){
      voices=(window.speechSynthesis?.getVoices?.()||[]).filter(english).sort((a,b)=>voiceRank(b)-voiceRank(a));
      onVoiceInfo?.(voices.map(v=>({id:v.voiceURI,label:v.name+(v.localService?' · Installed':' · Online')})));
      return voices;
    }
    function beginBrowser(answer,token){
      if(!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window)){
        finish(token,'BROWSER SPEECH UNAVAILABLE');return;
      }
      const utterance=new SpeechSynthesisUtterance(String(answer).slice(0,1400));
      utterance.rate=.98;utterance.pitch=1;utterance.volume=1;
      const v=availableVoices();
      const chosen=v.find(item=>item.voiceURI===selectedVoice)||v[0];
      if(chosen)utterance.voice=chosen;
      utterance.onstart=()=>{
        if(token!==seq)return;
        setState('speaking');motion?.setSpeaking(true);
        status('SPEAKING · DEVICE '+(chosen?.name||'VOICE'));
        let i=0;
        browserPulse=setInterval(()=>{
          if(token!==seq)return;
          const start=(i++*4)%utterance.text.length;
          motion?.speechBeat?.(utterance.text.slice(start,start+5));
        },130);
      };
      utterance.onboundary=e=>{
        if(token!==seq)return;
        if(e.name!=='word'&&e.name!=='sentence')return;
        const idx=Math.min(utterance.text.length-1,e.charIndex||0);
        motion?.speechBeat?.(utterance.text.slice(idx,idx+7));
      };
      utterance.onend=()=>finish(token);
      utterance.onerror=()=>finish(token,'BROWSER SPEECH UNAVAILABLE · TRY ANOTHER VOICE');
      status('STARTING DEVICE VOICE…');
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
    function buildAudioGraph(){
      if(!audio)audio=new Audio();
      const AudioCtx=window.AudioContext||window.webkitAudioContext;
      if(!AudioCtx)return;
      if(!audioContext){
        audioContext=new AudioCtx();
        analyser=audioContext.createAnalyser();analyser.fftSize=512;
        sourceNode=audioContext.createMediaElementSource(audio);
        sourceNode.connect(analyser);analyser.connect(audioContext.destination);
      }
      // Resume when called by click; no microphone access is needed.
      if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
    }
    async function beginStudio(id,token){
      if(!studioAvailable||!id){beginBrowser(window.NexoraDemo?.questions.find(x=>x.id===id)?.answer||'',token);return;}
      const secret=document.getElementById('demoVoiceAccess')?.value.trim()||'';
      if(!secret){finish(token,'ENTER YOUR PRIVATE DEMO ACCESS CODE');return;}
      try{buildAudioGraph();}catch{/* HTML audio can still play without analyser */}
      controller=new AbortController();
      status('GENERATING NATURAL VOICE…');setState('thinking');
      let result;
      try{
        const response=await fetch('/api/demo/voice',{method:'POST',headers:{'content-type':'application/json','x-nexora-voice-token':secret},body:JSON.stringify({id}),signal:controller.signal});
        const body=await response.json();
        if(!response.ok)throw new Error(body.error||'Voice service unavailable');
        result=body;
      }catch(e){
        if(token!==seq||e.name==='AbortError')return;
        finish(token,'STUDIO VOICE ERROR · '+(e.message||'CHECK CONFIGURATION').slice(0,85));
        return;
      }finally{if(token===seq)controller=null;}
      if(token!==seq)return;
      try{
        if(!audio)audio=new Audio();
        if(audioURL)URL.revokeObjectURL(audioURL);
        audioURL=URL.createObjectURL(decodeAudio(result.audio_base64));
        audio.src=audioURL;audio.currentTime=0;
        audio.onended=()=>finish(token);
        audio.onerror=()=>finish(token,'NATURAL VOICE PLAYBACK ERROR');
        if(audioContext?.state==='suspended')await audioContext.resume();
        await audio.play();
      }catch{
        finish(token,'AUDIO BLOCKED · CLICK REPLAY');return;
      }
      if(token!==seq)return;
      setState('speaking');motion?.setSpeaking(true);
      status('SPEAKING · STUDIO VOICE + TIMED LIPS');
      const align=result.alignment, samples=analyser?new Uint8Array(analyser.fftSize):null;
      const update=()=>{
        if(token!==seq||!audio||audio.paused||audio.ended)return;
        let level=.5;
        if(analyser&&samples){analyser.getByteTimeDomainData(samples);let sum=0;for(let i=0;i<samples.length;i++){let delta=(samples[i]-128)/128;sum+=delta*delta;}level=clamp(Math.sqrt(sum/samples.length)*9);}
        const index=charAtTime(align,audio.currentTime);
        const viseme=index>=0?mouthForText(align.characters.join(''),index):{open:level*.67,round:.22,wide:.6};
        motion?.setMouth?.({open:clamp(viseme.open*(.26+.74*level)),round:viseme.round,wide:viseme.wide});
        raf=requestAnimationFrame(update);
      };
      update();
    }
    function say(text,{id=null}={}){
      stop();const token=seq;
      if(source==='studio'&&studioAvailable&&id){beginStudio(id,token);return;}
      beginBrowser(text,token);
    }
    async function refreshStatus(){
      try{
        const response=await fetch('/api/demo/voice/status',{headers:{accept:'application/json'}});
        const data=await response.json();
        studioAvailable=response.ok&&data.configured===true;
      }catch{studioAvailable=false;}
      return studioAvailable;
    }
    function setSource(next){source=next==='studio'&&studioAvailable?'studio':'browser';return source;}
    return {say,stop,refreshStatus,availableVoices,setSource,setBrowserVoice(value){selectedVoice=value||'auto';},get studioAvailable(){return studioAvailable;},get source(){return source;}};
  }
  window.NexoraVoice={init,mouthForText,charAtTime};
})();
