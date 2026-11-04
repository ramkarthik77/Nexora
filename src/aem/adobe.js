/**
 * Adobe Cloud Manager read-only integration. Never call directly from browser.
 * Docs: https://developer.adobe.com/experience-cloud/cloud-manager/guides/getting-started/authentication/authentication
 * This adapter deliberately only issues GET requests to Cloud Manager.
 */
import {checkApprovedSites,parseSiteInventory} from './sites.js';
const BASE='https://cloudmanager.adobe.io';
const embedded = (body,key) => {
  const v=body?._embedded?.[key];
  return Array.isArray(v)?v:[];
};
const cleanText=(v)=>typeof v==='string'?v:'';
const safeId=(v)=>{const s=String(v??'');if(!/^\d{1,20}$/.test(s))throw new Error('Unexpected Cloud Manager resource identifier');return s;};
class AdobeError extends Error { constructor(message,status=502){super(message);this.status=status;} }
export function liveConfigured(env){return Boolean(env.ADOBE_CLIENT_ID&&env.ADOBE_CLIENT_SECRET&&env.ADOBE_ORG_ID&&env.ADOBE_SCOPES);}
async function requestToken(env,fetcher){
  const p=new URLSearchParams({grant_type:'client_credentials',client_id:env.ADOBE_CLIENT_ID,client_secret:env.ADOBE_CLIENT_SECRET,scope:env.ADOBE_SCOPES});
  const response=await fetcher('https://ims-na1.adobelogin.com/ims/token/v3',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:p.toString(),signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new AdobeError('Adobe token request rejected. Check credentials and approved scopes.',502);
  const body=await response.json();if(typeof body.access_token!=='string')throw new AdobeError('Adobe token response missing access token');
  return body.access_token;
}
function adobeClient(env,token,fetcher){
  return async (path) => {
    if(!path.startsWith('/api/')||path.includes('..')||path.includes('//'))throw new Error('Invalid Adobe API route');
    const response=await fetcher(BASE+path,{method:'GET',headers:{'accept':'application/json','x-api-key':env.ADOBE_CLIENT_ID,'x-gw-ims-org-id':env.ADOBE_ORG_ID,'authorization':`Bearer ${token}`},signal:AbortSignal.timeout(12000)});
    if(response.status===401||response.status===403)throw new AdobeError('Adobe access denied. Check product profiles and technical account permissions.',503);
    if(!response.ok)throw new AdobeError(`Cloud Manager request failed (HTTP ${response.status})`,502);
    return await response.json();
  };
}
function normalizeExecution(x,pipeline,program){return {
  id:cleanText(x.id)||String(x.id??''),programId:program.id,pipelineId:pipeline.id,pipelineName:pipeline.name,
  status:cleanText(x.status)||'UNKNOWN',startedAt:x.startTime||x.startDate||x.createdAt||null,
  finishedAt:x.endTime||x.finishedAt||null,target:pipeline.target||null,source:'cloud-manager'
};}
/**
 * Fetch bounded, permission-scoped execution history. It is a sample, not a complete quarterly report.
 * Advanced site health and rollback metrics require their own observability inventory/event sources.
 */
export async function liveOverview(env,fetcher=fetch){
  if(!liveConfigured(env))throw new AdobeError('Adobe integration not configured. Contact an authorized organization administrator.',503);
  const token=await requestToken(env,fetcher),get=adobeClient(env,token,fetcher);
  const data=await get('/api/programs');
  const programs=embedded(data,'programs').slice(0,10).map(p=>({id:safeId(p.id),name:cleanText(p.name),type:cleanText(p.type)}));
  const environments=[],pipelines=[],executions=[],warnings=[];
  for(const program of programs){
    const [envResult,pipelineResult]=await Promise.allSettled([get(`/api/program/${program.id}/environments`),get(`/api/program/${program.id}/pipelines`)]);
    if(envResult.status==='fulfilled')environments.push(...embedded(envResult.value,'environments').map(e=>({id:String(e.id),name:cleanText(e.name),type:cleanText(e.type),status:cleanText(e.status)||'unknown',programId:program.id})));
    else warnings.push(`Environment discovery incomplete for program ${program.id}`);
    if(pipelineResult.status==='rejected'){warnings.push(`Pipeline discovery incomplete for program ${program.id}`);continue;}
    const found=embedded(pipelineResult.value,'pipelines').slice(0,12).map(p=>({id:safeId(p.id),name:cleanText(p.name),programId:program.id,target:cleanText(p.type)}));
    pipelines.push(...found);
    for(const pipeline of found){
      try{
        // Adobe limits pagination; this is explicitly a bounded recent-execution sample.
        const result=await get(`/api/program/${program.id}/pipeline/${pipeline.id}/executions?start=0&limit=20`);
        executions.push(...embedded(result,'executions').map(x=>normalizeExecution(x,pipeline,program)));
      }catch{warnings.push(`Recent execution history incomplete for pipeline ${pipeline.id}`);}
    }
  }
  let sites=[];
  if(env.AEM_SITE_INVENTORY_JSON){try{sites=await checkApprovedSites(env.AEM_SITE_INVENTORY_JSON,fetcher);}catch{warnings.push('Approved site inventory could not be probed.');}}
  return {
    source:'adobe-cloud-manager',mode:'live',generatedAt:new Date().toISOString(),dataClassification:'ENTERPRISE — PROTECT AND RESTRICT',
    coverage:{programs:programs.length===10?'first 10 programs (bounded)':'authorized subset',environments:'authorized discovery (partial on error)',pipelines:'up to 12 per program',executions:'up to 20 recent per pipeline, not full quarter',sites:env.AEM_SITE_INVENTORY_JSON?`${sites.length} approved HTTP HEAD probes (max 20 per request)`:'requires approved site inventory + probes',rollbacks:'requires event/audit source'},
    programs,environments,pipelines,executions,sites,alerts:[],warnings,
    rollbacks:{count:null,reason:'Cannot infer rollback events reliably from execution status alone. Connect approved change/audit telemetry.'}
  };
}
