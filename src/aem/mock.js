/** Fully fictional demonstration data: not an Adobe or AbbVie dataset. */
const at = (daysAgo) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();
const demoSites = Array.from({length:120},(_,i)=>[
  `NOVA Simulated Site ${String(i+1).padStart(3,'0')}`,
  `https://site-${String(i+1).padStart(3,'0')}.demo.example`,
  'healthy', ['US East','EU West','US West','APAC'][i%4],155+(i*17)%290
]);
export function mockOverview(scenario='healthy') {
  const status = ['healthy','degraded','incident'].includes(scenario) ? scenario : 'healthy';
  const sites = demoSites.map(([name,url,health,region,latencyMs],i)=>({
    id:`mock-site-${i+1}`,name,url,region,latencyMs,
    health: status==='incident' && i<2 ? 'down' : status==='degraded' && i===2 ? 'degraded' : health,
    synthetic:true, checkedAt:at(0), evidence:'simulated'
  }));
  const pipelineStatuses=['FINISHED','FINISHED','FINISHED',status==='incident'?'ERROR':'FINISHED','FINISHED',status==='degraded'?'ERROR':'FINISHED','FINISHED','FINISHED'];
  const executions=pipelineStatuses.map((s,i)=>({id:`EX-SIM-${1200-i}`,programId:'demo-program',pipelineId:`pipeline-${i%3+1}`,
    pipelineName:['Production Full Stack','Stage Validation','Web Tier'][i%3],status:s,
    startedAt:at(i*4+1),finishedAt:at(i*4+.9),target:'production',source:'synthetic'}));
  return {
    source:'mock', mode:'mock', scenario:status, generatedAt:at(0),
    dataClassification:'SYNTHETIC DEMONSTRATION ONLY',
    coverage:{programs:'complete simulation',environments:'complete simulation',pipelines:'sample',executions:'8 synthetic samples',sites:'120 synthetic sites',rollbacks:'not measured'},
    programs:[{id:'demo-program',name:'NOVA Digital Experience — SIMULATED',type:'aem_cloud_service'}],
    environments:[{id:'demo-prod',name:'Production — Simulated',type:'prod',status:status==='incident'?'degraded':'ready',programId:'demo-program'},{id:'demo-stage',name:'Stage — Simulated',type:'stage',status:'ready',programId:'demo-program'},{id:'demo-dev',name:'Development — Simulated',type:'dev',status:'ready',programId:'demo-program'}],
    pipelines:[{id:'pipeline-1',name:'Production Full Stack',programId:'demo-program'},{id:'pipeline-2',name:'Stage Validation',programId:'demo-program'},{id:'pipeline-3',name:'Web Tier',programId:'demo-program'}],
    executions, sites, rollbacks:{count:null,reason:'Requires an authoritative rollback/event source; pipeline failures are not rollbacks.'},
    alerts:status==='incident'?[{id:'sim-incident-1',severity:'critical',message:'Synthetic outage: two demonstration sites unavailable'}]:status==='degraded'?[{id:'sim-warning-1',severity:'warning',message:'Synthetic warning: elevated latency and failed pipeline'}]:[],
  };
}
