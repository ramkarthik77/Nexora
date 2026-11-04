/** Local-only preview harness. Production uses Wrangler/Cloudflare. */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import worker from '../src/worker.js';
const base=resolve(import.meta.dirname,'../public');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
const assets={async fetch(req){const url=new URL(req.url);const rawPath=decodeURIComponent(url.pathname);const target=resolve(base,'.'+(rawPath==='/'?'/index.html':rawPath));if(target!==base&&!target.startsWith(base+sep))return new Response('Forbidden',{status:403});try{return new Response(await readFile(target),{headers:{'content-type':mime[extname(target)]||'application/octet-stream'}});}catch{return new Response('Not found',{status:404});}}};
createServer(async(req,res)=>{
  try{const parts=[];for await(const p of req)parts.push(p);
    const request=new Request(`http://127.0.0.1:8787${req.url}`,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(parts)});
    const response=await worker.fetch(request,{ASSETS:assets,AEM_MODE:'mock',ENABLE_ENTERPRISE_CONNECTORS:'false'});
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch(e){res.writeHead(500);res.end('Preview error');}
}).listen(8787,'127.0.0.1',()=>console.log('Nexora preview: http://127.0.0.1:8787 (mock AEM only)'));
