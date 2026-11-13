/* Buza Media Video Studio (CapCut-style): preview, timeline, layers with start/end, keyframes, picture-in-picture, solid-background removal,
   exact MP4 export in the browser, download and post to Facebook / Instagram. Admin only. */
(function(){
  'use strict';
  var ov=null,$=function(id){return document.getElementById(id);};
  function toast(m,t){if(typeof showToast==='function')showToast(m,t||'success');}
    var u8=function(a){return new Uint8Array(a);};
  function cat(list){var n=0,i;for(i=0;i<list.length;i++)n+=list[i].length;var o=new Uint8Array(n),p=0;for(i=0;i<list.length;i++){o.set(list[i],p);p+=list[i].length;}return o;}
  function be(n,b){var o=new Uint8Array(b);for(var i=b-1;i>=0;i--){o[i]=n&255;n=Math.floor(n/256);}return o;}
  function str(s){var o=new Uint8Array(s.length);for(var i=0;i<s.length;i++)o[i]=s.charCodeAt(i);return o;}
  function bx(type){var parts=[].slice.call(arguments,1),b=cat(parts);return cat([be(b.length+8,4),str(type),b]);}
  function fb(type,ver,flags){return bx.apply(null,[type,be(ver*16777216+flags,4)].concat([].slice.call(arguments,3)));}
  var MAT=cat([be(0x10000,4),be(0,4),be(0,4),be(0,4),be(0x10000,4),be(0,4),be(0,4),be(0,4),be(0x40000000,4)]);
  function trak(o,id,mdur){
    var v=o.kind==='v',n=o.samples.length,i;
    var sizes=[],data=[];for(i=0;i<n;i++){sizes.push(be(o.samples[i].data.length,4));}
    var stts=[],run=null;
    for(i=0;i<n;i++){var d=o.samples[i].d;if(run&&run.d===d)run.c++;else{run={c:1,d:d};stts.push(run);}}
    var sttsB=fb.apply(null,['stts',0,0,be(stts.length,4)].concat(stts.map(function(r){return cat([be(r.c,4),be(r.d,4)]);})));
    var entry;
    if(v){
      entry=bx('avc1',u8(6),be(1,2),u8(16),be(o.w,2),be(o.h,2),be(0x480000,4),be(0x480000,4),be(0,4),be(1,2),u8(32),be(0x18,2),be(0xFFFF,2),bx('avcC',o.desc));
    }else if(o.codec==='aac'){
      var asc=o.desc,dec=cat([u8([0x40,0x15,0,0,0]),be(0,4),be(0,4),u8([5,asc.length]),asc]),
          es=cat([u8([3,3+2+dec.length+5+3,0,0,0]),u8([4,dec.length]),dec,u8([6,1,2])]);
      es=cat([u8([3,es.length-2+0]),es.subarray(2)]);
      entry=bx('mp4a',u8(6),be(1,2),u8(8),be(o.ch,2),be(16,2),be(0,2),be(0,2),be(o.sr*65536,4),fb('esds',0,0,es));
    }else{
      entry=bx('Opus',u8(6),be(1,2),u8(8),be(o.ch,2),be(16,2),be(0,2),be(0,2),be(48000*65536,4),bx('dOps',u8([0,o.ch]),be(o.pre||312,2),be(o.sr,4),be(0,2),u8([0])));
    }
    var stsd=fb('stsd',0,0,be(1,4),entry);
    var kf=[];if(v)for(i=0;i<n;i++)if(o.samples[i].key)kf.push(be(i+1,4));
    var stbl=[stsd,sttsB];
    if(v)stbl.push(fb.apply(null,['stss',0,0,be(kf.length,4)].concat(kf)));
    stbl.push(fb('stsc',0,0,be(1,4),be(1,4),be(n,4),be(1,4)));
    stbl.push(fb.apply(null,['stsz',0,0,be(0,4),be(n,4)].concat(sizes)));
    stbl.push(fb('stco',0,0,be(1,4),be(o.offset||0,4)));
    var minf=bx('minf',v?fb('vmhd',0,1,be(0,2),u8(6)):fb('smhd',0,0,be(0,2),be(0,2)),
      bx('dinf',fb('dref',0,0,be(1,4),fb('url ',0,1))),bx.apply(null,['stbl'].concat(stbl)));
    var mdhd=fb('mdhd',0,0,be(0,4),be(0,4),be(o.ts,4),be(Math.round(o.dur*o.ts),4),be(0x55C4,2),be(0,2));
    var hdlr=fb('hdlr',0,0,be(0,4),str(v?'vide':'soun'),u8(12),str(v?'VideoHandler':'SoundHandler'),u8(1));
    var tkhd=fb('tkhd',0,3,be(0,4),be(0,4),be(id,4),be(0,4),be(Math.round(mdur*1000),4),u8(8),be(0,2),be(0,2),be(v?0:0x100,2),be(0,2),MAT,be(v?o.w*65536:0,4),be(v?o.h*65536:0,4));
    return bx('trak',tkhd,bx('mdia',mdhd,hdlr,minf));
  }
  function mux(vid,aud){
    var dur=vid.dur;
    var ftyp=bx('ftyp',str('isom'),be(512,4),str('isom'),str('iso2'),str('avc1'),str('mp41'));
    function moov(){
      var tr=[trak(vid,1,dur)];if(aud)tr.push(trak(aud,2,dur));
      var mvhd=fb('mvhd',0,0,be(0,4),be(0,4),be(1000,4),be(Math.round(dur*1000),4),be(0x10000,4),be(0x100,2),u8(10),MAT,u8(24),be(aud?3:2,4));
      return bx.apply(null,['moov',mvhd].concat(tr));
    }
    vid.offset=0;if(aud)aud.offset=0;
    var size=moov().length,base=ftyp.length+size+8;
    vid.offset=base;var vb=0;vid.samples.forEach(function(s){vb+=s.data.length;});
    if(aud)aud.offset=base+vb;
    var parts=[ftyp,moov()],body=[];
    vid.samples.forEach(function(s){body.push(s.data);});if(aud)aud.samples.forEach(function(s){body.push(s.data);});
    var bl=0;body.forEach(function(b){bl+=b.length;});
    parts.push(be(bl+8,4),str('mdat'));
    return new Blob(parts.concat(body),{type:'video/mp4'});
  }
  function seekTo(v,t){
    return new Promise(function(res){
      var done=false,f=function(){if(done)return;done=true;v.removeEventListener('seeked',f);clearTimeout(to);res();};
      var to=setTimeout(f,6000);v.addEventListener('seeked',f);v.currentTime=t;
    });
  }

  var FMT={banner:[1080,1528],'9:16':[1080,1920],'1:1':[1080,1080],'16:9':[1920,1080]},FMTS=['banner','9:16','1:1','16:9'],FLAB={banner:'Banner','9:16':'9:16','1:1':'1:1','16:9':'16:9'};
  var st={fmt:'banner',fit:'fill',snd:true,pps:60,head:'',headSize:100};
  /* the Buza Media banner: frame laid over the video, headline in the blue box (template units 1810 x 2560) */
  var FR={W:1810,H:2560,area:{x:9,y:8,w:1793,h:1846},box:{x:181,y:1949,w:1455,h:339},img:null};
  var HFONT='Poppins,Inter,"Arial Black",Arial,sans-serif',HLH=1.12;
  var B={file:null,url:null,el:null,w:0,h:0,dur:0,start:0,end:0};
  var L=[],sel=null,idc=0,T=0,playing=false,raf=0,busy=false,cancel=false,result=null,drag=null,panel=false,lastSet=-9,LOGO={wh:null,col:null};
  var cv,ctx,small=document.createElement('canvas'),thumb=null,hsheet=false,ptrs={},gest=null;
  var SYM={'ti-video':'🎞','ti-star':'★','ti-typography':'T','ti-photo':'🖼','ti-picture-in-picture':'⧉','ti-aspect-ratio':'⤢','ti-volume':'🔊','ti-volume-off':'🔇','ti-chevron-left':'‹','ti-adjustments':'⚙','ti-diamond':'◇','ti-diamond-filled':'◆','ti-wand':'✦','ti-palette':'🎨','ti-arrow-bar-up':'⬆','ti-arrow-bar-down':'⬇','ti-trash':'🗑','ti-layout':'▭','ti-heading':'H','ti-frame':'▭'};
  function sym(n){return SYM[n]||'•';}
  function fmt(t){t=Math.max(0,t);var m=Math.floor(t/60),s=t-m*60;return (m<10?'0':'')+m+':'+(s<10?'0':'')+s.toFixed(1);}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}

  /* ---------- screen ---------- */
  var CSS='#vs-ov{position:fixed;inset:0;z-index:100000;background:#0e1014;color:#e8eaee;display:flex;flex-direction:column;font:14px/1.3 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;-webkit-user-select:none;user-select:none}'+
  '#vs-ov *{box-sizing:border-box}#vs-ov button{font:inherit;color:inherit;cursor:pointer}'+
  '#vs-ov .top{display:flex;align-items:center;gap:.5rem;padding:.55rem .7rem;flex:0 0 auto}'+
  '#vs-ov .ib{background:none;border:0;color:#e8eaee;font-size:1.4rem;padding:.2rem .4rem}'+
  '#vs-ov .pill{background:#22252c;border:0;border-radius:8px;padding:.4rem .7rem;font-weight:600}'+
  '#vs-ov .exp{background:#16d8e6;color:#001417;border:0;border-radius:8px;padding:.45rem 1rem;font-weight:800}'+
  '#vs-ov .stage{flex:1 1 auto;min-height:0;display:flex;align-items:center;justify-content:center;padding:.2rem .7rem;position:relative}'+
  '#vs-ov canvas#vs-cv{max-width:100%;max-height:100%;border-radius:6px;background:#000;touch-action:none;box-shadow:0 0 0 1px #2a2e36}'+
  '#vs-ov .empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.7rem;pointer-events:none}'+
  '#vs-ov .empty button i{font-style:normal}#vs-ov .empty button{pointer-events:auto;background:#16d8e6;color:#001417;border:0;border-radius:999px;padding:.8rem 1.6rem;font-weight:800;font-size:1rem}'+
  '#vs-ov .tp{display:flex;align-items:center;justify-content:space-between;padding:.25rem .8rem;flex:0 0 auto;color:#9aa1ad;font-size:.8rem}'+
  '#vs-ov .tp .mid{display:flex;align-items:center;gap:.8rem}#vs-ov .tp .play{font-size:1.7rem;color:#fff}'+
  '#vs-ov .tlw{position:relative;flex:0 0 auto;background:#14171c;border-top:1px solid #23272f}'+
  '#vs-ov .tls{overflow:auto;max-height:34vh;touch-action:pan-x pan-y;scrollbar-width:none;overscroll-behavior:contain}#vs-ov .tls::-webkit-scrollbar{display:none}'+
  '#vs-ov .tli{position:relative;min-height:100px}'+
  '#vs-ov .ph{position:absolute;left:50%;top:0;bottom:0;width:2px;background:#fff;pointer-events:none;z-index:5;transform:translateX(-1px)}'+
  '#vs-ov .rul{position:relative;height:22px;color:#7d8491;font-size:.65rem}#vs-ov .rul i{position:absolute;top:0;width:1px;height:8px;background:#4a505b}#vs-ov .rul b{position:absolute;top:9px;font-weight:500;transform:translateX(-50%)}'+
  '#vs-ov .clip{position:relative;height:52px;border-radius:6px;overflow:hidden;background:#2a2e36}#vs-ov .clip canvas{position:absolute;inset:0;width:100%;height:100%}'+
  '#vs-ov .dim{position:absolute;top:0;bottom:0;background:rgba(0,0,0,.62);pointer-events:none}'+
  '#vs-ov .hd{position:absolute;top:0;bottom:0;width:18px;background:#fff;border-radius:6px;touch-action:none;display:flex;align-items:center;justify-content:center;color:#111;font-size:.7rem;z-index:3}'+
  '#vs-ov .row{position:relative;height:30px;margin-top:4px}'+
  '#vs-ov .bar{position:absolute;top:0;height:30px;border-radius:6px;padding:0 20px;display:flex;align-items:center;font-size:.72rem;font-weight:700;color:#fff;overflow:hidden;white-space:nowrap;touch-action:none;border:2px solid transparent}'+
  '#vs-ov .bar.sel{border-color:#fff}#vs-ov .bar .e{position:absolute;top:0;bottom:0;width:16px;background:rgba(255,255,255,.55);touch-action:none}#vs-ov .bar .e.l{left:0;border-radius:5px 0 0 5px}#vs-ov .bar .e.r{right:0;border-radius:0 5px 5px 0}'+
  '#vs-ov .kf{position:absolute;top:9px;width:11px;height:11px;background:#ffd23f;transform:translateX(-50%) rotate(45deg);border:1px solid #6b5400;z-index:4;pointer-events:none}'+
  '#vs-ov .sheet{background:#191c22;border-top:1px solid #272b33;padding:.5rem .8rem;max-height:34vh;overflow:auto;flex:0 0 auto}'+
  '#vs-ov .sl{display:flex;align-items:center;gap:.6rem;margin:.3rem 0;font-size:.8rem}#vs-ov .sl span{width:74px;color:#9aa1ad}#vs-ov .sl input{flex:1}'+
  '#vs-ov .sheet textarea{width:100%;background:#0e1014;color:#fff;border:1px solid #333944;border-radius:8px;padding:.5rem;font:inherit}'+
  '#vs-ov .sheet label{color:#c5cad3;font-size:.8rem;display:flex;align-items:center;gap:.4rem}'+
  '#vs-ov .tb{display:flex;gap:.1rem;overflow-x:auto;padding:.3rem .4rem calc(.4rem + env(safe-area-inset-bottom));background:#0e1014;border-top:1px solid #23272f;flex:0 0 auto;scrollbar-width:none}#vs-ov .tb::-webkit-scrollbar{display:none}'+
  '#vs-ov .tb button{background:none;border:0;min-width:66px;padding:.35rem .3rem;display:flex;flex-direction:column;align-items:center;gap:.15rem;font-size:.68rem;color:#c5cad3;flex:0 0 auto}#vs-ov .tb button i{font-style:normal;font-size:1.3rem;line-height:1.5rem;color:#fff}#vs-ov .tb button:disabled{opacity:.35}'+
  '#vs-ov .tb button.on i{color:#16d8e6}'+
  '#vs-ov .scr{position:absolute;inset:0;background:#0e1014;z-index:10;overflow:auto;padding:1rem}'+
  '#vs-ov .scr .card{max-width:420px;margin:0 auto}#vs-ov .scr video{width:100%;max-height:52vh;border-radius:10px;background:#000;display:block;margin:.6rem 0}'+
  '#vs-ov .scr input[type=text],#vs-ov .scr textarea{width:100%;background:#191c22;color:#fff;border:1px solid #333944;border-radius:8px;padding:.55rem;font:inherit;margin:.2rem 0 .5rem}'+
  '#vs-ov .scr .btn2{display:inline-flex;gap:.4rem;align-items:center;justify-content:center;border:0;border-radius:10px;padding:.7rem 1rem;font-weight:700;margin:.2rem .2rem .2rem 0;background:#272b33}#vs-ov .scr .btn2.p{background:#16d8e6;color:#001417}';
  function build(){
    if(ov)return;
    var s=document.createElement('style');s.textContent=CSS;document.head.appendChild(s);
    ov=document.createElement('div');ov.id='vs-ov';ov.style.display='none';
    ov.innerHTML=
     '<div class="top"><button class="ib" id="vs-x" aria-label="Close">✕</button><div style="flex:1"></div><button class="pill" id="vs-fmt">Banner</button><button class="exp" id="vs-exp">Export</button></div>'+
     '<div class="stage" id="vs-stage"><canvas id="vs-cv"></canvas><div class="empty" id="vs-empty"><div style="color:#9aa1ad">Start with your video</div><button id="vs-first">＋ Add video</button></div></div>'+
     '<div class="tp"><span id="vs-time">00:00.0 / 00:00.0</span><div class="mid"><button class="ib play" id="vs-play" aria-label="Play">▶</button></div><span><button class="ib" id="vs-zo" aria-label="Zoom timeline out" style="font-size:1.3rem">−</button><button class="ib" id="vs-zi" aria-label="Zoom timeline in" style="font-size:1.3rem">+</button></span></div>'+
     '<div class="tlw"><div class="tls" id="vs-tls"><div class="tli" id="vs-tli"></div></div><div class="ph"></div></div>'+
     '<div class="sheet" id="vs-sheet" style="display:none"></div>'+
     '<div class="tb" id="vs-tb"></div>'+
     '<input type="file" id="vs-fv" accept="video/*" hidden><input type="file" id="vs-fi" accept="image/*" hidden><input type="file" id="vs-fp" accept="video/*" hidden>';
    document.body.appendChild(ov);
    cv=$('vs-cv');ctx=cv.getContext('2d');sizeCv();wire();toolbar();renderTL();draw();
    [['logo-white.png','wh'],['logo-brand.png','col']].forEach(function(a){var im=new Image();im.onload=function(){LOGO[a[1]]=im;draw();};im.src=a[0];});
    var fi=new Image();fi.onload=function(){FR.img=fi;draw();};fi.src='frame-buza.png';
    try{if(document.fonts&&document.fonts.load)document.fonts.load('800 40px Poppins').then(draw,draw);}catch(e){}
  }
  function open(){build();ov.style.display='flex';document.body.style.overflow='hidden';setTimeout(function(){sizeCv();renderTL();draw();},50);}
  function close(){if(busy&&!confirm('A video is being created. Stop and close?'))return;cancel=true;setPlaying(false);ov.style.display='none';document.body.style.overflow='';}
  function sizeCv(){var d=FMT[st.fmt];cv.width=Math.round(d[0]/2);cv.height=Math.round(d[1]/2);var asp=d[0]/d[1];cv.style.aspectRatio=d[0]+'/'+d[1];
    var stg=$('vs-stage');if(!stg)return;var mw=stg.clientWidth-14,mh=stg.clientHeight-6;var w=Math.min(mw,mh*asp),h=w/asp;cv.style.width=Math.max(60,w)+'px';cv.style.height=Math.max(60,h)+'px';}
  window.addEventListener('resize',function(){if(ov&&ov.style.display!=='none'){sizeCv();renderTL();draw();}});

  /* ---------- keyframes: values of a layer at a time ---------- */
  var KEYS=['x','y','w','r','o'];
  function ease(u){return u<.5?2*u*u:1-Math.pow(-2*u+2,2)/2;}
  function evalL(l,t){
    var k=l.kf,o={x:l.x,y:l.y,w:l.w,r:l.r,o:l.o};if(!k||!k.length)return o;
    var a=k[0],b=k[k.length-1],i,r={};
    if(t<=a.t)b=a;else if(t>=b.t)a=b;else{for(i=0;i<k.length-1;i++)if(t>=k[i].t&&t<=k[i+1].t){a=k[i];b=k[i+1];break;}}
    var u=a===b?0:ease((t-a.t)/(b.t-a.t));KEYS.forEach(function(p){r[p]=a[p]+(b[p]-a[p])*u;});return r;
  }
  function kfAt(l,t){for(var i=0;i<(l.kf||[]).length;i++)if(Math.abs(l.kf[i].t-t)<0.05)return l.kf[i];return null;}
  function addKf(l,t){var v=evalL(l,t),k={t:t,x:v.x,y:v.y,w:v.w,r:v.r,o:v.o};l.kf.push(k);l.kf.sort(function(a,b){return a.t-b.t;});return k;}
  function setProp(l,key,val){if(l.kf.length){var k=kfAt(l,T)||addKf(l,T);k[key]=val;}else l[key]=val;}
  function toggleKf(){
    var l=sel&&get(sel);if(!l)return;var k=kfAt(l,T);
    if(k){l.kf.splice(l.kf.indexOf(k),1);if(!l.kf.length){l.x=k.x;l.y=k.y;l.w=k.w;l.r=k.r;l.o=k.o;}toast('Keyframe removed.');}
    else{addKf(l,T);toast('Keyframe added. Now move the playhead, change the size or position, and it will animate.');}
    renderTL();toolbar();draw();
  }

  /* ---------- drawing ---------- */
  function rrect(c,x,y,w,h,r){r=Math.max(0,Math.min(r,w/2,h/2));c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
  function cover(c,src,sw,sh,W,H){var s=Math.max(W/sw,H/sh),dw=sw*s,dh=sh*s;c.drawImage(src,(W-dw)/2,(H-dh)/2,dw,dh);}
  function drawBase(c,W,H,vid,R){
    R=R||{x:0,y:0,w:W,h:H};
    c.save();c.beginPath();c.rect(R.x,R.y,R.w,R.h);c.clip();
    c.fillStyle='#000';c.fillRect(R.x,R.y,R.w,R.h);
    var v=vid||B.el;if(!v||v.readyState<2||!B.w){c.fillStyle='#161a21';c.fillRect(R.x,R.y,R.w,R.h);c.restore();return;}
    try{
      if(st.fit==='fill'){var s0=Math.max(R.w/B.w,R.h/B.h),dw0=B.w*s0,dh0=B.h*s0;c.drawImage(v,R.x+(R.w-dw0)/2,R.y+(R.h-dh0)/2,dw0,dh0);}
      else{
        small.width=36;small.height=Math.max(2,Math.round(36*R.h/R.w));small.getContext('2d').drawImage(v,0,0,B.w,B.h,0,0,small.width,small.height);
        c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';var s1=Math.max(R.w/small.width,R.h/small.height);
        c.drawImage(small,R.x+(R.w-small.width*s1)/2,R.y+(R.h-small.height*s1)/2,small.width*s1,small.height*s1);c.fillStyle='rgba(0,0,0,.25)';c.fillRect(R.x,R.y,R.w,R.h);c.restore();
        var s2=Math.min(R.w/B.w,R.h/B.h),dw=B.w*s2,dh=B.h*s2;c.drawImage(v,R.x+(R.w-dw)/2,R.y+(R.h-dh)/2,dw,dh);
      }
    }catch(e){}
    c.restore();
  }
  function hex(h){var n=parseInt(h.slice(1),16);return [(n>>16)&255,(n>>8)&255,n&255];}
  function keyed(l,src,sw,sh){
    var k=Math.min(1,480/Math.max(sw,sh)),w=Math.max(2,Math.round(sw*k)),h=Math.max(2,Math.round(sh*k));
    if(!l._kc)l._kc=document.createElement('canvas');var c=l._kc;if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
    var x=c.getContext('2d',{willReadFrequently:true});x.clearRect(0,0,w,h);
    try{x.drawImage(src,0,0,w,h);var d=x.getImageData(0,0,w,h),p=d.data,kc=hex(l.kc),thr=l.kt*4.4,soft=thr*0.35+1;
      for(var i=0;i<p.length;i+=4){var dr=p[i]-kc[0],dg=p[i+1]-kc[1],db=p[i+2]-kc[2],dist=Math.sqrt(dr*dr+dg*dg+db*db);
        if(dist<thr)p[i+3]=0;else if(dist<thr+soft)p[i+3]=Math.round(p[i+3]*(dist-thr)/soft);}
      x.putImageData(d,0,0);}catch(e){}
    return c;
  }
  function textCanvas(l){
    var key=[l.t,l.c,l.bc,l.bg].join('|');if(l._tk===key&&l._tc)return l._tc;
    var lines=String(l.t||' ').toUpperCase().split(/\r?\n/),f='800 100px Poppins,Inter,Arial,sans-serif',m=document.createElement('canvas').getContext('2d');m.font=f;
    var mw=0;lines.forEach(function(s){mw=Math.max(mw,m.measureText(s).width);});
    var pad=34,c=document.createElement('canvas');c.width=Math.ceil(mw+pad*2);c.height=Math.ceil(lines.length*118+pad*2-8);
    var x=c.getContext('2d');if(l.bg){x.fillStyle=l.bc;rrect(x,0,0,c.width,c.height,28);x.fill();}
    x.font=f;x.textAlign='center';x.textBaseline='middle';x.fillStyle=l.c;if(!l.bg){x.shadowColor='rgba(0,0,0,.55)';x.shadowBlur=14;}
    lines.forEach(function(s,i){x.fillText(s,c.width/2,pad+59+i*118-4);});
    l._tk=key;l._tc=c;return c;
  }
  function srcOf(l){
    if(l.type==='logo'){var im=l.col?LOGO.col:LOGO.wh;return im?{s:im,w:im.naturalWidth,h:im.naturalHeight}:null;}
    if(l.type==='text'){var c=textCanvas(l);return {s:c,w:c.width,h:c.height};}
    if(l.type==='img'){var i=l.el;if(!i||!i.naturalWidth)return null;var r={s:i,w:i.naturalWidth,h:i.naturalHeight};if(l.key){var k=keyed(l,i,r.w,r.h);r={s:k,w:k.width,h:k.height};}return r;}
    if(l.type==='pip'){var v=l.el;if(!v||v.readyState<2||!v.videoWidth)return null;var r2={s:v,w:v.videoWidth,h:v.videoHeight};if(l.key){var k2=keyed(l,v,r2.w,r2.h);r2={s:k2,w:k2.width,h:k2.height};}return r2;}
    return null;
  }
  function box(l,W,H,t){var sr=srcOf(l);if(!sr)return null;var v=evalL(l,t),w=v.w/100*W,h=w*sr.h/sr.w;return {sr:sr,w:w,h:h,cx:v.x*W,cy:v.y*H,v:v};}
  function visible(l,t){return t>=l.t0-0.001&&t<=l.t1+0.001;}
  function drawLayer(c,l,W,H,t){
    if(!visible(l,t))return;var b=box(l,W,H,t);if(!b)return;
    c.save();c.translate(b.cx,b.cy);c.rotate(b.v.r*Math.PI/180);c.globalAlpha=clamp(b.v.o/100,0,1);
    if(l.rd>0&&l.type!=='text'){rrect(c,-b.w/2,-b.h/2,b.w,b.h,l.rd/100*Math.min(b.w,b.h));c.clip();}
    try{c.drawImage(b.sr.s,-b.w/2,-b.h/2,b.w,b.h);}catch(e){}c.restore();
  }
  function wrapLines(c,text,fs,maxW){
    c.font='800 '+fs+'px '+HFONT;var out=[];
    text.toUpperCase().split(/\r?\n/).forEach(function(para){
      var words=para.trim().split(/\s+/).filter(Boolean),line='';
      if(!words.length){out.push('');return;}
      words.forEach(function(w){var t=line?line+' '+w:w;if(!line||c.measureText(t).width<=maxW)line=t;else{out.push(line);line=w;}});
      out.push(line);
    });
    return out;
  }
  function drawHeadline(c,W,H,preview){
    var kx=W/FR.W,ky=H/FR.H,b=FR.box,bx=b.x*kx,by=b.y*ky,bw=b.w*kx,bh=b.h*ky,txt=st.head,hint=false;
    if(!txt.trim()){if(!preview)return;txt='TYPE YOUR HEADLINE';hint=true;}
    function ok(fs){var Ls=wrapLines(c,txt,fs,bw);if(Ls.length*fs*HLH>bh)return false;for(var i=0;i<Ls.length;i++)if(c.measureText(Ls[i]).width>bw+0.5)return false;return true;}
    var lo=8,hi=Math.round(260*kx),best=8;while(lo<=hi){var mid=(lo+hi)>>1;if(ok(mid)){best=mid;lo=mid+1;}else hi=mid-1;}
    var fs=Math.max(8,Math.floor(best*(st.headSize/100)));if(hint)fs=Math.min(fs,Math.round(90*kx));
    var Ls=wrapLines(c,txt,fs,bw),lh=fs*HLH,top=by+(bh-Ls.length*lh)/2+lh/2;
    c.save();c.textAlign='center';c.textBaseline='middle';c.fillStyle='#ffffff';if(hint)c.globalAlpha=0.4;
    for(var i=0;i<Ls.length;i++)c.fillText(Ls[i],bx+bw/2,top+i*lh);c.restore();
  }
  function drawScene(c,W,H,vid,preview,t){
    c.setTransform(1,0,0,1,0,0);
    var banner=st.fmt==='banner';
    if(banner){var kx=W/FR.W,ky=H/FR.H,a=FR.area;c.fillStyle='#fff';c.fillRect(0,0,W,H);drawBase(c,W,H,vid,{x:a.x*kx,y:a.y*ky,w:a.w*kx,h:a.h*ky});}
    else drawBase(c,W,H,vid);
    L.forEach(function(l){drawLayer(c,l,W,H,t);});
    if(banner){if(FR.img)c.drawImage(FR.img,0,0,W,H);drawHeadline(c,W,H,preview);}
    if(preview&&sel){var l=get(sel),b=l&&visible(l,t)&&box(l,W,H,t);if(b){c.save();c.translate(b.cx,b.cy);c.rotate(b.v.r*Math.PI/180);c.strokeStyle='#16d8e6';c.lineWidth=Math.max(2,W/170);c.setLineDash([W/55,W/80]);c.strokeRect(-b.w/2,-b.h/2,b.w,b.h);c.setLineDash([]);
      var hr=W/26;c.beginPath();c.arc(b.w/2,b.h/2,hr,0,Math.PI*2);c.fillStyle='#16d8e6';c.fill();c.fillStyle='#001417';c.font='800 '+Math.round(hr*1.25)+'px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText('⤡',b.w/2,b.h/2+hr*0.05);c.restore();}}
  }
  function draw(){if(!cv)return;drawScene(ctx,cv.width,cv.height,null,true,T);}

  /* pictures-in-picture: keep each little video at the right moment */
  function pipWant(l,t){var pd=l.el.duration||1;return (((t-l.t0)%pd)+pd)%pd;}
  function syncPips(t,play){
    L.forEach(function(l){if(l.type!=='pip'||!l.el)return;var v=l.el;
      if(!visible(l,t)){if(play&&!v.paused)try{v.pause();}catch(e){}return;}
      var w=pipWant(l,t);
      if(play){if(v.paused){try{var p=v.play();if(p&&p.catch)p.catch(function(){});}catch(e){}}if(Math.abs(v.currentTime-w)>0.35)try{v.currentTime=w;}catch(e){}}
      else{if(Math.abs(v.currentTime-w)>0.04)try{v.currentTime=w;}catch(e){}}});
  }
  function pausePips(){L.forEach(function(l){if(l.type==='pip'&&l.el)try{l.el.pause();}catch(e){}});}
  function updTime(){var e=$('vs-time');if(e)e.textContent=fmt(T)+' / '+fmt(B.dur);}
  function setScroll(){var sc=$('vs-tls');if(!sc)return;sc.scrollLeft=T*st.pps;lastSet=sc.scrollLeft;}
  function loop(){
    raf=0;if(!playing)return;
    var c=B.el.currentTime;if(c>=B.end-0.03||c<B.start-0.3){B.el.currentTime=B.start;c=B.start;}
    T=c;syncPips(T,true);draw();updTime();setScroll();raf=requestAnimationFrame(loop);
  }
  function setPlaying(on){
    if(on&&!B.el){toast('Add your video first.','error');return;}
    playing=on;var b=$('vs-play');if(b)b.textContent=on?'❚❚':'▶';
    if(!B.el)return;
    if(on){B.el.muted=true;if(T<B.start||T>=B.end-0.05)T=B.start;B.el.currentTime=T;var p=B.el.play();if(p&&p.catch)p.catch(function(){});if(!raf)raf=requestAnimationFrame(loop);}
    else{B.el.pause();pausePips();syncPips(T,false);}
  }
  function seek(t){T=clamp(t,0,B.dur||0);if(B.el)try{B.el.currentTime=T;}catch(e){}syncPips(T,false);draw();updTime();setScroll();toolbar();}

  /* ---------- layers ---------- */
  function get(id){for(var i=0;i<L.length;i++)if(L[i].id===id)return L[i];return null;}
  var NAMES={logo:'Logo',text:'Text',img:'Photo',pip:'Video'},COLS={logo:'#7c5cff',text:'#e08a00',img:'#1f9d6b',pip:'#d6457a'},ICONS={logo:'ti-star',text:'ti-typography',img:'ti-photo',pip:'ti-picture-in-picture'};
  function addLayer(o){
    if(!B.el){toast('Add your video first.','error');return null;}
    var l=Object.assign({id:++idc,x:.5,y:.5,w:30,r:0,o:100,rd:0,key:false,kc:'#00ff00',kt:30,kf:[],t0:clamp(T,0,B.dur),t1:B.dur},o);
    if(l.t1-l.t0<0.5)l.t0=Math.max(0,l.t1-1);
    L.push(l);sel=l.id;panel=(l.type==='text'||l.type==='pip'||l.type==='img');renderTL();toolbar();sheet();draw();return l;
  }
  function deleteSel(){var l=sel&&get(sel);if(!l)return;if(l.type==='pip'&&l.el){try{l.el.pause();URL.revokeObjectURL(l.url);}catch(e){}}L=L.filter(function(x){return x!==l;});sel=null;panel=false;renderTL();toolbar();sheet();draw();}
  function moveZ(d){var l=sel&&get(sel);if(!l)return;var i=L.indexOf(l),j=i+d;if(j<0||j>=L.length)return;L.splice(i,1);L.splice(j,0,l);renderTL();draw();toast(d>0?'Brought forward.':'Sent back.');}

  /* ---------- timeline ---------- */
  function padPx(){var sc=$('vs-tls');return Math.floor((sc?sc.clientWidth:320)/2);}
  function renderTL(){
    var tli=$('vs-tli');if(!tli)return;var pps=st.pps,pad=padPx(),dur=B.dur||0,w=Math.max(10,dur*pps),html='';
    tli.style.width=(pad*2+w)+'px';
    var stepS=pps>=120?1:pps>=60?2:pps>=30?5:10,ticks='';
    for(var s=0;s<=dur;s+=stepS)ticks+='<i style="left:'+(pad+s*pps)+'px"></i><b style="left:'+(pad+s*pps)+'px">'+Math.floor(s/60)+':'+('0'+Math.floor(s%60)).slice(-2)+'</b>';
    html+='<div class="rul">'+ticks+'</div>';
    if(B.el){
      html+='<div class="clip" id="vs-clip" style="margin-left:'+pad+'px;width:'+w+'px"><canvas id="vs-th" width="2000" height="104"></canvas>'+
        '<div class="dim" style="left:0;width:'+(B.start*pps)+'px"></div><div class="dim" style="left:'+(B.end*pps)+'px;right:0"></div>'+
        '<div class="hd" id="vs-hs" style="left:'+(B.start*pps-(B.start>0?0:0))+'px">‹</div><div class="hd" id="vs-he" style="left:'+(B.end*pps-18)+'px">›</div></div>';
    }else html+='<div class="clip" style="margin-left:'+pad+'px;width:'+Math.max(200,pad)+'px;display:flex;align-items:center;justify-content:center;color:#7d8491;font-size:.75rem">Your video</div>';
    for(var i=L.length-1;i>=0;i--){var l=L[i],left=pad+l.t0*pps,bw=Math.max(24,(l.t1-l.t0)*pps),kfs='';
      l.kf.forEach(function(k){kfs+='<div class="kf" style="left:'+(pad+k.t*pps)+'px"></div>';});
      html+='<div class="row">'+kfs+'<div class="bar'+(l.id===sel?' sel':'')+'" data-id="'+l.id+'" style="left:'+left+'px;width:'+bw+'px;background:'+COLS[l.type]+'"><div class="e l" data-e="l"></div><span style="margin-right:.35rem">'+sym(ICONS[l.type])+'</span>'+NAMES[l.type]+'<div class="e r" data-e="r"></div></div></div>';}
    tli.innerHTML=html;
    if(B.el)paintThumbs();
    setScroll();
  }
  function paintThumbs(){var c=$('vs-th');if(c&&thumb)c.getContext('2d').drawImage(thumb,0,0);}
  async function buildThumbs(){
    thumb=document.createElement('canvas');thumb.width=2000;thumb.height=104;var x=thumb.getContext('2d');x.fillStyle='#2a2e36';x.fillRect(0,0,2000,104);
    var tv=document.createElement('video');tv.muted=true;tv.playsInline=true;tv.preload='auto';tv.src=B.url;
    try{await new Promise(function(res,rej){tv.onloadeddata=res;tv.onerror=rej;setTimeout(res,4000);});}catch(e){return;}
    var n=40,tw=2000/n,url=B.url;
    for(var i=0;i<n&&B.url===url;i++){
      await new Promise(function(res){var d=false,f=function(){if(d)return;d=true;tv.removeEventListener('seeked',f);res();};tv.addEventListener('seeked',f);setTimeout(f,1500);try{tv.currentTime=Math.min(B.dur-0.05,(i+0.5)*B.dur/n);}catch(e){f();}});
      try{var s=Math.max(tw/tv.videoWidth,104/tv.videoHeight),dw=tv.videoWidth*s,dh=tv.videoHeight*s;x.save();x.beginPath();x.rect(i*tw,0,tw,104);x.clip();x.drawImage(tv,i*tw+(tw-dw)/2,(104-dh)/2,dw,dh);x.restore();}catch(e){}
      if(i%4===3)paintThumbs();
    }
    paintThumbs();tv.removeAttribute('src');
  }
  // dragging the clip ends (trim) and the layer bars (when it shows, and for how long)
  function tlPointer(){
    var tli=$('vs-tli'),mode=null,x0=0,s0=0,e0=0,l=null;
    tli.addEventListener('pointerdown',function(ev){
      var t=ev.target,bar=t.closest&&t.closest('.bar');
      if(t.id==='vs-hs'||t.id==='vs-he'){mode=t.id==='vs-hs'?'ts':'te';x0=ev.clientX;s0=B.start;e0=B.end;setPlaying(false);}
      else if(bar){l=get(+bar.getAttribute('data-id'));if(!l)return;sel=l.id;mode=t.getAttribute&&t.getAttribute('data-e')==='l'?'ls':t.getAttribute&&t.getAttribute('data-e')==='r'?'le':'lm';x0=ev.clientX;s0=l.t0;e0=l.t1;renderTL();toolbar();sheet();draw();}
      else return;
      try{t.setPointerCapture(ev.pointerId);}catch(e){}ev.preventDefault();
      drag={t:t};
    });
    tli.addEventListener('pointermove',function(ev){
      if(!mode)return;var dt=(ev.clientX-x0)/st.pps;
      if(mode==='ts'){B.start=clamp(s0+dt,0,B.end-0.5);}
      else if(mode==='te'){B.end=clamp(e0+dt,B.start+0.5,B.dur);}
      else if(l){
        if(mode==='lm'){var len=e0-s0,a=clamp(s0+dt,0,B.dur-len);l.t0=a;l.t1=a+len;}
        else if(mode==='ls')l.t0=clamp(s0+dt,0,l.t1-0.3);
        else if(mode==='le')l.t1=clamp(e0+dt,l.t0+0.3,B.dur);
      }
      renderTL();draw();
    });
    function up(){if(mode==='ts'){seek(B.start);}if(mode==='te'){seek(Math.max(B.start,B.end-0.05));}mode=null;l=null;drag=null;}
    tli.addEventListener('pointerup',up);tli.addEventListener('pointercancel',up);
    $('vs-tls').addEventListener('scroll',function(){
      var sc=$('vs-tls');if(!B.el)return;if(Math.abs(sc.scrollLeft-lastSet)<2)return;
      if(playing)setPlaying(false);T=clamp(sc.scrollLeft/st.pps,0,B.dur);try{B.el.currentTime=T;}catch(e){}syncPips(T,false);draw();updTime();toolbar();if(panel)syncSheetValues();
    },{passive:true});
  }

  /* ---------- toolbar and the bottom sheet ---------- */
  function tbBtn(id,icon,label,on,dis){return '<button id="'+id+'" class="'+(on?'on':'')+'"'+(dis?' disabled':'')+'><i>'+sym(icon)+'</i>'+label+'</button>';}
  function toolbar(){
    var tb=$('vs-tb');if(!tb)return;var l=sel&&get(sel),h='';
    if(l){
      var hasK=!!kfAt(l,T);
      h=tbBtn('tb-done','ti-chevron-left','Back')+tbBtn('tb-edit','ti-adjustments','Edit',panel)+tbBtn('tb-kf','ti-diamond'+(hasK?'-filled':''),hasK?'Remove key':'Keyframe',hasK||l.kf.length>0)+
        ((l.type==='img'||l.type==='pip')?tbBtn('tb-key','ti-wand','Remove BG',l.key):'')+(l.type==='logo'?tbBtn('tb-lcol','ti-palette','Logo colour'):'')+
        tbBtn('tb-fwd','ti-arrow-bar-up','Forward')+tbBtn('tb-bwd','ti-arrow-bar-down','Back layer')+tbBtn('tb-del','ti-trash','Delete');
    }else{
      h=tbBtn('tb-vid','ti-video','Video')+tbBtn('tb-logo','ti-star','Logo',false,!B.el)+tbBtn('tb-text','ti-typography','Text',false,!B.el)+tbBtn('tb-img','ti-photo','Photo',false,!B.el)+tbBtn('tb-pip','ti-picture-in-picture','Overlay',false,!B.el)+
        (st.fmt==='banner'?tbBtn('tb-head','H','Headline',hsheet):'')+tbBtn('tb-ban','ti-frame',st.fmt==='banner'?'Banner on':'Banner off',st.fmt==='banner')+tbBtn('tb-fit','ti-aspect-ratio',st.fit==='fill'?'Fill':'Fit all',false,!B.el)+tbBtn('tb-snd',st.snd?'ti-volume':'ti-volume-off',st.snd?'Sound on':'Sound off',!st.snd);
    }
    tb.innerHTML=h;
  }
  function syncSheetValues(){
    var l=sel&&get(sel);if(!l||!panel)return;var v=evalL(l,T);
    [['sh-w','w'],['sh-r','r'],['sh-o','o']].forEach(function(p){var e=$(p[0]);if(e)e.value=v[p[1]];});
  }
  function sheet(){
    var sh=$('vs-sheet'),l=sel&&get(sel);if(!sh)return;
    if(hsheet&&!l&&st.fmt==='banner'){
      sh.innerHTML='<textarea id="sh-h" rows="2" maxlength="140" placeholder="Type your headline">'+st.head.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</textarea><div class="sl"><span>Headline size</span><input type="range" id="sh-hs" min="40" max="100" value="'+st.headSize+'"></div>';
      sh.style.display='';$('sh-h').addEventListener('input',function(e){st.head=e.target.value;draw();});$('sh-hs').addEventListener('input',function(e){st.headSize=+e.target.value;draw();});sizeCv();return;
    }
    if(!l||!panel){sh.style.display='none';sh.innerHTML='';sizeCv();return;}
    var v=evalL(l,T),h='';
    if(l.type==='text')h+='<textarea id="sh-t" rows="2" maxlength="120" placeholder="Type your text">'+String(l.t).replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</textarea><div class="sl"><label>Text <input type="color" id="sh-tc" value="'+l.c+'"></label><label>Box <input type="color" id="sh-tb" value="'+l.bc+'"></label><label><input type="checkbox" id="sh-tbon" '+(l.bg?'checked':'')+'> Box</label></div>';
    h+='<div class="sl"><span>Size</span><input type="range" id="sh-w" min="3" max="250" value="'+v.w+'"></div><div class="sl"><span>Turn</span><input type="range" id="sh-r" min="-180" max="180" value="'+v.r+'"></div><div class="sl"><span>Strength</span><input type="range" id="sh-o" min="10" max="100" value="'+v.o+'"></div>';
    if(l.type!=='text')h+='<div class="sl"><span>Round</span><input type="range" id="sh-rd" min="0" max="50" value="'+l.rd+'"></div>';
    if((l.type==='img'||l.type==='pip')&&l.key)h+='<div class="sl"><label>Background colour <input type="color" id="sh-kc" value="'+l.kc+'"></label></div><div class="sl"><span>How much</span><input type="range" id="sh-kt" min="5" max="80" value="'+l.kt+'"></div>';
    h+='<div style="color:#7d8491;font-size:.72rem;margin-top:.3rem">'+(l.kf.length?'Keyframes on: changes you make at the playhead are saved as keyframes.':'Tip: tap Keyframe, move the playhead, then change size or position to animate.')+'</div>';
    sh.innerHTML=h;sh.style.display='';
    function on(id,fn){var e=$(id);if(e)e.addEventListener('input',fn);}
    on('sh-w',function(e){setProp(l,'w',+e.target.value);renderTL();draw();});on('sh-r',function(e){setProp(l,'r',+e.target.value);draw();});on('sh-o',function(e){setProp(l,'o',+e.target.value);draw();});
    on('sh-rd',function(e){l.rd=+e.target.value;draw();});on('sh-t',function(e){l.t=e.target.value;draw();});on('sh-tc',function(e){l.c=e.target.value;draw();});on('sh-tb',function(e){l.bc=e.target.value;draw();});
    on('sh-tbon',function(e){l.bg=e.target.checked;draw();});on('sh-kc',function(e){l.kc=e.target.value;draw();});on('sh-kt',function(e){l.kt=+e.target.value;draw();});
    sizeCv();
  }

  /* ---------- wiring ---------- */
  function pos(e){var r=cv.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};}
  function hit(p){var W=cv.width,H=cv.height;
    for(var i=L.length-1;i>=0;i--){var l=L[i];if(!visible(l,T))continue;var b=box(l,W,H,T);if(!b)continue;
      var dx=p.x*W-b.cx,dy=p.y*H-b.cy,a=-b.v.r*Math.PI/180,rx=dx*Math.cos(a)-dy*Math.sin(a),ry=dx*Math.sin(a)+dy*Math.cos(a);
      if(Math.abs(rx)<=b.w/2&&Math.abs(ry)<=b.h/2)return l;}return null;}
  function pickFile(id){$(id).click();}
  function wire(){
    $('vs-x').onclick=close;
    $('vs-fmt').onclick=function(){st.fmt=FMTS[(FMTS.indexOf(st.fmt)+1)%FMTS.length];this.textContent=FLAB[st.fmt];toolbar();sizeCv();draw();};
    $('vs-first').onclick=function(){pickFile('vs-fv');};
    $('vs-play').onclick=function(){setPlaying(!playing);};
    $('vs-zi').onclick=function(){st.pps=clamp(st.pps*1.5,15,300);renderTL();setScroll();};
    $('vs-zo').onclick=function(){st.pps=clamp(st.pps/1.5,15,300);renderTL();setScroll();};
    $('vs-exp').onclick=make;
    $('vs-fv').onchange=function(e){loadBase(e.target.files[0]);e.target.value='';};
    $('vs-fi').onchange=function(e){var f=e.target.files[0];e.target.value='';if(!f)return;if(!/^image\//.test(f.type)){toast('Choose an image file.','error');return;}
      var im=new Image();im.onload=function(){addLayer({type:'img',el:im,w:40,y:.3,t1:Math.min(B.dur,T+4)});};im.onerror=function(){toast('That photo could not be opened.','error');};im.src=URL.createObjectURL(f);};
    $('vs-fp').onchange=function(e){var f=e.target.files[0];e.target.value='';if(!f)return;
      var u=URL.createObjectURL(f),v=document.createElement('video');v.muted=true;v.loop=true;v.playsInline=true;v.preload='auto';v.setAttribute('playsinline','');
      v.onloadeddata=function(){v.currentTime=0.05;addLayer({type:'pip',el:v,url:u,w:42,x:.72,y:.3,rd:12,t1:Math.min(B.dur,T+Math.max(2,v.duration||2))});};
      v.onseeked=function(){draw();};v.onerror=function(){toast('That video could not be opened in the browser. Try an MP4.','error');};v.src=u;};
    $('vs-tb').addEventListener('click',function(e){
      var b=e.target.closest('button');if(!b||b.disabled)return;var id=b.id,l=sel&&get(sel);
      if(id==='tb-vid'||id==='tb-first')pickFile('vs-fv');
      else if(id==='tb-logo')addLayer({type:'logo',col:false,w:24,x:.8,y:.08,t0:0,t1:B.dur});
      else if(id==='tb-text')addLayer({type:'text',t:'YOUR TEXT',c:'#ffffff',bc:'#2065fe',bg:true,w:70,y:.82,t1:Math.min(B.dur,T+4)});
      else if(id==='tb-img')pickFile('vs-fi');else if(id==='tb-pip')pickFile('vs-fp');
      else if(id==='tb-ban'){st.fmt=st.fmt==='banner'?'9:16':'banner';$('vs-fmt').textContent=FLAB[st.fmt];if(st.fmt!=='banner')hsheet=false;toolbar();sheet();sizeCv();draw();}
      else if(id==='tb-head'){hsheet=!hsheet;toolbar();sheet();}
      else if(id==='tb-fit'){st.fit=st.fit==='fill'?'fit':'fill';toolbar();draw();}
      else if(id==='tb-snd'){st.snd=!st.snd;toolbar();toast(st.snd?'The video\'s sound will be kept.':'The new video will have no sound.');}
      else if(id==='tb-done'){hsheet=false;sel=null;panel=false;renderTL();toolbar();sheet();draw();}
      else if(id==='tb-edit'){panel=!panel;toolbar();sheet();}
      else if(id==='tb-kf')toggleKf();
      else if(id==='tb-key'&&l){l.key=!l.key;panel=true;toolbar();sheet();draw();}
      else if(id==='tb-lcol'&&l){l.col=!l.col;draw();}
      else if(id==='tb-fwd')moveZ(1);else if(id==='tb-bwd')moveZ(-1);else if(id==='tb-del')deleteSel();
    });
    function onHandle(l,p){var b=box(l,cv.width,cv.height,T);if(!b)return false;var a=b.v.r*Math.PI/180,hx=b.cx+(b.w/2*Math.cos(a)-b.h/2*Math.sin(a)),hy=b.cy+(b.w/2*Math.sin(a)+b.h/2*Math.cos(a));
      return Math.hypot(p.x*cv.width-hx,p.y*cv.height-hy)<=cv.width/12;}
    function two(){var k=Object.keys(ptrs);if(k.length<2)return null;var a=ptrs[k[0]],b=ptrs[k[1]];return {d:Math.hypot(a.x-b.x,a.y-b.y)||1,a:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI};}
    cv.addEventListener('pointerdown',function(e){var p=pos(e);ptrs[e.pointerId]={x:e.clientX,y:e.clientY};try{cv.setPointerCapture(e.pointerId);}catch(x){}
      var cur=sel&&get(sel);
      if(Object.keys(ptrs).length===2&&cur){var t2=two(),v0=evalL(cur,T);gest={id:cur.id,d:t2.d,a:t2.a,w:v0.w,r:v0.r};drag=null;e.preventDefault();return;}
      if(cur&&visible(cur,T)&&onHandle(cur,p)){var v1=evalL(cur,T);drag={id:cur.id,scale:true,w:v1.w,x0:p.x,y0:p.y,cx:v1.x,cy:v1.y};e.preventDefault();return;}
      var l=hit(p);if(!l){if(sel){sel=null;panel=false;renderTL();toolbar();sheet();draw();}return;}
      if(sel!==l.id){hsheet=false;sel=l.id;renderTL();toolbar();sheet();}var v=evalL(l,T);drag={id:l.id,dx:v.x-p.x,dy:v.y-p.y};draw();e.preventDefault();});
    cv.addEventListener('pointermove',function(e){
      if(ptrs[e.pointerId]){ptrs[e.pointerId]={x:e.clientX,y:e.clientY};}
      if(gest){var l=get(gest.id),t2=two();if(l&&t2){setProp(l,'w',clamp(gest.w*t2.d/gest.d,3,250));setProp(l,'r',Math.round(clamp(gest.r+(t2.a-gest.a),-180,180)));syncSheetValues();draw();}return;}
      if(!drag||!drag.id)return;var l2=get(drag.id),p=pos(e);if(!l2)return;
      if(drag.scale){var W=cv.width,H=cv.height,d0=Math.hypot((drag.x0-drag.cx)*W,(drag.y0-drag.cy)*H)||1,d1=Math.hypot((p.x-drag.cx)*W,(p.y-drag.cy)*H);setProp(l2,'w',clamp(drag.w*d1/d0,3,250));syncSheetValues();draw();return;}
      setProp(l2,'x',clamp(p.x+drag.dx,0,1));setProp(l2,'y',clamp(p.y+drag.dy,0,1));draw();});
    var endD=function(e){delete ptrs[e.pointerId];if(gest&&Object.keys(ptrs).length<2){gest=null;renderTL();}if(drag&&drag.id&&!Object.keys(ptrs).length){drag=null;renderTL();}};cv.addEventListener('pointerup',endD);cv.addEventListener('pointercancel',endD);
    cv.style.touchAction='none';
    tlPointer();
  }
  function loadBase(file){
    if(!file)return;
    if(!/^video\//.test(file.type)&&!/\.(mp4|mov|webm|m4v)$/i.test(file.name)){toast('Choose a video file.','error');return;}
    var url=URL.createObjectURL(file),v=document.createElement('video');v.muted=true;v.playsInline=true;v.preload='auto';v.setAttribute('playsinline','');
    v.onloadedmetadata=function(){
      if(!isFinite(v.duration)||v.duration<1){URL.revokeObjectURL(url);toast('This video is too short or could not be read.','error');return;}
      if(v.duration>900){URL.revokeObjectURL(url);toast('This video is over 15 minutes. Please cut it shorter first.','error');return;}
      setPlaying(false);if(B.url)URL.revokeObjectURL(B.url);
      B={file:file,url:url,el:v,w:v.videoWidth,h:v.videoHeight,dur:v.duration,start:0,end:v.duration};
      st.pps=clamp(Math.round(Math.min(160,Math.max(20,260/v.duration*1.0))),20,160);if(v.duration<8)st.pps=90;
      T=0;$('vs-empty').style.display='none';v.currentTime=0.05;thumb=null;L=L.filter(function(x){return x.type!=='logo'||!x.auto;});renderTL();toolbar();updTime();buildThumbs();
      if(st.fmt==='banner'&&!L.some(function(x){return x.type==='logo';})){var lg=addLayer({type:'logo',auto:true,col:false,w:20,x:.14,y:.60,t0:0,t1:B.dur});sel=null;panel=false;renderTL();toolbar();sheet();draw();}
      if(v.videoWidth>v.videoHeight&&st.fmt==='9:16')toast('This video is wide. Try "Fit all" or the 16:9 size.','success');
    };
    v.onseeked=function(){draw();};v.onloadeddata=function(){draw();};
    v.onerror=function(){URL.revokeObjectURL(url);toast('This video could not be opened in the browser. Try an MP4.','error');};v.src=url;
  }

  /* ---------- export: every frame at its exact time ---------- */
  var CODECS=['avc1.640032','avc1.64002A','avc1.640029','avc1.4D0029','avc1.4D001F','avc1.42E01F'];
  async function pickConfig(fw,fh,FPS,vbps){
    var sizes=[[fw,fh]],r16=function(n){return Math.round(n/16)*16;};
    [0.667,0.5].forEach(function(k){sizes.push([r16(fw*k),r16(fh*k)]);});
    for(var si=0;si<sizes.length;si++){
      for(var ci=0;ci<CODECS.length;ci++){
        var hws=['no-preference','prefer-software'];
        for(var hi=0;hi<hws.length;hi++){
          var cfg={codec:CODECS[ci],width:sizes[si][0],height:sizes[si][1],bitrate:Math.round(vbps*(sizes[si][0]*sizes[si][1])/(fw*fh)),framerate:FPS,avc:{format:'avc'},latencyMode:'realtime',hardwareAcceleration:hws[hi]};
          try{var s=await VideoEncoder.isConfigSupported(cfg);if(s&&s.supported){return {cfg:cfg,scaled:si>0};}}catch(e){}
        }
      }
    }
    return null;
  }
  function showProg(on,pct,txt){var p=$('vs-prog');if(!p){if(!on)return;p=document.createElement('div');p.id='vs-prog';p.className='scr';
      p.innerHTML='<div class="card" style="padding-top:20vh;text-align:center"><div style="font-weight:800;font-size:1.1rem;margin-bottom:.8rem">Creating your video</div><div style="height:10px;border-radius:6px;background:#272b33;overflow:hidden"><div id="vs-bar" style="height:100%;width:0;background:#16d8e6"></div></div><div id="vs-ptxt" style="margin:.7rem 0;color:#9aa1ad"></div><button class="btn2" id="vs-stop">Stop</button></div>';
      ov.appendChild(p);$('vs-stop').onclick=function(){cancel=true;};}
    p.style.display=on?'':'none';if(on){$('vs-bar').style.width=(pct||0)+'%';$('vs-ptxt').textContent=txt||'';}}
  async function make(){
    if(busy)return;
    if(!B.el){toast('Add your video first.','error');return;}
    if(!(window.VideoEncoder&&window.VideoFrame)){toast('This browser cannot create video. Please use Chrome, Edge or a recent Safari.','error');return;}
    setPlaying(false);
    var d=FMT[st.fmt],FPS=30,dur=B.end-B.start,n=Math.round(dur*FPS),i;
    var vbps=Math.max(250000,Math.min(6000000,Math.floor((44*1024*1024*8)/dur-(dur>600?100000:160000))));
    var pc=await pickConfig(d[0],d[1],FPS,vbps);
    if(!pc){toast('This device cannot create video here. Please try Chrome on another phone or a computer.','error');return;}
    var vcfg=pc.cfg,RW=vcfg.width,RH=vcfg.height;
    if(pc.scaled)toast('Making the video in a smaller size ('+RW+'×'+RH+') so this device can handle it.','success');
    clearResult();busy=true;cancel=false;var rv=document.createElement('video');
    var pips=L.filter(function(l){return l.type==='pip'&&l.el;});
    try{
      var vs=[],vdesc=null,aenc=null,asamples=[],adesc=null,acodec='',sr=48000,ch=2,pre=312;
      rv.src=B.url;rv.muted=true;rv.playsInline=true;rv.preload='auto';
      showProg(true,0,'Getting ready…');
      await new Promise(function(res,rej){rv.onloadeddata=res;rv.onerror=function(){rej(new Error('video'));};});
      var rc=document.createElement('canvas');rc.width=RW;rc.height=RH;var rctx=rc.getContext('2d');
      var venc=new VideoEncoder({output:function(c,m){var dd=new Uint8Array(c.byteLength);c.copyTo(dd);
        if(m&&m.decoderConfig&&m.decoderConfig.description)vdesc=new Uint8Array(m.decoderConfig.description.buffer?m.decoderConfig.description:m.decoderConfig.description);
        vs.push({data:dd,d:1000,key:c.type==='key'});},error:function(e){throw e;}});
      venc.configure(vcfg);
      var hasSound=false;
      if(st.snd&&window.AudioEncoder&&window.AudioData){
        showProg(true,0,'Reading the sound…');
        try{
          var ac=new (window.AudioContext||window.webkitAudioContext)({sampleRate:48000});
          var buf=await ac.decodeAudioData(await B.file.arrayBuffer());if(ac.close)ac.close();
          ch=Math.min(2,buf.numberOfChannels);sr=48000;var acfg=null;
          var cfgs=[{codec:'mp4a.40.2',sampleRate:sr,numberOfChannels:ch,bitrate:dur>600?64000:128000},{codec:'opus',sampleRate:sr,numberOfChannels:ch,bitrate:dur>600?48000:96000}];
          for(i=0;i<cfgs.length&&!acfg;i++){try{if((await AudioEncoder.isConfigSupported(cfgs[i])).supported)acfg=cfgs[i];}catch(e){}}
          if(acfg){
            acodec=acfg.codec==='opus'?'opus':'aac';
            aenc=new AudioEncoder({output:function(c,m){var dd=new Uint8Array(c.byteLength);c.copyTo(dd);
              if(m&&m.decoderConfig&&m.decoderConfig.description){var ds=m.decoderConfig.description;adesc=new Uint8Array(ds.buffer?ds.buffer.slice(ds.byteOffset,ds.byteOffset+ds.byteLength):ds);}
              var dl=c.duration?Math.round(c.duration*sr/1e6):(acodec==='aac'?1024:960);asamples.push({data:dd,d:dl});},error:function(e){throw e;}});
            aenc.configure(acfg);
            var s0=Math.floor(B.start*sr),s1=Math.min(buf.length,Math.floor(B.end*sr)),step=4800,chans=[];
            for(i=0;i<ch;i++)chans.push(buf.getChannelData(i));
            for(var p=s0;p<s1;p+=step){
              var m=Math.min(step,s1-p),pl=new Float32Array(m*ch);
              for(i=0;i<ch;i++)pl.set(chans[i].subarray(p,p+m),i*m);
              var ad=new AudioData({format:'f32-planar',sampleRate:sr,numberOfFrames:m,numberOfChannels:ch,timestamp:Math.round((p-s0)*1e6/sr),data:pl});
              aenc.encode(ad);ad.close();
              while(aenc.encodeQueueSize>20)await new Promise(function(r){setTimeout(r,5);});
            }
            await aenc.flush();hasSound=asamples.length>0&&!!adesc;
          }
        }catch(e){hasSound=false;}
        if(!hasSound)toast('No sound could be read from this video, so the new video will have no sound.','error');
      }
      var poster='',next=0;
      function encodeCanvas(k){
        if(k===0)poster=rc.toDataURL('image/jpeg',0.9);
        var fr=new VideoFrame(rc,{timestamp:Math.round(k*1e6/FPS),duration:Math.round(1e6/FPS)});
        venc.encode(fr,{keyFrame:k%60===0});fr.close();
      }
      function prog(){showProg(true,Math.min(100,next/n*100),(next/FPS).toFixed(1)+' / '+dur.toFixed(1)+' s · keep this screen open');}
      function scene(t){drawScene(rctx,RW,RH,rv,false,t);}
      function pipSync(t){pips.forEach(function(l){var v=l.el;if(!visible(l,t)){if(!v.paused)try{v.pause();}catch(e){}return;}
        var w=pipWant(l,t);if(v.paused)try{var p=v.play();if(p&&p.catch)p.catch(function(){});}catch(e){}if(Math.abs(v.currentTime-w)>0.3)try{v.currentTime=w;}catch(e){}});}
      function playPhase(){
        return new Promise(function(resolve){
          var last=Date.now(),fin=false;
          function finish(r){if(fin)return;fin=true;clearInterval(wd);try{rv.pause();}catch(e){}pausePips();resolve(r);}
          var wd=setInterval(function(){if(Date.now()-last>3000)finish(false);},500);
          function cb(now,meta){
            last=Date.now();var t=meta.mediaTime;pipSync(t);scene(t);
            var idx=Math.min(n-1,Math.max(0,Math.round((t-B.start)*FPS)));
            while(next<=idx){encodeCanvas(next);next++;}
            prog();
            if(cancel||next>=n||t>=B.end)finish(true);else rv.requestVideoFrameCallback(cb);
          }
          rv.onended=function(){while(next<n){encodeCanvas(next);next++;}finish(true);};
          pips.forEach(function(l){try{l.el.currentTime=0;}catch(e){}});
          seekTo(rv,B.start).then(function(){rv.playbackRate=1;var p=rv.play();if(p&&p.catch)p.catch(function(){finish(false);});rv.requestVideoFrameCallback(cb);});
        });
      }
      if('requestVideoFrameCallback' in HTMLVideoElement.prototype&&document.visibilityState==='visible'){
        await playPhase();
        while(venc.encodeQueueSize>0)await new Promise(function(r){setTimeout(r,10);});
      }
      for(;next<n&&!cancel;){
        var t=B.start+next/FPS;
        await seekTo(rv,Math.min(t,Math.max(0,B.dur-0.001)));
        for(var q=0;q<pips.length;q++){var pv=pips[q].el;if(visible(pips[q],t))await seekTo(pv,Math.min(pipWant(pips[q],t),Math.max(0,(pv.duration||1)-0.001)));}
        scene(t);encodeCanvas(next);next++;
        while(venc.encodeQueueSize>6)await new Promise(function(r){setTimeout(r,4);});
        if(next%3===0)prog();
      }
      if(cancel){try{venc.close();}catch(e){}showProg(false);toast('Stopped.');return;}
      await venc.flush();venc.close();
      if(!vdesc||!vs.length)throw new Error('encode');
      var vtrack={kind:'v',samples:vs,w:RW,h:RH,desc:vdesc,ts:FPS*1000,dur:vs.length/FPS};
      var atrack=hasSound?{kind:'a',samples:asamples,codec:acodec,desc:adesc,ch:ch,sr:sr,ts:sr,pre:pre,dur:0}:null;
      if(atrack){var tot=0;asamples.forEach(function(s){tot+=s.d;});atrack.dur=tot/sr;
        if(acodec==='opus'&&adesc&&adesc.length>=12&&adesc[0]===0x4F)atrack.pre=adesc[10]+adesc[11]*256;}
      var blob=mux(vtrack,atrack);showProg(false);
      if(blob.size>100*1024*1024){toast('The video came out too big. Make it shorter and try again.','error');return;}
      showResult(blob,poster,acodec);
    }catch(err){
      showProg(false);try{rv.pause();}catch(e){}pausePips();
      toast('Could not create the video on this device. Try a shorter clip, another file, or Chrome.','error');
    }finally{busy=false;draw();}
  }

  /* ---------- result: download + post to social media ---------- */
  function clearResult(){if(result&&result.url)URL.revokeObjectURL(result.url);result=null;var r=$('vs-res');if(r)r.remove();}
  function showResult(blob,poster,acodec){
    var name='buza-media-'+new Date().toISOString().slice(0,10)+'.mp4';
    result={blob:blob,url:URL.createObjectURL(blob),name:name,poster:poster};
    var r=document.createElement('div');r.id='vs-res';r.className='scr';
    r.innerHTML='<div class="card"><div style="display:flex;align-items:center;justify-content:space-between"><b style="font-size:1.1rem">Your video is ready</b><button class="ib" id="vs-rb" aria-label="Back to editing">✕</button></div>'+
      '<video controls playsinline src="'+result.url+'"></video><div style="color:#9aa1ad;font-size:.8rem">'+(blob.size/1048576).toFixed(1)+' MB · MP4'+(acodec==='opus'?' · sound in Opus format (Instagram may not play it; use Chrome on a phone for AAC)':'')+'</div>'+
      '<label style="display:block;margin-top:.7rem;color:#9aa1ad;font-size:.8rem">Video from (optional, e.g. Wasafi Media)</label><input type="text" id="vs-credit" maxlength="80" placeholder="Wasafi Media">'+
      '<label style="display:block;color:#9aa1ad;font-size:.8rem">Caption</label><textarea id="vs-cap" rows="3" maxlength="1800" placeholder="Write the caption here"></textarea>'+
      '<div><button class="btn2" id="vs-dl"><i class="ti ti-download"></i> Download video</button><button class="btn2 p" id="vs-post"><i class="ti ti-send"></i> <span>Post to social media</span></button></div><div id="vs-st" style="color:#c5cad3;font-size:.85rem;margin-top:.4rem"></div></div>';
    ov.appendChild(r);
    $('vs-rb').onclick=function(){r.remove();};
    $('vs-dl').onclick=function(){var a=document.createElement('a');a.href=result.url;a.download=result.name;document.body.appendChild(a);a.click();a.remove();};
    $('vs-post').onclick=function(){post(this);};
  }
  async function post(btn){
    var lab=btn.querySelector('span'),stt=$('vs-st'),say=function(t){stt.textContent=t;};
    if(btn.dataset.busy||!result)return;
    if(typeof isLoggedIn!=='undefined'&&!isLoggedIn){toast('Log in as admin first.','error');return;}
    btn.dataset.busy='1';btn.disabled=true;if(lab)lab.textContent='Posting…';
    var credit=$('vs-credit').value.replace(/\s+/g,' ').trim(),cap=$('vs-cap').value.trim();
    if(credit)cap=(cap?cap+'\n\n':'')+'Video kutoka '+credit;
    var done=[],failed=[],name=function(p){return p.charAt(0).toUpperCase()+p.slice(1);};
    try{
      say('Uploading the video… keep this tab open');
      var pr=await sb.functions.invoke('social-post-video',{body:{action:'prepare'}});
      if(pr.error||!pr.data||pr.data.error)throw new Error('prepare');
      var up=await sb.storage.from('social-videos').uploadToSignedUrl(pr.data.path,pr.data.token,result.blob,{contentType:'video/mp4'});
      if(up.error)throw new Error('upload');
      say('Sending to social media…');
      var sr=await sb.functions.invoke('social-post-video',{body:{action:'start',path:pr.data.path,caption:cap}});
      if(sr.error||!sr.data||sr.data.error)throw new Error('start');
      var wait=[];
      (sr.data.results||[]).forEach(function(r){
        if(r.status==='published')done.push(name(r.platform));else if(r.status==='processing')wait.push(r);
        else failed.push(name(r.platform)+': '+String(r.error||'failed').slice(0,110));
      });
      for(var w=0;w<wait.length;w++){
        var r=wait[w],ok=false;
        for(var k=0;k<200&&!ok;k++){
          say('Instagram is processing the video… '+Math.round((k*6)/60*10)/10+' min'+(done.length?' (posted to '+done.join(' & ')+' already)':''));
          await new Promise(function(res){setTimeout(res,6000);});
          var f=await sb.functions.invoke('social-post-video',{body:{action:'finish',container:r.container,account:r.account}});
          var dd=f.data||{};
          if(dd.status==='published'){done.push(name(r.platform));ok=true;}
          else if(dd.status==='failed'){failed.push(name(r.platform)+': '+String(dd.error||'failed').slice(0,110));ok=true;}
        }
        if(!ok)failed.push(name(r.platform)+': still processing after 20 minutes. Check Instagram later.');
      }
      var msg=(done.length?'Posted to '+done.join(' & ')+'.':'')+(failed.length?(done.length?' ':'')+'Not posted: '+failed.join(' | '):'');
      say(msg||'Nothing to post: no social account is switched on.');
      toast(done.length?('Posted to '+done.join(' & ')+(failed.length?' (some failed)':'')+'.'):'Could not post the video.',done.length&&!failed.length?'success':'error');
    }catch(e){say('Could not post the video right now. Please try again.');toast('Could not post the video right now.','error');}
    delete btn.dataset.busy;btn.disabled=false;if(lab)lab.textContent='Post to social media';
  }
  window.__vsOpen=open;
  window.__vs={st:st,B:function(){return B;},L:function(){return L;},make:make,addLayer:addLayer,result:function(){return result;},seek:seek,toggleKf:toggleKf,sel:function(i){sel=i;},setProp:setProp,T:function(){return T;},evalL:evalL};
  var ob=document.getElementById('vs-open');if(ob)ob.addEventListener('click',open);
})();
