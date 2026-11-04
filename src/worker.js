import {mockOverview} from './aem/mock.js';
import {liveConfigured,liveOverview} from './aem/adobe.js';
import {voiceStudioAvailable,verifyStudioToken,generateStudioVoice} from './demo-voice.js';
/**
 * Nexora Spatial — original Cloudflare Workers backend.
 * API keys must only be stored as Worker secrets. Protect this app with Cloudflare Access
 * before enabling AI calls for anything beyond a private development environment.
 */
const json = (value, status = 200, cache = 'no-store') => new Response(JSON.stringify(value), {
  status, headers: {'content-type':'application/json; charset=utf-8','cache-control':cache,
    'x-content-type-options':'nosniff','referrer-policy':'no-referrer'}
});
const error = (message,status=400) => json({error:message},status);
const weatherCodes = {
  0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Cloudy',45:'Fog',48:'Freezing fog',
  51:'Light drizzle',53:'Drizzle',55:'Dense drizzle',56:'Freezing drizzle',57:'Freezing drizzle',
  61:'Light rain',63:'Rain',65:'Heavy rain',66:'Freezing rain',67:'Freezing rain',
  71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',80:'Rain showers',81:'Rain showers',
  82:'Heavy showers',85:'Snow showers',86:'Heavy snow showers',95:'Thunderstorm',96:'Thunderstorm with hail',99:'Thunderstorm with hail'
};
function messagesForGemini(raw, latest) {
  const history = Array.isArray(raw) ? raw.filter(m => m && (m.role==='user'||m.role==='assistant') && typeof m.text==='string').slice(-12) : [];
  if(history.length && history[history.length-1].role==='user' && history[history.length-1].text.trim()===latest.trim())history.pop();
  const normalized = history.map(m => ({role:m.role==='assistant'?'model':'user',parts:[{text:m.text.slice(0,4000)}]}));
  normalized.push({role:'user',parts:[{text:latest}]});
  return normalized;
}
function messagesForClaude(raw, latest) {
  const history = Array.isArray(raw) ? raw.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string').slice(-12) : [];
  if (history.length && history.at(-1).role === 'user' && history.at(-1).text.trim() === latest.trim()) history.pop();
  const messages = history.map(m => ({role:m.role,content:m.text.slice(0,4000)}));
  messages.push({role:'user',content:latest});
  return messages;
}
function aiProvider(env) { return env.AI_PROVIDER === 'gemini' ? 'Gemini' : 'Claude'; }
function aiReady(env) { return aiProvider(env) === 'Claude' ? !!env.ANTHROPIC_API_KEY : !!env.GEMINI_API_KEY; }
const systemPrompt = 'You are Nexora, a helpful intelligence assistant inside an independently designed spatial dashboard. Be accurate and concise. AEM data is synthetic in mock mode. Never claim access to company systems, invent metrics, or imply you executed actions. Browser notes and calendar are local to this device. Use the dashboard controls for local UI actions.';
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if(url.pathname==='/api/demo/voice/status' && request.method==='GET')return json({provider:'ElevenLabs',configured:voiceStudioAvailable(env),requiresAccessToken:true,mode:'scripted-questions-only'});
    if(url.pathname==='/api/demo/voice' && request.method==='POST'){
      // Disabled by default. Both the provider key and a separate demo access token are Worker secrets.
      // Do not expose general-purpose paid TTS on a public workers.dev domain.
      if(!voiceStudioAvailable(env))return error('Natural voice is not enabled on this deployment. Browser voice is available.',503);
      if(!await verifyStudioToken(request.headers.get('x-nexora-voice-token'),env.VOICE_DEMO_TOKEN))return error('Natural voice demo access denied',401);
      const bodySize=Number(request.headers.get('content-length')||0);
      if(bodySize>1024)return error('Request too large',413);
      let payload;try{payload=await request.json();}catch{return error('Invalid JSON',400);}
      if(typeof payload?.id!=='string'||!/^(identity|sites|deployment|incident|voice)$/.test(payload.id))return error('Select one of the five mock questions',400);
      try{return json(await generateStudioVoice(payload.id,env),200,'private, no-store');}
      catch(e){return error(e?.message||'Natural voice unavailable',e?.status||502);}
    }
    if(request.method==='GET' && url.pathname==='/api/health')return json({service:'nexora-spatial',status:'ok',aiConfigured:aiReady(env),provider:aiProvider(env),model:aiProvider(env)==='Claude'?(env.CLAUDE_MODEL||'claude-sonnet-4-5'):(env.GEMINI_MODEL||'gemini-2.5-flash'),aemMode:env.AEM_MODE==='live'?'live':'mock',adobeConfigured:liveConfigured(env)});
    if(url.pathname==='/api/aem/overview' && request.method==='GET'){
      if(env.AEM_MODE!=='live')return json(mockOverview(url.searchParams.get('scenario')||'healthy'));
      if(env.ENABLE_ENTERPRISE_CONNECTORS!=='true')return error('Enterprise connectors disabled by server policy. No Adobe request was made.',503);
      if(!env.ADOBE_ALLOWED_HOST || new URL(request.url).hostname!==env.ADOBE_ALLOWED_HOST)return error('Enterprise adapter restricted to an approved hostname.',403);
      try{return json(await liveOverview(env),200,'private, no-store');}
      catch(e){return error(e?.message||'Adobe unavailable',e?.status||502);}
    }
    if(url.pathname==='/api/aem/status' && request.method==='GET')return json({mode:env.AEM_MODE==='live'?'live':'mock',configured:liveConfigured(env),enabled:env.ENABLE_ENTERPRISE_CONNECTORS==='true'});
    if (url.pathname==='/api/weather' && request.method==='GET'){
      const lat=Number(url.searchParams.get('lat')),lon=Number(url.searchParams.get('lon'));
      if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat< -90||lat>90||lon< -180||lon>180||url.searchParams.get('lat')===null||url.searchParams.get('lon')===null)return error('Invalid coordinates');
      try{
        const api=new URL('https://api.open-meteo.com/v1/forecast');
        api.searchParams.set('latitude',lat.toFixed(4));api.searchParams.set('longitude',lon.toFixed(4));
        api.searchParams.set('current','temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m');
        api.searchParams.set('temperature_unit','fahrenheit');api.searchParams.set('timezone','auto');
        const upstream=await fetch(api.toString(),{headers:{'accept':'application/json'}});
        if(!upstream.ok)return error('Weather provider unavailable',502);
        const data=await upstream.json();if(!data.current||!Number.isFinite(data.current.temperature_2m))return error('Weather provider returned incomplete data',502);
        return json({temperature:data.current.temperature_2m,unit:'F',wind:data.current.wind_speed_10m||0,
          humidity:data.current.relative_humidity_2m??null,description:weatherCodes[data.current.weather_code]||'Current conditions',
          observedAt:data.current.time,provider:'Open-Meteo'},200,'private, max-age=180');
      }catch{return error('Weather provider unavailable',502);}
    }
    if (url.pathname==='/api/github' && request.method==='GET'){
      const username=url.searchParams.get('username')||'';
      if(!/^[a-zA-Z\d](?:[a-zA-Z\d-]{0,37}[a-zA-Z\d])?$/.test(username))return error('Invalid GitHub username');
      try{
        const upstream=await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`,{
          headers:{'Accept':'application/vnd.github+json','User-Agent':'Nexora-Spatial/1.0','X-GitHub-Api-Version':'2022-11-28'}});
        if(upstream.status===404)return error('GitHub user not found',404);
        if(upstream.status===403||upstream.status===429)return error('GitHub rate limit reached',429);
        if(!upstream.ok)return error('GitHub unavailable',502);
        const d=await upstream.json();return json({username:d.login,public_repos:d.public_repos,followers:d.followers,following:d.following,profile:d.html_url,source:'GitHub public REST API'},200,'private, max-age=60');
      }catch{return error('GitHub unavailable',502);}
    }
    if (url.pathname==='/api/chat' && request.method==='POST'){
      const provider=aiProvider(env);
      if(!aiReady(env))return error(`AI not configured. Add the ${provider==='Claude'?'ANTHROPIC_API_KEY':'GEMINI_API_KEY'} Worker secret and protect the endpoint with Cloudflare Access.`,503);
      const length=Number(request.headers.get('content-length')||0);if(length>65000)return error('Request too large',413);
      let payload;try{payload=await request.json();}catch{return error('Invalid JSON');}
      const prompt=payload?.message;
      if(typeof prompt!=='string'||!prompt.trim()||prompt.length>4000)return error('Message must be between 1 and 4000 characters');
      const model=provider==='Claude'?(env.CLAUDE_MODEL||'claude-sonnet-4-5'):(env.GEMINI_MODEL||'gemini-2.5-flash');
      if(!/^[a-zA-Z0-9._-]{4,80}$/.test(model))return error('Invalid server-side model configuration',500);
      try{
        const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),25000);
        let upstream;
        try{
          if(provider==='Claude'){
            upstream=await fetch('https://api.anthropic.com/v1/messages',{
              method:'POST',signal:controller.signal,
              headers:{'content-type':'application/json','x-api-key':env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},
              body:JSON.stringify({model,max_tokens:900,system:systemPrompt,messages:messagesForClaude(payload.messages,prompt.trim())})
            });
          }else{
            upstream=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
              method:'POST',signal:controller.signal,headers:{'content-type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},
              body:JSON.stringify({systemInstruction:{parts:[{text:systemPrompt}]},contents:messagesForGemini(payload.messages,prompt.trim()),generationConfig:{temperature:0.6,maxOutputTokens:900}})
            });
          }
        }finally{clearTimeout(timeout);}
        if(!upstream.ok){
          if(upstream.status===429)return error(`${provider} rate limit reached`,429);
          return error(`${provider} request failed. Check the model, API key, and quota.`,502);
        }
        const result=await upstream.json();
        const answer=provider==='Claude'
          ?(result.content||[]).filter(p=>p.type==='text').map(p=>p.text||'').join('').trim()
          :(result.candidates?.[0]?.content?.parts||[]).map(p=>typeof p.text==='string'?p.text:'').join('').trim();
        if(!answer)return error('No text returned by the AI provider',502);
        return json({answer:answer.slice(0,12000),provider});
      }catch{return error('AI provider timed out or could not be reached',502);}
    }
    if(!['GET','POST'].includes(request.method))return error('Method not allowed',405);
    return error('Unknown API endpoint',404);
  }
};
