import test from 'node:test';
import assert from 'node:assert/strict';
await import('../public/live-avatar.js');
const {create,DEFAULT_AVATAR,VOICES}=globalThis.NexoraLive3D;

function mocks({failLoad=false,delaySynthesis=false}={}){
  const calls=[];
  class FakeHead{
    constructor(container,config){calls.push(['construct',config.cameraView]);this.audioCtx={state:'running'};}
    async showAvatar(config,callback){calls.push(['loadAvatar',config.url]);if(failLoad)throw new Error('model not reachable');callback?.({lengthComputable:true,total:100,loaded:90});}
    setView(...args){calls.push(['view',...args]);}
    stop(){calls.push(['stop']);}
    start(){calls.push(['start']);}
    speakAudio(data,options,subtitle){calls.push(['speakAudio',data.visemes?.[0]]);subtitle?.('Welcome');}
    speakMarker(fn){calls.push(['marker']);queueMicrotask(fn);}
    stopSpeaking(){calls.push(['stopSpeaking']);}
    playGesture(...args){calls.push(['gesture',...args]);}
    lookAt(...args){calls.push(['look',...args]);}
    makeEyeContact(t){calls.push(['eyeContact',t]);}
  }
  let finishSynthesis;
  class FakeTTS{
    constructor(config){calls.push(['ttsInit',config.endpoints]);}
    async connect(){calls.push(['ttsConnect']);}
    setup(config){calls.push(['ttsSetup',config.voice]);}
    async synthesize({input},onmessage){calls.push(['synthesize',input]);if(delaySynthesis)await new Promise(resolve=>{finishSynthesis=resolve;});const msg={type:'audio',data:{audio:{},visemes:['aa'],vtimes:[0],vdurations:[220]}};onmessage?.(msg);return [msg];}
    clear(){calls.push(['clearTTS']);}
  }
  const container={replaceChildren(){calls.push(['clear']);}};
  const events=[];
  const avatar=create(container,{forceSupported:true,modelURL:'/test/avatar.glb',loadHead:async()=>({TalkingHead:FakeHead}),loadTTS:async()=>({HeadTTS:FakeTTS}),onSpeechState:s=>events.push(s)});
  return {avatar,calls,events,finish:()=>finishSynthesis?.()};
}

test('uses a CC0 example avatar instead of non-commercial avatar asset',()=>{
  assert.match(DEFAULT_AVATAR,/mpfb\.glb/);
  assert.equal(VOICES.female,'af_bella');
});

test('loads full 3D rig and supports head gestures and interactive gaze', async()=>{
  const {avatar,calls}=mocks();
  assert.equal(avatar.ready,false);
  await avatar.load();
  assert.equal(avatar.ready,true);
  avatar.setActive(true);
  assert.equal(avatar.interact('greet'),true);
  avatar.look(.2,.8);
  assert.ok(calls.some(x=>x[0]==='loadAvatar'&&x[1]==='/test/avatar.glb'));
  assert.ok(calls.some(x=>x[0]==='gesture'&&x[1]==='handup'));
  assert.ok(calls.some(x=>x[0]==='look'&&x[1]===.2));
  avatar.setActive(false);
  assert.ok(calls.some(x=>x[0]==='stop'));
});

test('connects local neural voice once and uses timed visemes for 3D speech', async()=>{
  const {avatar,calls,events}=mocks();
  await avatar.load();
  const words=[];
  const played=await avatar.speak('Hello Nexora',{onWord:w=>words.push(w)});
  assert.equal(played,true);
  assert.ok(avatar.voiceReady);
  assert.deepEqual(words,['Welcome']);
  assert.ok(calls.some(x=>x[0]==='speakAudio'&&x[1]==='aa'));
  assert.deepEqual(events,['speaking','idle']);
  await avatar.speak('Next');
  assert.equal(calls.filter(x=>x[0]==='ttsConnect').length,1);
});

test('stop while generating prevents queued speech from playing',async()=>{
  const {avatar,calls,finish}=mocks({delaySynthesis:true});
  await avatar.ensureVoice();
  const speaking=avatar.speak('Hello');
  await new Promise(resolve=>setImmediate(resolve));
  avatar.stopSpeech();
  finish();
  assert.equal(await speaking,false);
  assert.equal(calls.filter(x=>x[0]==='speakAudio').length,0);
});

test('load errors can be handled without lying about 3D availability',async()=>{
  const {avatar}=mocks({failLoad:true});
  await assert.rejects(avatar.load(),/model not reachable/);
  assert.equal(avatar.ready,false);
});


test('streams speech to 3D before the full synthesis promise resolves',async()=>{
  const calls=[];let release;
  class Head{constructor(){this.audioCtx={state:'running'};}async showAvatar(){}
    setView(){}stop(){}speakAudio(){calls.push('play');}speakMarker(fn){queueMicrotask(fn);}stopSpeaking(){}}
  class TTS{async connect(){}async setup(){}clear(){}
    async synthesize({input},onmessage){onmessage({type:'audio',data:{audio:{}}});await new Promise(r=>release=r);return [];}
  }
  const instance=create({replaceChildren(){}},{forceSupported:true,loadHead:async()=>({TalkingHead:Head}),loadTTS:async()=>({HeadTTS:TTS})});
  await instance.ensureVoice();
  const speaking=instance.speak('Hello there');
  for(let i=0;i<10&&!release;i++)await new Promise(r=>setImmediate(r));
  assert.equal(calls.includes('play'),true,'audio should begin before generation finishes');
  release();
  assert.equal(await speaking,true);
});


test('replaying a scripted answer uses cached neural audio',async()=>{
  const saved=globalThis.NexoraDemo;globalThis.NexoraDemo={questions:[{answer:'A prepared mock response.'}]};
  try{
    const {avatar,calls}=mocks();
    await avatar.load();
    assert.equal(await avatar.speak('A prepared mock response.'),true);
    assert.equal(await avatar.speak('A prepared mock response.'),true);
    assert.equal(calls.filter(x=>x[0]==='synthesize').length,1);
    assert.equal(calls.filter(x=>x[0]==='speakAudio').length,2);
  }finally{if(saved===undefined)delete globalThis.NexoraDemo;else globalThis.NexoraDemo=saved;}
});
