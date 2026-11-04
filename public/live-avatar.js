/* Nexora V7 — optional live 3D avatar and local Kokoro neural speech.
 * TalkingHead and HeadTTS are MIT licensed; the MPFB demo avatar is CC0.
 * The sizable GLB and Kokoro weights are downloaded ONLY after the user selects Live 3D/neural speech.
 * No API keys, Claude request, or microphone upload is required for scripted answers.
 */
(function (root) {
  'use strict';
  const DEFAULT_AVATAR = 'https://raw.githubusercontent.com/met4citizen/TalkingHead/1563de184c19b310de4b636664d5835e2c74dbba/avatars/mpfb.glb';
  const HEADTTS_URL = 'https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.3/+esm';
  const HEADTTS_WORKER = 'https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.3/modules/worker-tts.mjs';
  const HEADTTS_DICTIONARY = 'https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.3/dictionaries/';
  const VOICES = Object.freeze({female:'af_bella',male:'am_fenrir'});

  function create(container, opts={}) {
    if (!container) throw new TypeError('Live avatar requires a container');
    const loadHead = opts.loadHead || (()=>import('talkinghead'));
    const loadTTS = opts.loadTTS || (()=>import(HEADTTS_URL));
    const modelURL = opts.modelURL || DEFAULT_AVATAR;
    let head=null, tts=null, modelReady=false, voiceReady=false, disposed=false;
    let loadPromise=null, voicePromise=null, turn=0, active=false;
    const status = text => opts.onStatus?.(text);
    const report = (phase,detail='') => opts.onProgress?.({phase,detail});
    const safeCall = (method,...args) => {try{return head && typeof head[method]==='function' ? head[method](...args) : undefined;} catch(err){console.warn('Nexora 3D '+method+' unavailable:',err);return undefined;}};
    function isSupported() {
      if (opts.forceSupported === true) return true;
      if (opts.forceSupported === false) return false;
      if (typeof document === 'undefined') return false;
      try {const cv = document.createElement('canvas');return !!(cv.getContext('webgl2') || cv.getContext('webgl'));} catch{return false;}
    }
    async function load(){
      if (modelReady) return true;
      if (loadPromise) return loadPromise;
      if (!isSupported()) throw new Error('WebGL is unavailable in this browser/device');
      status('Loading live 3D avatar · first load downloads a large CC0 model');
      report('loading','3D engine');
      loadPromise=(async()=>{
        try {
          const {TalkingHead}=await loadHead();
          if(disposed) throw new Error('Avatar was closed');
          head=new TalkingHead(container,{
            ttsEndpoint:'N/A',lipsyncModules:[],cameraView:'upper',cameraRotateEnable:true,
            cameraZoomEnable:true,cameraPanEnable:false,avatarIdleEyeContact:.76,
            avatarSpeakingEyeContact:.93,avatarIdleHeadMove:.65,avatarSpeakingHeadMove:.72,
            lightAmbientIntensity:2,lightDirectIntensity:19,modelPixelRatio:Math.min(typeof devicePixelRatio==='number'?devicePixelRatio:1,1.5),
          });
          report('loading','3D avatar model');
          await head.showAvatar({url:modelURL,body:'F',avatarMood:'neutral',lipsyncLang:'en'} ,event=>{
            if(event?.lengthComputable && event.total)status('Loading 3D avatar · '+Math.round(100*event.loaded/event.total)+'%');
          });
          if(disposed)throw new Error('Avatar was closed');
          modelReady=true;
          safeCall('setView','upper',{cameraDistance:.18,cameraY:0});
          if(!active)safeCall('stop');
          status('3D avatar ready · drag to rotate, scroll to zoom, try neural voice');
          report('ready','3D avatar');
          return true;
        }catch(error){
          modelReady=false;loadPromise=null;
          report('error',error?.message||'3D avatar could not be loaded');
          throw error;
        }
      })();
      return loadPromise;
    }
    async function ensureVoice(){
      await load();
      if(voiceReady)return true;
      if(voicePromise)return voicePromise;
      voicePromise=(async()=>{
        report('loading','Local Kokoro neural voice · model download');
        status('Downloading local neural voice on first use · this may be slow');
        try{
          const {HeadTTS}=await loadTTS();
          if(disposed)throw new Error('Avatar was closed');
          tts=new HeadTTS({
            endpoints:['webgpu','wasm'],languages:['en-us'],voices:Object.values(VOICES),
            workerModule:HEADTTS_WORKER,dictionaryURL:HEADTTS_DICTIONARY,
            audioCtx:head?.audioCtx,trace:0,
          });
          await tts.connect(null,event=>{
            if(event?.lengthComputable && event.total)status('Loading neural voice · '+Math.round(100*event.loaded/event.total)+'%');
          });
          tts.setup({voice:VOICES.female,language:'en-us',speed:1,audioEncoding:'wav'});
          if(disposed)throw new Error('Avatar was closed');
          voiceReady=true;
          status('Local neural voice ready · Kokoro · phoneme-level lip sync');
          report('ready','Local Kokoro voice');
          return true;
        }catch(error){
          voiceReady=false;voicePromise=null;
          report('error',error?.message||'Neural voice failed to load');
          throw error;
        }
      })();
      return voicePromise;
    }
    async function speak(text,{voice='female',onWord,onStart,onEnd}={}){
      const message=String(text||'').trim().slice(0,900);
      if(!message)return false;
      const token=++turn;
      await ensureVoice();
      if(token!==turn||disposed)return false;
      tts.setup({voice:VOICES[voice]||VOICES.female,language:'en-us',speed:.97,audioEncoding:'wav'});
      status('Generating neural speech locally…');
      const results=await tts.synthesize({input:message});
      if(token!==turn||disposed)return false;
      const errors=(results||[]).filter(x=>x.type==='error');
      if(errors.length)throw new Error(errors[0]?.data?.error||'Neural speech failed');
      const chunks=(results||[]).filter(x=>x.type==='audio'&&x.data?.audio);
      if(!chunks.length)throw new Error('Neural voice produced no audio');
      opts.onSpeechState?.('speaking');onStart?.();
      status('Speaking · neural voice with timed lip sync');
      safeCall('makeEyeContact',1800);
      safeCall('playGesture','side',2.5);
      let resolveEnd;
      const done=new Promise(resolve=>{resolveEnd=resolve;});
      chunks.forEach(msg=>safeCall('speakAudio',msg.data,{lipsyncLang:'en'},word=>{if(token===turn)onWord?.(word);}));
      safeCall('speakMarker',()=>{if(token===turn){opts.onSpeechState?.('idle');onEnd?.();status('Ready for another question');}resolveEnd(token===turn);});
      // A failed mixer/paused tab must not leave an eternally pending conversation.
      const timeout=Math.min(120000,Math.max(16000,message.length*190));
      let timerId;
      const timer=new Promise(resolve=>{timerId=setTimeout(()=>resolve(false),timeout);});
      const completed=await Promise.race([done,timer]);
      clearTimeout(timerId);
      if(completed===false && token===turn){stopSpeech();status('Playback timed out · try another question');}
      return completed;
    }
    function stopSpeech(){
      turn++;
      safeCall('stopSpeaking');
      opts.onSpeechState?.('idle');
    }
    function setActive(next){active=!!next;if(modelReady){safeCall(active?'start':'stop');}}
    function interact(gesture='greet'){
      if(!modelReady)return false;
      safeCall('lookAtCamera',1250);
      safeCall('setMood',gesture==='curious'?'happy':'neutral');
      safeCall('playGesture',gesture==='greet'?'handup':gesture==='thinking'?'shrug':'side',2.2);
      return true;
    }
    function look(x,y){if(modelReady)safeCall('lookAt',Math.max(0,Math.min(1,x)),Math.max(0,Math.min(1,y)),650);}
    function destroy(){disposed=true;stopSpeech();safeCall('stop');container.replaceChildren();}
    return {load,ensureVoice,speak,stopSpeech,setActive,interact,look,destroy,
      get ready(){return modelReady;},get voiceReady(){return voiceReady;},get isSupported(){return isSupported();},
    };
  }
  root.NexoraLive3D={create,VOICES,DEFAULT_AVATAR};
})(typeof window!=='undefined'?window:globalThis);
