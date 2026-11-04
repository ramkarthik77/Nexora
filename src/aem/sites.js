/** Optional read-only HTTPS availability probes from an administrator-approved inventory.
 * Only inventory configured as a Worker secret is accepted. Not a general URL probe API.
 */
export function parseSiteInventory(raw){
  if(!raw)return [];
  let value;try{value=JSON.parse(raw);}catch{throw Error('Invalid configured AEM site inventory JSON');}
  if(!Array.isArray(value))throw Error('Configured AEM site inventory must be an array');
  return value.slice(0,20).map((item,i)=>{
    const u=new URL(item.url);
    if(u.protocol!=='https:' || u.username || u.password || u.port || u.hostname==='localhost' || !u.hostname.includes('.'))throw Error('Site inventory contains a disallowed URL');
    return {id:`approved-site-${i+1}`,name:String(item.name||u.hostname).slice(0,120),url:u.origin+'/',region:String(item.region||'unspecified').slice(0,60)};
  });
}
export async function checkApprovedSites(raw,fetcher=fetch){
  const inventory=parseSiteInventory(raw);
  const sites=await Promise.all(inventory.map(async(site)=>{
    const started=Date.now();let code=null,status='unknown';
    try{
      const res=await fetcher(site.url,{method:'HEAD',redirect:'manual',signal:AbortSignal.timeout(7000),headers:{'user-agent':'Nexora-Approved-Availability/1.0'}});
      code=res.status;
      status=code>=500?'down':code>=400?'degraded':code>=300?'degraded':'healthy';
    }catch{status='unknown';}
    const latencyMs=Date.now()-started;
    if(status==='healthy'&&latencyMs>2000)status='degraded';
    return {...site,health:status,latencyMs,httpStatus:code,checkedAt:new Date().toISOString(),evidence:'HTTP HEAD check only'};
  }));
  return sites;
}
