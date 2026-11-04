/* V8 compatibility layer: keep question controls out of the stage; use fast voice unless neural is explicitly selected. */
(()=>{
 'use strict';
 const panel=document.getElementById('demoPanel');
 if(panel && panel.parentElement!==document.body)document.body.appendChild(panel);
 const source=document.getElementById('demoVoiceSource');
 let explicitlyNeural=false;
 source?.addEventListener('change',()=>{explicitlyNeural=source.value==='neural';},true);
 document.addEventListener('click',(event)=>{
   const live=event.target.closest?.('[data-visual="live"], #live3dOpen');
   if(!live||!source||source.value!=='browser'||explicitlyNeural)return;
   setTimeout(()=>{
     if(source.value==='neural'&&!explicitlyNeural){
       source.value='browser';source.dispatchEvent(new Event('change',{bubbles:true}));
       const hint=document.getElementById('demoVoiceHint');
       if(hint)hint.textContent='Device Voice responds quickly. Choose Kokoro neural for higher-quality speech and 3D lip sync.';
     }
   },0);
 },true);
})();