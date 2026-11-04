(() => {
'use strict';
const $ = (id) => document.getElementById(id);
const modules = [
  {id:'aem',name:'AEM Cloud',sub:'Platform operations',icon:'i-target'},
  {id:'weather',name:'Weather',sub:'Local conditions',icon:'i-sun'},
  {id:'github',name:'GitHub',sub:'Repository pulse',icon:'i-github'},
  {id:'calendar',name:'Calendar',sub:'Your schedule',icon:'i-calendar'},
  {id:'system',name:'System',sub:'Device signals',icon:'i-cpu'},
  {id:'agents',name:'AI Agents',sub:'Reasoning engine',icon:'i-sparkles'},
  {id:'notes',name:'Memory',sub:'Local knowledge',icon:'i-notes'},
];
const read = (key, fallback) => { try { const data = JSON.parse(localStorage.getItem('nexora.' + key)); return data ?? fallback; } catch { return fallback; } };
const save = (key,value) => {try {localStorage.setItem('nexora.'+key,JSON.stringify(value));}catch{}};
const state = {
 selected:'aem',view:'humanoid',orbit:0,dragging:false,lastMove:performance.now(),
 settings:read('settings',{github:'',speak:false}),
 notes:read('notes',[]),events:read('events',[]),messages:read('messages',[]).slice(-30),
 weather:null,github:null,aem:null,aemScenario:'healthy',geo:null,backend:null,recognized:null,busy:false
};
let toastTimeout, rafId, humanoidEngine;
function setHumanoidState(next){if(!humanoidEngine)return;humanoidEngine.setMode(next);}
function onHumanoidState(next){$('humanoidState').textContent=next.toUpperCase();$('humanoidDescription').textContent=({idle:'Move your pointer to explore the light field.',listening:'Listening mode. Cyan energy field activated.',thinking:'Processing the request through available tools.',speaking:'Speaking animation. Amber pulses follow the response.'})[next]||'Ready';document.querySelectorAll('[data-humanoid-state]').forEach(b=>b.classList.toggle('active',b.dataset.humanoidState===next));$('humanoidShell').dataset.mode=next;}
function svg(id){return `<svg aria-hidden="true"><use href="#${id}"/></svg>`;}
function safe(str){return String(str??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');}
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove('visible'),3200);}
function setVisual(visual){
 if(!['portrait','particles'].includes(visual))return;
 $('humanoidShell').dataset.visual=visual;
 document.querySelectorAll('[data-visual]').forEach(b=>b.classList.toggle('selected',b.dataset.visual===visual));
 if(humanoidEngine)humanoidEngine.setVisible(state.view==='humanoid'&&visual==='particles');
}
function setView(mode){if(!['humanoid','spatial','focus','grid'].includes(mode))return;state.view=mode;const stage=$('stage');stage.classList.remove('view-humanoid','view-spatial','view-focus','view-grid');stage.classList.add('view-'+mode);document.querySelectorAll('[data-view]').forEach(btn=>btn.classList.toggle('current',btn.dataset.view===mode));$('navHome').classList.toggle('selected',mode==='humanoid'||mode==='spatial');$('navGrid').classList.toggle('selected',mode==='grid');if(humanoidEngine)humanoidEngine.setVisible(mode==='humanoid'&&$('humanoidShell').dataset.visual==='particles');placeModules();}
function selectModule(id){if(!modules.some(m=>m.id===id))return;state.selected=id;document.querySelectorAll('.module-card').forEach(card=>card.classList.toggle('active',card.dataset.module===id));renderSignal();}
function moduleCard(m,i){const button=document.createElement('button');button.className='module-card';button.type='button';button.dataset.module=m.id;button.setAttribute('aria-label','Inspect '+m.name);button.innerHTML=`<div class="module-header"><span class="module-icon">${svg(m.icon)}</span><span class="module-num">0${i+1}</span></div><div class="module-title">${safe(m.name)}</div><div class="module-sub">${safe(m.sub)}</div>${svg('i-chevron').replace('<svg ','<svg class="module-chevron" ')}`;button.addEventListener('click',()=>{selectModule(m.id);if(matchMedia('(max-width:1130px)').matches)toast(m.name+' selected — inspect details on larger screens or use quick commands');});return button;}
modules.forEach((m,i)=>$('orbitCards').appendChild(moduleCard(m,i)));
function placeModules(){const rect=$('universe').getBoundingClientRect();const w=Math.max(310,rect.width),h=Math.max(340,rect.height);const mobile=w<600;const cards=Array.from($('orbitCards').children);if(state.view==='grid'){
 cards.forEach((c,i)=>{const cols=mobile?2:3;const row=Math.floor(i/cols),col=i%cols;c.style.left=`${(col+.5)*(100/cols)}%`;c.style.top=`${mobile?(row+.5)*23+4:(row+.5)*43+7}%`;c.style.transform='translate(-50%,-50%) rotateY(0deg) scale(1)';c.style.opacity='1';c.style.zIndex='3';});return;
 }
 const rx=Math.min(w*(mobile?.35:.345),330),ry=Math.min(h*(mobile?.34:.35),185);
 cards.forEach((c,i)=>{const a=-Math.PI/2+i*Math.PI*2/modules.length+state.orbit;const x=Math.cos(a)*rx,y=Math.sin(a)*ry;const depth=(Math.sin(a)+1)/2;const scale=(mobile?.84:.88)+depth*(mobile?.10:.15);c.style.left=`${w/2+x}px`;c.style.top=`${h*.48+y}px`;c.style.transform=`translate(-50%,-50%) perspective(800px) rotateY(${-Math.cos(a)*11}deg) rotateX(${Math.sin(a)*3}deg) scale(${scale})`;c.style.zIndex=String(Math.round(depth*7)+1);c.style.opacity=state.view==='focus'?'0':String(.7+depth*.3);});
}
function getModuleInfo(){const id=state.selected;const mem=navigator.deviceMemory?`${navigator.deviceMemory} GB estimated RAM`:'Memory unavailable';
 switch(id){
 case 'aem':{const d=state.aem;const down=d?.sites?.filter(s=>s.health==='down').length??0;const label=d?.mode==='live'?'LIVE · ADOBE API':'DEMO · SIMULATED';const healthy=d?.sites?.filter(s=>s.health==='healthy').length??0;return {title:'AEM Cloud',state:d?label:'FETCHING · CLOUD DATA',value:d?`${healthy}/${d.sites.length}`:'—',sub:d?`${d.mode==='mock'?'Synthetic':'Monitored'} sites · ${down} down · ${d.executions.length} sampled executions`:'Cloud Manager data contract available in mock mode.',foot:d?.mode==='live'?'READ-ONLY LIVE INTEGRATION':'SYNTHETIC PLATFORM HEALTH',action:'Open operations',do:openAem,icon:'i-target'};}
 case 'weather': return {title:'Weather',state:state.weather?'LIVE · OPEN-METEO':'LOCATION REQUIRED',value:state.weather?`${Math.round(state.weather.temperature)}°${state.weather.unit}`:'—',sub:state.weather?`${state.weather.description} · Wind ${Math.round(state.weather.wind)} km/h`:'Enable location to read live weather.',foot:'LOCAL FORECAST',action:state.weather?'Refresh':'Connect',do:()=>loadWeather(true),icon:'i-sun'};
 case 'github':return {title:'GitHub',state:state.github?'LIVE · PUBLIC API':'USERNAME REQUIRED',value:state.github?String(state.github.public_repos):'—',sub:state.github?`Public repositories · ${state.github.followers} followers`:'Add a GitHub username in settings.',foot:'REPOSITORY SIGNAL',action:state.github?'Refresh':'Set up',do:()=>state.github?loadGithub():openOverlay('settingsOverlay'),icon:'i-github'};
 case 'calendar':{const sorted=state.events.filter(e=>new Date(e.when).getTime()>Date.now()).sort((a,b)=>new Date(a.when)-new Date(b.when));return {title:'Calendar',state:'LOCAL · NOT SYNCED',value:String(sorted.length).padStart(2,'0'),sub:sorted.length?`Next: ${sorted[0].title} · ${new Date(sorted[0].when).toLocaleString()}`:'No upcoming events on this device.',foot:'LOCAL EVENTS',action:'Add event',do:addEvent,icon:'i-calendar'};}
 case 'system':return {title:'System',state:'LIVE · BROWSER',value:`${navigator.hardwareConcurrency||'—'} ${navigator.hardwareConcurrency?'cores':'core data'}`,sub:`Browser logical processors · ${mem}`,foot:'BROWSER SIGNAL',action:'Refresh',do:renderSignal,icon:'i-cpu'};
 case 'agents':return {title:'AI Agents',state:state.backend?.aiConfigured?'CONNECTED · '+(state.backend?.provider||'CLAUDE').toUpperCase():'SETUP REQUIRED',value:state.backend?.aiConfigured?'Ready':'Offline',sub:state.backend?.aiConfigured?(state.backend?.provider||'Claude')+' reasoning endpoint connected.':'Add ANTHROPIC_API_KEY to Cloudflare Worker secrets.',foot:'MODEL ROUTING',action:'Open AI chat',do:()=>openOverlay('chatOverlay'),icon:'i-sparkles'};
 case 'notes':return {title:'Memory',state:'LOCAL · THIS DEVICE',value:String(state.notes.length).padStart(2,'0'),sub:state.notes.length?state.notes[state.notes.length-1].text.slice(0,90):'Capture thoughts and keep them on this device.',foot:'LOCAL NOTES',action:'Add note',do:addNote,icon:'i-notes'};
 }
}
function renderSignal(){const m=modules.find(m=>m.id===state.selected);const info=getModuleInfo();const idx=modules.indexOf(m)+1;$('signalIndex').textContent=`0${idx} / 07`;const panel=$('signalPanel');panel.innerHTML=`<div class="signal-panel-top"><span class="signal-panel-icon">${svg(info.icon)}</span><div><div class="signal-panel-name">${safe(info.title)}</div><div class="signal-panel-state">${safe(info.state)}</div></div></div><div class="signal-stat">${safe(info.value)}</div><div class="signal-stat-sub">${safe(info.sub)}</div><div class="signal-foot"><span>${safe(info.foot)}</span><button id="signalAction" type="button">${safe(info.action)} ↗</button></div>`;panel.querySelector('button').addEventListener('click',info.do);}
function openOverlay(id){const el=$(id);el.classList.remove('hidden');el.setAttribute('aria-hidden','false');if(id==='chatOverlay'){renderMessages();$('drawerChatInput').focus();}if(id==='settingsOverlay'){renderSettings();$('githubInput').focus();}if(id==='aemOverlay'){renderAem();}}
function closeOverlay(id){const el=$(id);el.classList.add('hidden');el.setAttribute('aria-hidden','true');}
function renderSettings(){$('githubInput').value=state.settings.github||'';$('speakResponses').checked=!!state.settings.speak;$('connectionInfo').textContent=state.backend===null?'No Worker API detected yet. UI and local commands still work.':state.backend.aiConfigured?'Cloudflare API reachable · '+(state.backend?.provider||'Claude')+' configured.':'Cloudflare API reachable · AI not configured. Add the ANTHROPIC_API_KEY secret for Claude chat.';}
function persistMessages(){state.messages=state.messages.slice(-30);save('messages',state.messages);}
function pushMessage(role,text){state.messages.push({role,text:String(text),at:Date.now()});persistMessages();renderMessages();if(role==='assistant'){setHumanoidState('speaking');if(state.settings.speak&&'speechSynthesis'in window){speechSynthesis.cancel();const utter=new SpeechSynthesisUtterance(String(text).slice(0,1400));utter.rate=1.03;utter.onend=()=>setHumanoidState('idle');utter.onerror=()=>setHumanoidState('idle');speechSynthesis.speak(utter);}else{setTimeout(()=>setHumanoidState('idle'),1800);}}}
function renderMessages(){const container=$('chatMessages');container.replaceChildren();if(state.messages.length===0){const bubble=document.createElement('div');bubble.className='chat-bubble assistant';bubble.textContent='Welcome to Nexora Spatial. I can open modules, check the time, inspect browser telemetry, save local notes, and—when Claude is connected—answer questions. What would you like to explore?';container.append(bubble);}else{for(const msg of state.messages){const bubble=document.createElement('div');bubble.className='chat-bubble '+(msg.role==='user'?'user':'assistant');const label=document.createElement('div');label.className='chat-label';label.textContent=msg.role==='user'?'YOU':'NEXORA';const content=document.createElement('div');content.textContent=msg.text;bubble.append(label,content);container.append(bubble);}}container.scrollTop=container.scrollHeight;}
function resolveLocal(input){const q=input.trim(),s=q.toLowerCase();if(/^(open|show|go to|display|inspect)\b/.test(s)){
 const found=modules.find(m=>s.includes(m.id)||s.includes(m.name.toLowerCase())||(m.id==='agents'&&s.includes('assistant'))||(m.id==='notes'&&s.includes('memory')));
 if(found){selectModule(found.id);return `Opened ${found.name}. ${getModuleInfo().sub}`;}}
 if(/^(humanoid|avatar|spatial|focus|grid)( mode| view)?$/.test(s)||/^switch to (humanoid|avatar|spatial|focus|grid)/.test(s)){let view=s.includes('humanoid')||s.includes('avatar')?'humanoid':s.includes('spatial')?'spatial':s.includes('focus')?'focus':'grid';setView(view);return `Switched to ${view} view.`;}
 if(/\b(what time|current time|time now)\b/.test(s))return `Your local time is ${new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})} on ${new Date().toLocaleDateString([], {weekday:'long',month:'long',day:'numeric',year:'numeric'})}.`;
 if(/\b(what date|today.s date|date today)\b/.test(s))return `Today is ${new Date().toLocaleDateString([], {weekday:'long',month:'long',day:'numeric',year:'numeric'})}.`;
 if(/\b(deployments? (this|last) quarter|rollback(s)? (this|last) quarter)\b/.test(s)){if(!state.aem)return 'AEM data is not loaded yet. Open the AEM Cloud module.';if(/rollback/.test(s))return 'Rollback count is unknown. '+state.aem.rollbacks.reason;if(state.aem.mode==='mock')return 'Demonstration only: the simulator contains '+state.aem.executions.length+' sample pipeline executions, not a quarter of verified production deployments.';return 'Adobe connector exposes only a limited recent execution sample. Full quarterly deployment totals require complete pagination and filtering by production deployment completion.';}
 if(/\b(system status|system telemetry|device status)\b/.test(s)){selectModule('system');return `Browser telemetry: ${navigator.hardwareConcurrency??'unknown'} logical processors, ${navigator.deviceMemory??'unknown'} GB estimated device memory, ${navigator.onLine?'browser network online':'browser network offline'}. This is not host-server telemetry.`;}
 if(/^add note\s+.+/i.test(q)){const content=q.replace(/^add note\s+/i,'');state.notes.push({text:content,at:new Date().toISOString()});save('notes',state.notes);selectModule('notes');return 'Saved a note locally: '+content;}
 if(/^(list|show|read) (my )?notes$/.test(s)){selectModule('notes');return state.notes.length?`Local notes:\n${state.notes.slice(-8).map((n,i)=>`${i+1}. ${n.text}`).join('\n')}`:'You have no saved notes yet. Try: “add note Prepare weekly engineering review”.';}
 if(/^(help|what can you do\??|show commands)$/.test(s))return 'I can open AEM Cloud, Weather, GitHub, Calendar, System, AI Agents, or Memory; show your local time and browser telemetry; switch humanoid, spatial, grid, and focus views; and save or list local notes. Connect an Anthropic key for general AI conversation.';
 if(/^(clear conversation|clear chat)$/.test(s)){state.messages=[];persistMessages();return 'Conversation history cleared on this device.';}
 return null;
}
async function sendCommand(input){const command=String(input??'').trim();if(!command||state.busy)return;state.busy=true;setHumanoidState('thinking');openOverlay('chatOverlay');pushMessage('user',command);$('commandInput').value='';$('drawerChatInput').value='';$('sendBtn').disabled=true;
 try{const local=resolveLocal(command);if(local!==null){pushMessage('assistant',local);return;}
 if(!state.backend?.aiConfigured){pushMessage('assistant','The conversational AI is not connected yet. Add an ANTHROPIC_API_KEY Worker secret and deploy the app to Cloudflare to enable AI responses. Local workspace commands already work. Open Settings for connection status.');return;}
 const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:command,messages:state.messages.filter(m=>m.role==='user'||m.role==='assistant').slice(-12)})});const data=await response.json();if(!response.ok)throw Error(data.error||'AI service failed');pushMessage('assistant',data.answer||'No response returned.');
 }catch(e){pushMessage('assistant','Unable to complete the request: '+e.message);}finally{state.busy=false;$('sendBtn').disabled=false;}}
async function loadAem(){
  try{const res=await fetch('/api/aem/overview?scenario='+encodeURIComponent(state.aemScenario),{headers:{'accept':'application/json'}});const result=await res.json();if(!res.ok)throw Error(result.error||'Unable to read AEM data');state.aem=result;renderSignal();renderAem();$('lastSync').textContent=result.mode==='mock'?'AEM SIMULATOR':'AEM API';}
  catch(e){state.aem=null;renderSignal();renderAem('Unable to load AEM data: '+e.message);toast('AEM: '+e.message);}
}
function openAem(){selectModule('aem');openOverlay('aemOverlay');if(!state.aem)loadAem();}
function renderAem(failure){const container=$('aemStats');if(!container)return;
  if(failure){container.textContent=failure;return;}
  const d=state.aem;if(!d){container.textContent='Waiting for the AEM adapter…';return;}
  $('aemDataLabel').textContent=d.mode==='mock'?'SIMULATED DATA — NOT ADOBE':'LIVE ADOBE API — AUTHORIZED ONLY';
  $('aemScenario').disabled=d.mode==='live';$('aemScenario').value=state.aemScenario;
  const ready=d.sites.filter(s=>s.health==='healthy').length,down=d.sites.filter(s=>s.health==='down').length;
  const finished=d.executions.filter(x=>x.status==='FINISHED').length;
  const metrics=[['Programs',d.programs.length],['Environments',d.environments.length],['Healthy sites',`${ready}/${d.sites.length}`],['Failed sites',down],['Sampled executions',d.executions.length],['Finished samples',finished],['Rollbacks','Unknown']];
  container.innerHTML=metrics.map(([k,v])=>`<div class="aem-stat"><div class="aem-stat-value">${safe(v)}</div><div class="aem-stat-label">${safe(k)}</div></div>`).join('');
  $('aemSitesCount').textContent=`(${d.sites.length} total; showing up to 12)`;
  $('aemSiteNote').textContent=d.mode==='mock'?'Entirely synthetic demonstrations. No public or Adobe site is being probed.':'Site inventory not configured. Cloud Manager API alone does not enumerate every website hostname.';
  $('aemSites').innerHTML=d.sites.length?d.sites.slice(0,12).map(s=>`<div class="aem-row"><span class="aem-status ${safe(s.health)}"></span><div><strong>${safe(s.name)}</strong><small>${safe(s.region||'')} · ${safe(s.url||'')}</small></div><span class="aem-row-right">${safe(s.health)}${s.latencyMs?' · '+safe(s.latencyMs)+' ms':''}</span></div>`).join(''):'<div class="aem-empty">No site inventory connected. This is not a zero-outage claim.</div>';
  $('aemCoverage').textContent=d.mode==='mock'?'Simulated execution samples; not an actual deployment or quarterly rollback count.':'Read-only recent execution sample; incomplete data must not be reported as full-quarter totals.';
  $('aemDeployments').innerHTML=d.executions.length?d.executions.slice(0,20).map(x=>`<div class="aem-row"><span class="aem-status ${x.status==='FINISHED'?'healthy':x.status==='ERROR'?'down':'degraded'}"></span><div><strong>${safe(x.pipelineName)}</strong><small>${safe(x.id)} · ${safe(x.startedAt?new Date(x.startedAt).toLocaleString():'No timestamp')}</small></div><span class="aem-row-right">${safe(x.status)}</span></div>`).join(''):'<div class="aem-empty">No execution records returned by the selected source.</div>';
  $('aemAlerts').innerHTML=[...(d.alerts||[]).map(a=>`<div class="aem-alert">${safe(a.severity)} · ${safe(a.message)}</div>`),...(d.warnings||[]).map(w=>`<div class="aem-alert">Partial data · ${safe(w)}</div>`),`<div class="aem-empty">Rollbacks: ${safe(d.rollbacks?.reason||'Unknown')}</div>`].join('');
}
function addNote(){const text=window.prompt('Write a note to save on this device:');if(text===null)return;if(!text.trim())return toast('Note cannot be empty');state.notes.push({text:text.trim().slice(0,600),at:new Date().toISOString()});save('notes',state.notes);renderSignal();toast('Note saved on this device');}
function addEvent(){const title=window.prompt('Event title (stored only in this browser):');if(!title?.trim())return;const when=window.prompt('Date and time (YYYY-MM-DD HH:MM):',new Date(Date.now()+86400000).toISOString().slice(0,16).replace('T',' '));if(!when)return;const parsed=new Date(when.replace(' ','T'));if(!Number.isFinite(parsed.getTime()))return toast('Enter a valid date and time');state.events.push({title:title.trim().slice(0,120),when:parsed.toISOString()});save('events',state.events);renderSignal();toast('Local event added — not synced with a calendar provider');}
async function checkBackend(){try{const controller=new AbortController();const t=setTimeout(()=>controller.abort(),4500);const res=await fetch('/api/health',{signal:controller.signal});clearTimeout(t);if(!res.ok)throw Error('No API');const data=await res.json();if(!data||data.service!=='nexora-spatial')throw Error('Not Worker');state.backend=data;}catch{state.backend=null;} $('chatMode').textContent=state.backend?.aiConfigured?(state.backend?.provider||'Claude')+' connected · commands and AI available':'Local commands available · Claude requires a Worker secret';renderSignal();}
async function loadGithub(){const user=state.settings.github?.trim();if(!user){openOverlay('settingsOverlay');return;}try{const res=await fetch('/api/github?username='+encodeURIComponent(user));const data=await res.json();if(!res.ok)throw Error(data.error||'GitHub request failed');state.github=data;$('lastSync').textContent='GITHUB SYNCED';renderSignal();toast('GitHub public profile updated');}catch(e){state.github=null;renderSignal();toast('GitHub: '+e.message);}}
function getLocation(){return new Promise((resolve,reject)=>{if(!navigator.geolocation)return reject(Error('Geolocation unavailable'));navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lon:p.coords.longitude}),e=>reject(Error(e.message)),{enableHighAccuracy:false,timeout:12000,maximumAge:600000});});}
async function loadWeather(requestLocation=false){try{if(!state.geo||requestLocation){state.geo=await getLocation();}const {lat,lon}=state.geo;const res=await fetch(`/api/weather?lat=${encodeURIComponent(lat.toFixed(4))}&lon=${encodeURIComponent(lon.toFixed(4))}`);const data=await res.json();if(!res.ok)throw Error(data.error||'Weather request failed');state.weather=data;renderSignal();toast('Live weather updated');}catch(e){toast('Weather: '+e.message);renderSignal();}}
function speakCommand(){setView('humanoid');setHumanoidState('listening');const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Recognition){toast('Speech recognition is unavailable in this browser. Try desktop Chrome or Edge.');setHumanoidState('idle');return;}if(state.recognized){state.recognized.stop();state.recognized=null;return;}try{const recognition=new Recognition();state.recognized=recognition;recognition.lang=navigator.language||'en-US';recognition.continuous=false;recognition.interimResults=false;recognition.onresult=e=>{const text=e.results[0][0].transcript;$('commandInput').value=text;sendCommand(text);};recognition.onerror=e=>toast('Voice: '+e.error);recognition.onend=()=>{$('micBtn').classList.remove('listening');state.recognized=null;if(!state.busy)setHumanoidState('idle');};recognition.start();$('micBtn').classList.add('listening');toast('Listening for a command…');}catch(e){toast(e.message);setHumanoidState('idle');}}

function startAvatarVisuals(){
 const shell=$('humanoidShell'),layer=$('avatarEffects');const ctx=layer.getContext('2d');
 if(!ctx)return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let pX=0,pY=0,xx=0,yy=0,tm=0;
 const motes=Array.from({length:175},(_,i)=>({x:Math.random(),y:Math.random(),size:.5+Math.random()*1.7,rate:.1+Math.random()*.24,ph:Math.random()*6.283,amber:Math.random()>.74}));
 shell.addEventListener('pointermove',e=>{
  if(shell.dataset.visual!=='portrait')return;
  const r=shell.getBoundingClientRect();pX=((e.clientX-r.left)/r.width-.5)*2;pY=((e.clientY-r.top)/r.height-.5)*2;
 });
 shell.addEventListener('pointerleave',()=>{pX=0;pY=0});
 let last=0;
 function paint(t){requestAnimationFrame(paint);
  if(shell.dataset.visual!=='portrait'||document.hidden||t-last<(reduced?145:38))return;last=t;
  const r=layer.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.5);
  const w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);
  if(layer.width!==w||layer.height!==h){layer.width=w;layer.height=h;ctx.setTransform(dpr,0,0,dpr,0,0);}
  const W=r.width,H=r.height;ctx.clearRect(0,0,W,H);
  xx+=(pX-xx)*.055;yy+=(pY-yy)*.055;
  shell.style.setProperty('--avatar-px',(xx*11).toFixed(1)+'px');
  shell.style.setProperty('--avatar-py',(yy*5).toFixed(1)+'px');
  shell.style.setProperty('--avatar-ry',(xx*2.3).toFixed(2)+'deg');
  const mode=shell.dataset.mode||'idle';const active=mode==='listening'||mode==='thinking'||mode==='speaking';
  const pulse=mode==='speaking'? .40+.25*Math.sin(t*.013):mode==='thinking'?.20+.16*Math.sin(t*.004):mode==='listening'?.22+.16*Math.sin(t*.009):.03;
  const x=W*.5,y=H*.47;
  // Spaced concentric energy contours expand in the active states.
  if(active){for(let k=0;k<3;k++){
   ctx.beginPath();ctx.strokeStyle=mode==='thinking'?'rgba(153,137,255,'+(.13+pulse*.16)+')':mode==='speaking'?'rgba(254,184,112,'+(.13+pulse*.16)+')':'rgba(100,240,255,'+(.11+pulse*.15)+')';
   ctx.lineWidth=.75;ctx.ellipse(x,y+H*.19,W*(.17+k*.055+pulse*.015),H*(.26+k*.065+pulse*.01),-.1,0,Math.PI*2);ctx.stroke();
  }}
  for(const m of motes){const drift=reduced?0:t*.00008*m.rate;
   const px=(m.x+.025*Math.sin(m.ph+drift*21))*W,py=((m.y+drift)%1)*H;
   const alpha=(.12+.13*(.5+.5*Math.sin(t*.0019+m.ph)))*(active?1.55:1);
   ctx.fillStyle=m.amber?'rgba(255,172,109,'+alpha+')':'rgba(91,227,248,'+alpha+')';
   ctx.fillRect(px,py,m.size,m.size);
  }
 }
 requestAnimationFrame(paint);
}
function wire(){document.querySelectorAll('.visual-switch [data-visual]').forEach(b=>b.addEventListener('click',()=>setVisual(b.dataset.visual)));document.querySelectorAll('.view-button').forEach(btn=>btn.addEventListener('click',()=>setView(btn.dataset.view)));$('navHome').addEventListener('click',()=>setView('humanoid'));$('navGrid').addEventListener('click',()=>setView('grid'));$('navAem').addEventListener('click',openAem);$('aemHudButton').addEventListener('click',openAem);$('navNotes').addEventListener('click',()=>{selectModule('notes');setView('grid');});$('navAssistant').addEventListener('click',()=>openOverlay('chatOverlay'));$('coreLabel').addEventListener('click',()=>openOverlay('chatOverlay'));$('assistantOpen').addEventListener('click',()=>openOverlay('chatOverlay'));$('settingsBtn').addEventListener('click',()=>openOverlay('settingsOverlay'));
 document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click',()=>closeOverlay(btn.dataset.close)));document.querySelectorAll('.overlay').forEach(el=>el.addEventListener('mousedown',e=>{if(e.target===el)closeOverlay(el.id);}));document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeOverlay('chatOverlay');closeOverlay('settingsOverlay');closeOverlay('aemOverlay');}if(e.key==='/'&&!/input|textarea/i.test(document.activeElement.tagName)){e.preventDefault();$('commandInput').focus();}});
 $('commandForm').addEventListener('submit',e=>{e.preventDefault();sendCommand($('commandInput').value);});$('drawerChatForm').addEventListener('submit',e=>{e.preventDefault();sendCommand($('drawerChatInput').value);});$('micBtn').addEventListener('click',speakCommand);$('humanoidAsk').addEventListener('click',()=>openOverlay('chatOverlay'));document.querySelectorAll('[data-humanoid-state]').forEach(b=>b.addEventListener('click',()=>setHumanoidState(b.dataset.humanoidState)));$('humanoidCanvas').addEventListener('click',()=>{if(state.view==='humanoid')setHumanoidState(humanoidEngine?.getMode()==='listening'?'idle':'listening');});
 document.querySelectorAll('.quick-command').forEach(btn=>btn.addEventListener('click',()=>sendCommand(btn.dataset.command)));document.querySelectorAll('[data-prompt]').forEach(btn=>btn.addEventListener('click',()=>sendCommand(btn.dataset.prompt)));
 $('saveSettings').addEventListener('click',()=>{const name=$('githubInput').value.trim();if(name&&!/^[a-zA-Z\d](?:[a-zA-Z\d-]{0,37}[a-zA-Z\d])?$/.test(name)){toast('Enter a valid GitHub username');return;}state.settings={github:name,speak:$('speakResponses').checked};save('settings',state.settings);closeOverlay('settingsOverlay');renderSignal();toast('Preferences saved');if(name)loadGithub();});$('aemRefresh').addEventListener('click',loadAem);$('aemScenario').addEventListener('change',e=>{state.aemScenario=e.target.value;loadAem();});$('weatherConnect').addEventListener('click',()=>{closeOverlay('settingsOverlay');selectModule('weather');loadWeather(true);});
 const univ=$('universe');let beginX=0,beginOrbit=0;univ.addEventListener('pointerdown',e=>{if(e.target.closest('button')||e.target.closest('.humanoid-shell'))return;state.dragging=true;beginX=e.clientX;beginOrbit=state.orbit;univ.setPointerCapture(e.pointerId);});univ.addEventListener('pointermove',e=>{if(!state.dragging||state.view!=='spatial')return;state.orbit=beginOrbit+(e.clientX-beginX)*.006;state.lastMove=performance.now();placeModules();});univ.addEventListener('pointerup',()=>{state.dragging=false;state.lastMove=performance.now();});univ.addEventListener('pointercancel',()=>state.dragging=false);
 window.addEventListener('resize',placeModules,{passive:true});
}
function renderOrb(){const canvas=$('orbCanvas');const ctx=canvas.getContext('2d');if(!ctx)return;const particles=[];const count=610;const gr=Math.PI*(3-Math.sqrt(5));for(let i=0;i<count;i++){const y=1-(i/(count-1))*2,rad=Math.sqrt(1-y*y),theta=gr*i;particles.push([Math.cos(theta)*rad,y,Math.sin(theta)*rad]);}
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;let frame=0;
 const draw=()=>{frame++;if(document.hidden){rafId=requestAnimationFrame(draw);return;}const size=Math.min(canvas.clientWidth||360,canvas.clientHeight||360);const dpr=Math.min(window.devicePixelRatio||1,2),px=Math.max(1,Math.round(size*dpr));if(canvas.width!==px||canvas.height!==px){canvas.width=px;canvas.height=px;}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,size,size);const cx=size/2,cy=size/2,r=size*.315;const t=reduce?.8:performance.now()*.00019;
 const halo=ctx.createRadialGradient(cx,cy,r*.02,cx,cy,r*1.5);halo.addColorStop(0,'rgba(170,158,255,.09)');halo.addColorStop(.57,'rgba(139,158,255,.13)');halo.addColorStop(.8,'rgba(137,181,235,.03)');halo.addColorStop(1,'rgba(137,181,235,0)');ctx.fillStyle=halo;ctx.beginPath();ctx.arc(cx,cy,r*1.5,0,Math.PI*2);ctx.fill();
 for(let lat=-1;lat<=1;lat+=.25){const latRad=Math.asin(Math.max(-1,Math.min(1,lat))),ringRad=Math.cos(latRad);ctx.beginPath();for(let j=0;j<=85;j++){const a=j/85*Math.PI*2,xx=Math.cos(a)*ringRad,yy=lat,zz=Math.sin(a)*ringRad;const xr=xx*Math.cos(t)-zz*Math.sin(t),zr=xx*Math.sin(t)+zz*Math.cos(t);const k=1/(1+zr*.18),sx=cx+xr*r*k,sy=cy+yy*r*k;if(j===0)ctx.moveTo(sx,sy);else ctx.lineTo(sx,sy);}ctx.strokeStyle='rgba(178,186,245,.075)';ctx.lineWidth=.5;ctx.stroke();}
 const pts=[];for(const p of particles){let [x,y,z]=p;const xx=x*Math.cos(t)-z*Math.sin(t),zz=x*Math.sin(t)+z*Math.cos(t);const yy=y*Math.cos(t*.6)-zz*Math.sin(t*.6),zzz=y*Math.sin(t*.6)+zz*Math.cos(t*.6);const k=1/(1+zzz*.24);pts.push([cx+xx*r*k,cy+yy*r*k,zzz]);}pts.sort((a,b)=>a[2]-b[2]);for(let i=0;i<pts.length;i++){const [x,y,z]=pts[i];const alpha=.12+(z+1)*.28;const point=1.05+(z+1)*.6;ctx.fillStyle=(i%5===0?`rgba(216,250,155,${alpha*.7})`:`rgba(184,173,255,${alpha})`);ctx.beginPath();ctx.arc(x,y,point,0,Math.PI*2);ctx.fill();}
 ctx.save();ctx.translate(cx,cy);ctx.rotate(-.45+t*.1);ctx.beginPath();ctx.ellipse(0,0,r*1.28,r*.28,0,0,Math.PI*2);ctx.strokeStyle='rgba(214,249,162,.19)';ctx.lineWidth=.8;ctx.stroke();ctx.restore();
 rafId=requestAnimationFrame(draw);
 };draw();}
function heartbeat(){const now=new Date();const time=now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});document.title=`Nexora Spatial — ${time}`;if(state.view==='spatial'&&!state.dragging&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&performance.now()-state.lastMove>5000){state.orbit+=.0005;placeModules();}}
humanoidEngine=window.NexoraHumanoid?.init($('humanoidCanvas'),onHumanoidState);startAvatarVisuals();wire();selectModule('aem');placeModules();setView('humanoid');renderOrb();renderMessages();checkBackend();loadAem();if(state.settings.github)loadGithub();setInterval(heartbeat,120);window.addEventListener('beforeunload',()=>cancelAnimationFrame(rafId));
})();
