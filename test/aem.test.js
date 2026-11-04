import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
import {mockOverview} from '../src/aem/mock.js';
import {liveOverview} from '../src/aem/adobe.js';

const env={AEM_MODE:'mock',ENABLE_ENTERPRISE_CONNECTORS:'false',ASSETS:{fetch:()=>new Response('static')}};
const get = async (path,settings={}) => {
  const res=await worker.fetch(new Request('https://demo.example'+path), {...env,...settings});
  return {status:res.status,body:await res.json()};
};

test('default configuration is synthetic and makes no external Adobe request',async()=>{
  const {status,body}=await get('/api/aem/overview');
  assert.equal(status,200);assert.equal(body.source,'mock');
  assert.match(body.dataClassification,/SYNTHETIC/);
  assert.equal(body.sites.length,120);
  assert.equal(body.rollbacks.count,null);
});
test('scenario switching exercises healthy degraded and outage states',async()=>{
  assert.equal(mockOverview('healthy').sites.filter(x=>x.health==='down').length,0);
  assert.equal(mockOverview('degraded').sites.filter(x=>x.health==='degraded').length,1);
  assert.equal(mockOverview('incident').sites.filter(x=>x.health==='down').length,2);
  const {body}=await get('/api/aem/overview?scenario=incident');assert.equal(body.alerts[0].severity,'critical');
});
test('mode live requires explicit opt-in and hostname allowlist',async()=>{
  const disabled=await get('/api/aem/overview',{AEM_MODE:'live'});assert.equal(disabled.status,503);
  const denied=await get('/api/aem/overview',{AEM_MODE:'live',ENABLE_ENTERPRISE_CONNECTORS:'true',ADOBE_ALLOWED_HOST:'approved.example'});assert.equal(denied.status,403);
});
test('Adobe client authenticates using server-to-server OAuth and only makes GET Cloud Manager calls',async()=>{
  const seen=[];
  const fakeFetch=async(url,init)=>{
    seen.push({url:String(url),method:init.method,headers:init.headers});
    const body=url.includes('ims/token')?{access_token:'unit-test-token'}:
      url.endsWith('/api/programs')?{_embedded:{programs:[{id:'123',name:'Fixture',type:'aem_cloud_service'}]}}:
      url.includes('/environments')?{_embedded:{environments:[{id:'456',name:'Test',type:'dev',status:'ready'}]}}:
      url.includes('/pipelines')?{_embedded:{pipelines:[{id:'789',name:'Main',type:'CI_CD'}]}}:
      url.includes('/executions')?{_embedded:{executions:[{id:'111',status:'FINISHED',createdAt:'2026-11-01T10:00:00Z',finishedAt:'2026-11-01T10:30:00Z'}]}}:{};
    return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
  };
  const result=await liveOverview({ADOBE_CLIENT_ID:'cid',ADOBE_CLIENT_SECRET:'secret',ADOBE_ORG_ID:'org',ADOBE_SCOPES:'openid,AdobeID,read_organizations'},fakeFetch);
  assert.equal(result.source,'adobe-cloud-manager');assert.equal(result.programs.length,1);assert.equal(result.executions.length,1);
  assert.equal(result.sites.length,0);assert.equal(result.rollbacks.count,null);
  assert.equal(seen[0].method,'POST');assert.ok(seen.slice(1).every(x=>x.method==='GET'));
  assert.equal(seen[1].headers['x-api-key'],'cid');assert.equal(seen[1].headers.authorization,'Bearer unit-test-token');
});

test('approved site checks do not accept browser supplied arbitrary URLs',async()=>{
  const {parseSiteInventory,checkApprovedSites}=await import('../src/aem/sites.js');
  assert.throws(()=>parseSiteInventory('[{"url":"http://127.0.0.1/admin"}]'),/disallowed/);
  const result=await checkApprovedSites(JSON.stringify([{name:'Approved synthetic site',url:'https://example.com'}]),async(_url,init)=>{
    assert.equal(init.method,'HEAD');return new Response(null,{status:200});
  });
  assert.equal(result.length,1);assert.equal(result[0].health,'healthy');
});


test('Claude is the default AI provider but never exposed without its secret',async()=>{
  const status=await get('/api/health');
  assert.equal(status.body.provider,'Claude');
  assert.equal(status.body.aiConfigured,false);
  const res=await worker.fetch(new Request('https://demo.example/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:'Hello'})}),env);
  assert.equal(res.status,503);
});
