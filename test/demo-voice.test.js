import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
import {VOICE_DEMO_ANSWERS,verifyStudioToken,voiceStudioAvailable,generateStudioVoice} from '../src/demo-voice.js';
await import('../public/mock-conversation.js');
const secretConfig={AEM_MODE:'mock',VOICE_DEMO_ENABLED:'true',ELEVENLABS_API_KEY:'UNIT_TEST_ONLY',ELEVENLABS_VOICE_ID:'JBFqnCBsd6RMkjVDRZzb',VOICE_DEMO_TOKEN:'PrivateUnitTestPassphrase1234',ASSETS:{fetch:()=>new Response('static')}};
const call=(path,env={},init={})=>worker.fetch(new Request('https://demo.example'+path,init),{ASSETS:secretConfig.ASSETS,AEM_MODE:'mock',...env});

test('paid studio voice is off unless key, voice ID and access token are all configured',async()=>{
  assert.equal(voiceStudioAvailable({}),false);
  const status=await call('/api/demo/voice/status');
  assert.equal(status.status,200);
  assert.deepEqual(await status.json(),{provider:'ElevenLabs',configured:false,requiresAccessToken:true,mode:'scripted-questions-only'});
  const post=await call('/api/demo/voice',{}, {method:'POST',headers:{'content-type':'application/json'},body:'{"id":"identity"}'});
  assert.equal(post.status,503);
});
test('the five authorized voice phrases always match the local mock answers',()=>{
  const questions=globalThis.NexoraDemo.questions;
  assert.equal(questions.length,5);
  for(const q of questions)assert.equal(VOICE_DEMO_ANSWERS[q.id],q.answer);
});
test('studio access code is required and checked without a simple direct string equality',async()=>{
  assert.equal(await verifyStudioToken('some-secret','some-secret'),true);
  assert.equal(await verifyStudioToken('wrong','some-secret'),false);
  assert.equal(await verifyStudioToken(null,'some-secret'),false);
  const missing=await call('/api/demo/voice',secretConfig,{method:'POST',body:'{"id":"identity"}'});
  assert.equal(missing.status,401);
  const wrong=await call('/api/demo/voice',secretConfig,{method:'POST',headers:{'x-nexora-voice-token':'wrong'},body:'{"id":"identity"}'});
  assert.equal(wrong.status,401);
});
test('unknown question IDs are never passed through as paid speech',async()=>{
  const res=await call('/api/demo/voice',secretConfig,{method:'POST',headers:{'x-nexora-voice-token':secretConfig.VOICE_DEMO_TOKEN,'content-type':'application/json'},body:JSON.stringify({id:'custom',text:'Arbitrary speech'})});
  assert.equal(res.status,400);
});
test('studio sends only whitelisted text and server-side key to authorized provider',async()=>{
  const orig=globalThis.fetch;const calls=[];
  try{
    globalThis.fetch=async (url,params)=>{
      calls.push({url,params});
      return new Response(JSON.stringify({audio_base64:'UklGRg==',alignment:{characters:['H','i'],character_start_times_seconds:[0,.1],character_end_times_seconds:[.1,.3]}}),{status:200,headers:{'content-type':'application/json'}});
    };
    const res=await call('/api/demo/voice',secretConfig,{method:'POST',headers:{'x-nexora-voice-token':secretConfig.VOICE_DEMO_TOKEN,'content-type':'application/json'},body:JSON.stringify({id:'identity',text:'Malicious client text ignored'})});
    assert.equal(res.status,200);const data=await res.json();
    assert.equal(data.id,'identity');assert.equal(data.provider,'ElevenLabs');assert.equal(data.alignment.characters.length,2);
    assert.equal(calls.length,1);
    const request=JSON.parse(calls[0].params.body);
    assert.equal(request.text,VOICE_DEMO_ANSWERS.identity);
    assert.equal(calls[0].params.headers['xi-api-key'],secretConfig.ELEVENLABS_API_KEY);
    assert.ok(!JSON.stringify(data).includes(secretConfig.ELEVENLABS_API_KEY));
  }finally{globalThis.fetch=orig;}
});
test('invalid IDs rejected before contacting voice provider',async()=>{
  const orig=globalThis.fetch;let count=0;
  try{globalThis.fetch=async()=>{count++;throw Error('External fetch should never happen');};
    const r=await call('/api/demo/voice',secretConfig,{method:'POST',headers:{'x-nexora-voice-token':secretConfig.VOICE_DEMO_TOKEN,'content-type':'application/json'},body:'{"id":"untrusted"}'});
    assert.equal(r.status,400);assert.equal(count,0);
  }finally{globalThis.fetch=orig;}
});
