/* Nexora Presence v3: original GPU particle portrait.
   Procedural geometry and shaders, no third-party models or licensed artwork.
   WebGL1/2 compatible and runs as a standalone HTML asset.
*/
(() => {
 'use strict';
 const TAU=Math.PI*2;
 const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
 const gauss=(v,s)=>Math.exp(-.5*(v/s)**2);
 let seed=0xa61c4f2b;const rand=()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
 const between=(a,b)=>a+(b-a)*rand();
 const smooth=(a)=>{a=clamp(a);return a*a*(3-2*a);};
 const keys=[[.235,.04],[.32,.245],[.46,.395],[.62,.505],[.87,.608],[1.12,.677],[1.45,.704],[1.68,.673],[1.95,.604],[2.17,.44],[2.27,.26],[2.32,.02]];
 function widthAt(y){for(let i=1;i<keys.length;i++)if(y<keys[i][0]){let p=keys[i-1],q=keys[i],t=smooth((y-p[0])/(q[0]-p[0]));return p[1]+t*(q[1]-p[1]);}return .02;}
 const face=(x,y)=>{
  const w=Math.max(.03,widthAt(y)),u=clamp(Math.abs(x)/w);
  let z=.05+.695*Math.pow(Math.max(.008,1-u*u),.59);
  z+=.081*(gauss(x-.41,.175)+gauss(x+.41,.175))*gauss(y-1.115,.27); // cheekbones
  z+=.108*(gauss(x-.30,.16)+gauss(x+.30,.16))*gauss(y-1.49,.073); // brow ridge
  z-=.15*(gauss(x-.294,.135)+gauss(x+.294,.135))*gauss(y-1.318,.080); // eye socket
  z-=.025*gauss(x,.24)*gauss(y-1.66,.2); // frontal hollow
  z+=.185*gauss(x,.075)*gauss(y-1.18,.27); // bridge
  z+=.265*gauss(x,.092)*gauss(y-.945,.087); // tip
  z+=.080*(gauss(x-.125,.056)+gauss(x+.125,.056))*gauss(y-.918,.08); // nose wings
  z-=.037*(gauss(x-.097,.033)+gauss(x+.097,.033))*gauss(y-.873,.027); // nostril undercut
  z+=.070*gauss(x,.205)*gauss(y-.71,.071); // lips
  z-=.041*gauss(x,.20)*gauss(y-.555,.045); // lower lip shadow
  z+=.049*gauss(x,.255)*gauss(y-.405,.115); // chin
  return z;
 };
 // Vertices encode x,y,z; RGB; alpha; size, phase, feature type, seed for shader animation.
 const pos=[],rgba=[],meta=[];let count=0;
 function emit(x,y,z,r,g,b,a,s=1,feature=0){
  pos.push(x,y,z);rgba.push(r,g,b,a);meta.push(s,rand()*TAU,feature,rand());count++;
 }
 const baseC=[.14,.68,.83],baseG=[.98,.66,.37],wh=[.77,.91,.99];
 function emitLit(x,y,z,kind=0,alpha=1,size=1){
  // Spatially coherent two-sided cyan/amber illumination, not a hard left/right stripe.
  const illumination=clamp(.17 +.50*(z+.3)+.16*gauss(x+.41,.34));
  const warm=clamp(.16+.52*smooth((x+.16)*.81)+.25*Math.pow(rand(),8));
  const r=baseC[0]*(1-warm)+baseG[0]*warm;
  const g=baseC[1]*(1-warm)+baseG[1]*warm;
  const b=baseC[2]*(1-warm)+baseG[2]*warm;
  const br=between(.64,1.2)*illumination;
  if(kind===1){emit(x,y,z,.03,.095,.15,.71*alpha,size,1);return;}// eye shadow
  if(kind===2){emit(x,y,z,.91,.74,.46,.93*alpha,size,2);return;}// iris/glow gold
  if(kind===3){emit(x,y,z,.018,.065,.10,alpha,size,3);return;}// pupil/nostril
  if(kind===4){emit(x,y,z,.60,.91,1,.75*alpha,size,4);return;}// fine highlighted ridge
  if(kind===5){emit(x,y,z,.89,.49,.30,.74*alpha,size,5);return;}// lips
  if(kind===6){emit(x,y,z,.013,.053,.081,alpha,size,6);return;}// mouth opening
  if(kind===7){emit(x,y,z,.21,.88,.93,alpha,size,7);return;}// lens flare/filament
  if(kind===8){emit(x,y,z,.56,.40,.24,.7*alpha,size,8);return;}// body joint
  if(kind===9){emit(x,y,z,.91,.65,.38,alpha,size,9);return;}// jaw accent
  if(kind===10){emit(x,y,z,.39,.87,1,alpha,size,10);return;}// hair rim
  emit(x,y,z,r*br,g*br,b*br,alpha*between(.60,1),size,0);
 }
 function eyeKind(x,y){
  for(const sign of [-1,1]){
   const ex=sign*.294,ey=1.317,dx=(x-ex)/.152,dy=(y-ey)/.055;
   const eye=dx*dx+dy*dy;
   if(eye<.92){
    const rd=Math.hypot((x-ex)/.044,(y-ey)/.044);
    if(rd<.43)return 3;
    if(rd<.98)return 2;
    return 1;
   }
   const browY=1.475+.018*Math.cos((x-ex)/.18*Math.PI);
   if(Math.abs(x-ex)<.176&&Math.abs(y-browY)<.010)return 4;
  }
  const mouth=.711+.012*Math.cos(x/.245*Math.PI);
  if(Math.abs(x)<.226&&Math.abs(y-mouth)<.013)return 6;
  if(Math.abs(x)<.248&&Math.abs(y-(mouth+.038*(1-(x/.25)**2)))<.013)return 5;
  if(Math.abs(x)<.242&&Math.abs(y-(mouth-.040*(1-(x/.25)**2)))<.012)return 5;
  if(Math.abs(x-.106)<.024&&Math.abs(y-.871)<.019)return 3;
  if(Math.abs(x+.106)<.024&&Math.abs(y-.871)<.019)return 3;
  return 0;
 }
 // Dense but spatially uniform face skin (fixed seed ensures stable, testable layout).
 for(let i=0;i<94000;i++){
  const y=between(.242,2.315),w=widthAt(y);
  const x=between(-w,w),f=eyeKind(x,y);
  emitLit(x,y,face(x,y)+between(-.005,.005),f,between(.60,.98),between(.70,1.25));
 }
 // Curved lateral shell, back skull and ears provide genuine 3D depth during head movement.
 for(let i=0;i<26000;i++){
  const y=between(.30,2.32),angle=between(0,TAU),w=widthAt(y);
  let x=w*Math.cos(angle),z=-.05+.63*Math.sin(angle);
  if(z>.43)continue;
  emitLit(x,y,z,0,between(.24,.67),between(.62,1.14));
 }
 for(const sign of [-1,1]){
  for(let i=0;i<4000;i++){
   let angle=between(0,TAU),rad=Math.sqrt(rand());
   let x=sign*(.664+(.102+.022*Math.sin(angle*4))*Math.cos(angle)*rad),y=1.13+.28*rad*Math.sin(angle);
   let z=.16+.22*Math.sqrt(Math.max(0,1-rad*rad));
   emitLit(x,y,z,0,.77,between(.64,1.2));
  }
 }
 // Thin anatomically placed facial contour strands.
 function line(n,path,kind=4){for(let i=0;i<n;i++){
  let t=rand(),[x,y,z]=path(t);emitLit(x+between(-.003,.003),y+between(-.003,.003),z+between(-.002,.002),kind,between(.65,.98),between(.9,1.5));
 }}
 for(const sign of [-1,1]){
  line(1350,t=>{let x=sign*(.294+.147*(t*2-1));let k=Math.sqrt(Math.max(0,1-((Math.abs(x)-.294)/.147)**2));let y=1.32+.051*k;return[x,y,face(x,y)+.018];});
  line(800,t=>{let x=sign*(.294+.149*(t*2-1));let k=Math.sqrt(Math.max(0,1-((Math.abs(x)-.294)/.149)**2));let y=1.313-.043*k;return[x,y,face(x,y)+.012];},9);
  line(800,t=>{let x=sign*(.294+.175*(t*2-1)),y=1.481+.025*Math.cos(Math.PI*(t-.5));return[x,y,face(x,y)+.020];},9);
  line(900,t=>{let a=TAU*t,x=sign*.294+.043*Math.cos(a),y=1.318+.041*Math.sin(a);return[x,y,face(x,y)+.025];},2);
  // high brow, cheek highlight, and delicate strands beside the temple
  line(480,t=>{let x=sign*(.43+.12*t),y=1.15-.23*t;return[x,y,face(x,y)+.009];},9);
 }
 line(1450,t=>{let x=(t-.5)*.50,y=.710+.011*Math.cos(t*TAU);return[x,y,face(x,y)+.024];},6);
 line(1100,t=>{let x=(t-.5)*.47,y=.745+.026*Math.sin(Math.PI*t);return[x,y,face(x,y)+.02];},5);
 line(1100,t=>{let x=(t-.5)*.46,y=.683-.022*Math.sin(Math.PI*t);return[x,y,face(x,y)+.015];},5);
 for(let i=0;i<650;i++){let y=between(.96,1.35),x=between(-.014,.014);emitLit(x,y,face(x,y)+.016,4,between(.36,.75),between(.5,1.1));}
 // Jaw lower curve and temple strands, a more dimensional silhouette.
 for(let i=0;i<1800;i++){
  const sign=i%2?1:-1,t=rand(),y=.38+t*.74,x=sign*(widthAt(y)*(.93+.05*rand()));
  emitLit(x,y,face(x,y),9,between(.45,.9),between(.6,1.16));
 }
 // Anatomical neck and shoulders; subtle tech-like luminous seams.
 for(let i=0;i<16500;i++){
  const y=between(-.51,.365),a=between(0,TAU),w=.265+.024*Math.sin((y+.45)*3);
  const x=w*Math.cos(a),z=.06+.285*Math.sin(a);
  emitLit(x,y,z,8,between(.46,.94),between(.72,1.28));
 }
 for(let i=0;i<29000;i++){
  const y=between(-1.48,-.31),a=between(0,TAU),d=clamp((-y-.31)/1.17);
  const w=.43+1.05*smooth(d),x=w*Math.cos(a),z=.08+(.35+.14*d)*Math.sin(a);
  const edge=Math.sqrt(Math.max(.25,1-Math.pow((y+.78)*.37,2)));
  emitLit(x*edge,y,z,8,between(.35,.82),between(.6,1.35));
 }
 // Collarbone seams / spectral circuitry: all original math curves.
 for(const sign of [-1,1])for(let j=0;j<8;j++){
  const delta=j*.046;
  line(380,t=>{let x=sign*(.22+.87*t),y=-.52-.19*Math.sin(Math.PI*t)-delta;return[x,y,.445+.08*Math.sin(Math.PI*t)];},j<2?7:9);
 }
 for(let i=0;i<1400;i++){
  let a=between(0,TAU),y=between(-.34,.05);
  emitLit((.25+between(-.005,.005))*Math.cos(a),y,.08+.32*Math.sin(a),7,between(.24,.8),between(.5,1.0));
 }
 // Distant motes around portrait - slowly drift without becoming a generic star field.
 for(let i=0;i<1300;i++){
  let x=between(-2.35,2.35),y=between(-1.55,2.57),z=between(-.85,.9);
  if(Math.abs(x)<.83&&y>.25)continue;
  emitLit(x,y,z,rand()>.79?9:7,between(.12,.48),between(.6,1.2));
 }
 const data={position:new Float32Array(pos),color:new Float32Array(rgba),params:new Float32Array(meta),count};
 // Explicit uniforms, no dependencies. High-end WebGL rendering is faster than CPU repainting 170k particles.
 const vert=`
 precision highp float;
 attribute vec3 aPos;attribute vec4 aColor;attribute vec4 aMeta;
 uniform float uTime,uYaw,uPitch,uAspect,uDpr,uIntro,uMode,uBreath,uReduced;
 varying vec4 vColor;varying float vType;varying float vPulse;
 void main(){
   vec3 p=aPos;float feature=aMeta.z;float st=aMeta.y;
   float wobble=sin(uTime*(.82+aMeta.w*.37)+st)*.008*(1.0-uReduced);
   p.xyz +=vec3(wobble*.28,wobble*.2,wobble*.41);
   float torso=1.0-step(.30,p.y);p.x*=1.0+torso*uBreath*.006;
   p.y +=torso*uBreath*.006;
   float speaking=step(2.5,uMode);
   if(feature>4.5&&feature<6.6){
     float opening=speaking*(.012+.017*abs(sin(uTime*9.7)));
     if(feature>5.5)p.y-=opening*.16;
     else if(p.y<.705)p.y-=opening;
     else p.y+=opening*.48;
   }
   float thinking=step(1.5,uMode)*(1.0-step(2.5,uMode));
   // Particle disassembly/assembly transition is visible but quickly settles.
   p.xyz +=(1.0-uIntro)*vec3(sin(st*11.0)*.8,cos(st*12.0)*.62,sin(st*15.0)*.6);
   p.xyz += thinking*vec3(sin(st*11.0+uTime*.7),cos(st*3.0+uTime*.9),sin(st*6.0+uTime*.6))*.004*(1.0-uReduced);
   float cy=cos(uYaw),sy=sin(uYaw),cp=cos(uPitch),sp=sin(uPitch);
   p=vec3(p.x*cy-p.z*sy,p.y,p.x*sy+p.z*cy);
   p=vec3(p.x,p.y*cp-p.z*sp,p.y*sp+p.z*cp);
   float f=1.0/(1.0-p.z*.069);
   gl_Position=vec4(p.x*f*.65/uAspect,(p.y-.51)*f*.55,clamp(.42-p.z*.06,.02,.98),1.0);
   gl_PointSize=clamp(aMeta.x*uDpr*(1.35+p.z*.29)*1.19,.75*uDpr,3.7*uDpr);
   vec3 c=aColor.rgb;
   if(feature<.5){
     c=mix(c,vec3(.27,.89,1.0),.045+.07*sin(st+uTime*.25));
     c+=vec3(.05,.005,.07)*thinking;
   }
   float modeGlow=1.0+speaking*.18*(.6+.4*sin(uTime*13.0+st));
   float energy=feature>1.5&&feature<2.5?1.45:1.0;
   energy*=feature>6.5&&feature<7.5?1.12:1.0;
   vColor=vec4(clamp(c*energy*modeGlow,0.0,1.0),clamp(aColor.a*(.87+.13*sin(st*.4+uTime*.74))*uIntro,0.0,1.0));
   vType=feature;vPulse=modeGlow;
 }`;
 const frag=`precision mediump float;varying vec4 vColor;varying float vType;varying float vPulse;
 void main(){
  vec2 p=gl_PointCoord-.5;float r=length(p);
  float alpha=1.0-smoothstep(.28,.51,r);
  if(alpha<.01)discard;
  float flare=(1.0-smoothstep(.04,.46,r))*.27;
  vec3 rgb=vColor.rgb*(.73+flare);
  gl_FragColor=vec4(rgb,clamp(vColor.a*alpha,0.0,1.0));
 }`;
 let gl,canvas,visible=true,mode='idle',change=()=>{},start=performance.now(),last=0,raf,reduce=false;
 let yaw=0,pitch=0,targetYaw=0,targetPitch=0,modeChanged=0,pointerActive=false;
 const modeSet=['idle','listening','thinking','speaking'];
 function shader(type,src){let s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('Nexora shader: '+gl.getShaderInfoLog(s));return s;}
 function build(){
  const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vert));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,frag));gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));gl.useProgram(p);
  for(const [n,array,sz] of [['aPos',data.position,3],['aColor',data.color,4],['aMeta',data.params,4]]){
   const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,array,gl.STATIC_DRAW);
   const loc=gl.getAttribLocation(p,n);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,sz,gl.FLOAT,false,0,0);
  }
  const uniforms={};for(const n of ['uTime','uYaw','uPitch','uAspect','uDpr','uIntro','uMode','uBreath','uReduced'])uniforms[n]=gl.getUniformLocation(p,n);
  gl.clearColor(0,0,0,0);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  gl.disable(gl.CULL_FACE);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
  return uniforms;
 }
 function setMode(next){if(!modeSet.includes(next))return;mode=next;modeChanged=performance.now();change(mode);}

 function init2D(){
  const ctx=canvas.getContext('2d',{alpha:true});
  if(!ctx)return null;
  let last=0,prevW=0,prevH=0,frameId=0;
  // Back-to-front projection for fallback; CPU canvas displays the same original geometry.
  const indices=[];
  for(let i=0;i<data.count;i+=3)indices.push(i);
  indices.sort((a,b)=>data.position[a*3+2]-data.position[b*3+2]);
  const palette=indices.map(i=>{
   let idx=i*4;let c=data.color;
   const lum=.85,alpha=clamp(c[idx+3]*(.55+.32*clamp(data.position[i*3+2]+.2)),.09,.92);
   return `rgba(${Math.round(clamp(c[idx]*lum)*255)},${Math.round(clamp(c[idx+1]*lum)*255)},${Math.round(clamp(c[idx+2]*lum)*255)},${Math.round(alpha*100)/100})`;
  });
  canvas.addEventListener('pointermove',e=>{let r=canvas.getBoundingClientRect();targetYaw=clamp((e.clientX-r.left)/r.width*2-1,-1,1)*.26;targetPitch=-clamp((e.clientY-r.top)/r.height*2-1,-1,1)*.07;});
  canvas.addEventListener('pointerleave',()=>{targetYaw=0;targetPitch=0;});
  function paint(now){
   frameId=requestAnimationFrame(paint);if(!visible||document.hidden)return;
   if(now-last<(reduce?180:75))return;last=now;
   let r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.45),w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);
   if(w!==prevW||h!==prevH){canvas.width=w;canvas.height=h;prevW=w;prevH=h;ctx.setTransform(dpr,0,0,dpr,0,0);}
   let W=r.width,H=r.height,cx=W*.5,cy=H*.55,s=Math.min(W/2.7,H/3.98);
   yaw+=(targetYaw-yaw)*.06;pitch+=(targetPitch-pitch)*.06;
   let a=yaw+(reduce?0:.018*Math.sin(now*.00045)),b=pitch;
   let co=Math.cos(a),si=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);
   const intro=reduce?1:smooth((now-start)/1500);
   ctx.clearRect(0,0,W,H);
   let bg=ctx.createRadialGradient(cx,cy,0,cx,cy,H*.55);
   bg.addColorStop(0,'rgba(23,114,145,.12)');bg.addColorStop(1,'rgba(6,25,39,0)');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
   for(let j=0;j<indices.length;j++){
    const i=indices[j],p=i*3,q=i*4;
    let x=data.position[p],y=data.position[p+1],z=data.position[p+2];
    if(!reduce){let wave=Math.sin(now*.0012+data.params[q+1])*.003;x+=wave*.2;y+=wave*.4;}
    if(intro<.999){let k=1-intro,phase=data.params[q+1];x+=Math.sin(phase*11)*k*.65;y+=Math.cos(phase*8)*k*.55;}
    if(mode==='speaking'&&data.params[q+2]===5&&y<.71)y-=.015*Math.abs(Math.sin(now*.010));
    let xx=x*co-z*si,zz=x*si+z*co,yy=y*cb-zz*sb;
    let f=1/(1-zz*.075),sx=cx+xx*s*f,sy=cy-(yy-.51)*s*f;
    if(sx<-5||sx>W+5||sy<-5||sy>H+5)continue;
    const pw=Math.max(.65,data.params[q]*(.78+zz*.13));
    ctx.fillStyle=palette[j];ctx.fillRect(sx,sy,pw,pw);
   }
  }
  change(mode);frameId=requestAnimationFrame(paint);
  return {setMode,setVisible(v){visible=!!v},getMode:()=>mode,destroy(){visible=false;cancelAnimationFrame(frameId)}};
 }
 function init(el,onChange){
  canvas=el;change=typeof onChange==='function'?onChange:()=>{};
  reduce=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  gl=canvas.getContext('webgl2',{alpha:true,antialias:false,preserveDrawingBuffer:false,powerPreference:'high-performance'})||canvas.getContext('webgl',{alpha:true,antialias:false,preserveDrawingBuffer:false,powerPreference:'high-performance'});
  if(!gl){console.warn('Nexora GPU renderer unavailable; using 2D particle fallback.');return init2D();}
  let uniforms;try{uniforms=build();}catch(e){console.error('Nexora humanoid shader failed; using Canvas fallback',e);return init2D();}
  canvas.addEventListener('pointermove',e=>{
   let r=canvas.getBoundingClientRect();targetYaw=clamp((e.clientX-r.left)/r.width*2-1,-1,1)*.29;
   targetPitch=-clamp((e.clientY-r.top)/r.height*2-1,-1,1)*.085;pointerActive=true;
  });
  canvas.addEventListener('pointerleave',()=>{targetYaw=0;targetPitch=0;pointerActive=false;});
  window.addEventListener('resize',size,{passive:true});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();visible=false;cancelAnimationFrame(raf);});
  canvas.addEventListener('webglcontextrestored',()=>{uniforms=build();visible=true;raf=requestAnimationFrame(draw);});
  function size(){if(!canvas)return;
   let r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;
   let dpr=Math.min(devicePixelRatio||1,1.5);
   let w=Math.floor(r.width*dpr),h=Math.floor(r.height*dpr);
   if(w!==canvas.width||h!==canvas.height){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
  }
  function draw(now){raf=requestAnimationFrame(draw);if(!visible||document.hidden)return;
   if(now-last<(reduce?130:33))return;last=now;size();
   const time=now*.001,breathing=reduce?0:Math.sin(time*1.7);
   yaw+=(targetYaw-yaw)*.055;pitch+=(targetPitch-pitch)*.055;
   const yawNow=yaw+(reduce?0:.028*Math.sin(time*.34));
   const pitchNow=pitch+(reduce?0:.010*Math.sin(time*.5));
   let dpr=Math.min(devicePixelRatio||1,1.5);
   let intro=reduce?1:smooth((now-start)/1500);
   gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
   gl.uniform1f(uniforms.uTime,time);
   gl.uniform1f(uniforms.uYaw,yawNow);gl.uniform1f(uniforms.uPitch,pitchNow);
   gl.uniform1f(uniforms.uAspect,canvas.width/Math.max(1,canvas.height));
   gl.uniform1f(uniforms.uDpr,dpr);
   gl.uniform1f(uniforms.uIntro,intro);
   gl.uniform1f(uniforms.uMode,modeSet.indexOf(mode));
   gl.uniform1f(uniforms.uBreath,breathing);gl.uniform1f(uniforms.uReduced,reduce?1:0);
   gl.drawArrays(gl.POINTS,0,data.count);
  }
  change(mode);size();raf=requestAnimationFrame(draw);
  return {setMode,setVisible(v){visible=!!v;if(v)size();},getMode:()=>mode,destroy(){visible=false;cancelAnimationFrame(raf);}};
 }
 window.NexoraHumanoid={init,version:'3.0',particleCount:data.count};
})();
