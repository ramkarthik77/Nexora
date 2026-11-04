/**
 * Fixed synthetic conversation fixtures for the optional natural-voice demo.
 * Never accept arbitrary user text on a paid speech endpoint.
 * Keep these answers in sync with public/mock-conversation.js (enforced by tests).
 */
export const VOICE_DEMO_ANSWERS=Object.freeze({
  identity:'Hello! I am Nexora, your interactive engineering companion. Right now I am running a scripted demonstration, not an AI model. You can test my voice and facial movement without connecting Claude.',
  sites:'In this demo, I display one hundred and twenty entirely fictional AEM websites. The numbers and site names are synthetic. There are no live Adobe or company connections.',
  deployment:'I cannot report a real quarterly production deployment total yet. The simulator shows a handful of invented pipeline executions only. Once an approved data source is connected, we can calculate verified totals.',
  incident:'Certainly. I have switched the AEM simulator to an incident scenario. Two fictional websites are marked down, with a synthetic outage alert. Select AEM Cloud Operations to inspect the details.',
  voice:'Yes, for this demonstration! You can ask one of the five scripted questions. I can speak with your device voice, or an optional natural studio voice, while animating my expression. The microphone requires browser speech recognition support and your permission; there is no AI reasoning connected.'
});

export function voiceStudioAvailable(env){
 return env?.VOICE_DEMO_ENABLED==='true'&&!!env.ELEVENLABS_API_KEY&&!!env.ELEVENLABS_VOICE_ID&&!!env.VOICE_DEMO_TOKEN;
}

export async function verifyStudioToken(provided,expected){
 if(typeof provided!=='string'||typeof expected!=='string'||!provided||!expected||provided.length>256||expected.length>256)return false;
 const enc=new TextEncoder();
 const [a,b]=await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(provided)),crypto.subtle.digest('SHA-256',enc.encode(expected))]);
 const x=new Uint8Array(a),y=new Uint8Array(b);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0;
}

export async function generateStudioVoice(id,env,fetcher=fetch){
 const text=VOICE_DEMO_ANSWERS[id];
 if(!text)throw Object.assign(new Error('Unknown scripted question'),{status:400});
 if(!/^[A-Za-z0-9]{8,64}$/.test(env.ELEVENLABS_VOICE_ID))throw Object.assign(new Error('Voice ID invalid'),{status:500});
 const model=env.ELEVENLABS_MODEL||'eleven_flash_v2_5';
 if(!/^[A-Za-z0-9_]{4,64}$/.test(model))throw Object.assign(new Error('Voice model invalid'),{status:500});
 const url=`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(env.ELEVENLABS_VOICE_ID)}/with-timestamps?output_format=mp3_44100_128`;
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),25000);
 let response;
 try{
  response=await fetcher(url,{method:'POST',signal:controller.signal,headers:{'content-type':'application/json','accept':'application/json','xi-api-key':env.ELEVENLABS_API_KEY},body:JSON.stringify({text,model_id:model,voice_settings:{stability:.5,similarity_boost:.8}})});
 }finally{clearTimeout(timeout);}
 if(!response.ok)throw Object.assign(new Error(response.status===429?'Voice service quota or rate limit reached':'Voice provider unavailable'),{status:response.status===429?429:502});
 const data=await response.json();
 if(typeof data.audio_base64!=='string'||!data.audio_base64||data.audio_base64.length>3000000)throw Object.assign(new Error('Invalid voice audio'),{status:502});
 const a=data.alignment||data.normalized_alignment;
 const alignment=a&&Array.isArray(a.characters)&&Array.isArray(a.character_start_times_seconds)&&Array.isArray(a.character_end_times_seconds)&&a.characters.length===a.character_start_times_seconds.length&&a.characters.length===a.character_end_times_seconds.length&&a.characters.length<=2000?a:null;
 return {id,provider:'ElevenLabs',format:'audio/mpeg',audio_base64:data.audio_base64,alignment};
}
