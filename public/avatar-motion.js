/* Nexora V5 portrait animation: procedural 2D facial approximation over original art.
   Works without WebGL, external dependencies or AI. It is NOT phoneme-accurate lip sync.
   When the canvas is unsupported, the original portrait image remains visible. */
(() => {
  'use strict';
  function init(canvas, image, shell) {
    if(!canvas||!image||!shell)return null;
    const ctx=canvas.getContext('2d',{alpha:true});
    if(!ctx)return null;
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const W=760,H=1140;
    canvas.width=W;canvas.height=H;
    let ready=false, speaking=false, beat=0, nextBlink=performance.now()+1800;
    let blinkAt=-1, offset=0, raf=0, last=0;
    function makeReady(){
      if(!image.naturalWidth)return;
      ready=true;
      canvas.parentElement.dataset.motionReady='true';
    }
    if(image.complete&&image.naturalWidth)makeReady(); else image.addEventListener('load',makeReady,{once:true});
    function frame(t){
      raf=requestAnimationFrame(frame);
      if(!ready||document.hidden||shell.dataset.visual!=='portrait'||t-last<40)return;
      last=t;
      const mode=shell.dataset.mode||'idle';
      const talking=speaking||mode==='speaking';
      const phase=t*.009;
      const breath=reduce?0:Math.sin(t*.00125)*2;
      ctx.clearRect(0,0,W,H);
      // Very small image-space motion supplements the CSS perspective and parallax.
      ctx.drawImage(image,0,breath,W,H);
      // Organic blink. Eyelid overlay samples texture just above each eye, rather
      // than drawing a new synthetic skin color over the portrait.
      if(t>nextBlink){blinkAt=t;nextBlink=t+3100+Math.random()*2500;}
      const timeSince=t-blinkAt;
      const blink=!reduce&&timeSince>=0&&timeSince<220?Math.pow(Math.sin(Math.PI*timeSince/220),2):0;
      if(blink>.05){
        for(const [cx,cy,half] of [[292,362,55],[481,363,56]]){
          ctx.save();
          ctx.beginPath();ctx.ellipse(cx,cy,half,19*blink,0,0,Math.PI*2);ctx.clip();
          ctx.globalAlpha=.93*blink;
          ctx.drawImage(image,cx-half,cy-40,half*2,17,cx-half,cy-19*blink,half*2,38*blink);
          ctx.restore();
        }
      }
      // A subtle, repeatable jaw opening; driven by the local speech lifecycle.
      // The original artwork stays recognizable, but this is not a rigged 3D face.
      if(talking){
        const vowel=Math.abs(Math.sin(phase*1.23)+.35*Math.sin(phase*2.13));
        const aperture=reduce?3:3.4+Math.min(1,vowel)*7.4+beat*3;
        const cx=398,cy=550,rad=49;
        ctx.save();
        const mouth=ctx.createRadialGradient(cx,cy+3,2,cx,cy+2,rad);
        mouth.addColorStop(0,'rgba(0,7,19,.99)');
        mouth.addColorStop(.65,'rgba(3,17,29,.91)');
        mouth.addColorStop(1,'rgba(8,25,38,.20)');
        ctx.fillStyle=mouth;
        ctx.beginPath();
        ctx.moveTo(cx-rad,cy+1);
        ctx.bezierCurveTo(cx-rad*.53,cy-aperture*.55,cx+rad*.53,cy-aperture*.55,cx+rad,cy+1);
        ctx.bezierCurveTo(cx+rad*.45,cy+aperture,cx-rad*.45,cy+aperture,cx-rad,cy+1);
        ctx.fill();
        // Move a feathered crop of the existing lower lip, minimizing a pasted-on look.
        ctx.beginPath();ctx.ellipse(cx,cy+16+aperture*.20,67,22,0,0,Math.PI*2);ctx.clip();
        ctx.globalAlpha=.58;
        ctx.drawImage(image,326,553,143,39,326,553+aperture*.47,143,39);
        ctx.restore();
        // Small warm/cyan light response on the cheeks while talking.
        ctx.save();ctx.globalCompositeOperation='screen';
        const lum=ctx.createRadialGradient(cx,cy+4,10,cx,cy+4,150);
        lum.addColorStop(0,'rgba(99,229,245,.035)');lum.addColorStop(1,'rgba(99,229,245,0)');
        ctx.fillStyle=lum;ctx.beginPath();ctx.ellipse(cx,cy,145,80,0,0,Math.PI*2);ctx.fill();ctx.restore();
        beat=Math.max(0,beat-.025);
      }
    }
    raf=requestAnimationFrame(frame);
    return {
      setSpeaking(v){speaking=!!v;if(!v)beat=0;},
      speechBeat(){beat=1;},
      destroy(){cancelAnimationFrame(raf);canvas.parentElement.dataset.motionReady='false';}
    };
  }
  globalThis.NexoraAvatarMotion={init};
})();
