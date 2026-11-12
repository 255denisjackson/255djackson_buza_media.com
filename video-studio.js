/* Buza Media Video Studio: edit a video on the site (logo, text, photos, picture-in-picture videos, solid-background removal),
   make the MP4 in the browser and post it to Facebook / Instagram. Admin only. */
(function(){
  'use strict';
  var root=document.getElementById('vs-root');if(!root)return;
  var $=function(id){return document.getElementById(id);};
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

  var FMT={'9:16':[1080,1920],'1:1':[1080,1080],'16:9':[1920,1080]};
  var st={fmt:'9:16',fit:'fill',snd:true};
  var B={file:null,url:null,el:null,w:0,h:0,dur:0,start:0,end:0};
  var L=[],sel=null,idc=0,playing=false,raf=0,busy=false,cancel=false,result=null,drag=null,LOGO={wh:null,col:null};
  var cv,ctx,small=document.createElement('canvas');
  function fmt(t){var m=Math.floor(t/60),s=t-m*60;return m+':'+(s<10?'0':'')+s.toFixed(1);}

  /* ---------- screen ---------- */
  root.innerHTML=
   '<style>#vs-root .vs-row{display:flex;flex-wrap:wrap;gap:.4rem;margin:.4rem 0}#vs-root .vs-row .btn{flex:1 1 auto}'+
   '#vs-root canvas{width:100%;max-width:340px;display:block;margin:0 auto;border-radius:10px;background:#000;touch-action:none}'+
   '#vs-root .vs-chip{padding:.3rem .6rem;border:1px solid #cfd4dc;border-radius:999px;background:#fff;font-size:.8rem;cursor:pointer}'+
   '#vs-root .vs-chip[aria-pressed=true]{background:#2065fe;color:#fff;border-color:#2065fe}'+
   '#vs-root input[type=text],#vs-root textarea{width:100%;padding:.5rem .65rem;border:1px solid #cfd4dc;border-radius:8px;font:inherit}'+
   '#vs-root .vs-sl{display:flex;align-items:center;gap:.5rem;margin:.25rem 0;font-size:.82rem}#vs-root .vs-sl span{width:78px}#vs-root .vs-sl input{flex:1}'+
   '#vs-root h4{margin:.8rem 0 .2rem;font-size:.9rem}</style>'+
   '<div class="cb-note">Add your video, then add a logo, text, photos or another video on top (picture in picture). Drag the things on the picture to move them.</div>'+
   '<canvas id="vs-cv" aria-label="Video preview"></canvas>'+
   '<div class="vs-row"><button type="button" class="btn btn-secondary" id="vs-play"><i class="ti ti-player-play" aria-hidden="true"></i> Play preview</button></div>'+
   '<h4>1. Picture size</h4><div class="vs-row" id="vs-fmt"><button type="button" class="vs-chip" data-v="9:16" aria-pressed="true">Tall 9:16</button><button type="button" class="vs-chip" data-v="1:1" aria-pressed="false">Square 1:1</button><button type="button" class="vs-chip" data-v="16:9" aria-pressed="false">Wide 16:9</button></div>'+
   '<h4>2. Your video</h4><div class="cb-slot"><div class="cb-pick" id="vs-pick"><strong>Video</strong><span id="vs-vn">Choose a video</span><input type="file" id="vs-fv" accept="video/*"></div></div>'+
   '<div class="vs-row" id="vs-fit"><button type="button" class="vs-chip" data-v="fill" aria-pressed="true">Fill the screen</button><button type="button" class="vs-chip" data-v="fit" aria-pressed="false">Show all (blurred sides)</button></div>'+
   '<div class="vs-sl"><span>Start</span><input type="range" id="vs-ts" min="0" max="0" step="0.1" value="0" disabled></div>'+
   '<div class="vs-sl"><span>End</span><input type="range" id="vs-te" min="0" max="0" step="0.1" value="0" disabled></div>'+
   '<div class="cb-note" id="vs-tl">Add a video to trim it.</div>'+
   '<label class="cb-note" style="display:flex;gap:.4rem;align-items:center"><input type="checkbox" id="vs-snd" checked> Keep the video\'s sound</label>'+
   '<h4>3. Add on top</h4><div class="vs-row">'+
   '<button type="button" class="btn btn-secondary" id="vs-add-logo"><i class="ti ti-star" aria-hidden="true"></i> Logo</button>'+
   '<button type="button" class="btn btn-secondary" id="vs-add-text"><i class="ti ti-typography" aria-hidden="true"></i> Text</button>'+
   '<button type="button" class="btn btn-secondary" id="vs-add-img"><i class="ti ti-photo" aria-hidden="true"></i> Photo<input type="file" id="vs-fi" accept="image/*" hidden></button>'+
   '<button type="button" class="btn btn-secondary" id="vs-add-pip"><i class="ti ti-picture-in-picture" aria-hidden="true"></i> Video on top<input type="file" id="vs-fp" accept="video/*" hidden></button></div>'+
   '<div class="vs-row" id="vs-layers"></div>'+
   '<div id="vs-ctl" style="display:none;border:1px solid #e1e5ea;border-radius:10px;padding:.6rem">'+
     '<div id="vs-textctl" style="display:none"><textarea id="vs-txt" rows="2" maxlength="120" placeholder="Type your text"></textarea>'+
       '<div class="vs-row" style="align-items:center"><label class="cb-note">Text <input type="color" id="vs-tc" value="#ffffff"></label><label class="cb-note">Box <input type="color" id="vs-tb" value="#2065fe"></label><label class="cb-note"><input type="checkbox" id="vs-tbon" checked> Show box</label></div></div>'+
     '<div class="vs-sl"><span>Size</span><input type="range" id="vs-w" min="5" max="100" value="30"></div>'+
     '<div class="vs-sl"><span>Turn</span><input type="range" id="vs-r" min="-180" max="180" value="0"></div>'+
     '<div class="vs-sl"><span>Strength</span><input type="range" id="vs-o" min="10" max="100" value="100"></div>'+
     '<div class="vs-sl" id="vs-rr"><span>Round corners</span><input type="range" id="vs-rd" min="0" max="50" value="0"></div>'+
     '<div id="vs-keyctl" style="display:none"><label class="cb-note" style="display:flex;gap:.4rem;align-items:center"><input type="checkbox" id="vs-kon"> Remove a solid background (e.g. green screen)</label>'+
       '<div class="vs-row" style="align-items:center"><label class="cb-note">Background colour <input type="color" id="vs-kc" value="#00ff00"></label></div>'+
       '<div class="vs-sl"><span>How much</span><input type="range" id="vs-kt" min="5" max="80" value="30"></div></div>'+
     '<div class="vs-row"><button type="button" class="btn btn-secondary" id="vs-up">Bring forward</button><button type="button" class="btn btn-secondary" id="vs-dn">Send back</button><button type="button" class="btn btn-secondary" id="vs-del"><i class="ti ti-trash" aria-hidden="true"></i> Delete</button></div>'+
   '</div>'+
   '<h4>4. Make it</h4>'+
   '<div class="vs-row"><button type="button" class="btn btn-primary full" id="vs-make"><i class="ti ti-movie" aria-hidden="true"></i> Create video</button></div>'+
   '<div id="vs-prog" class="cb-note" style="display:none"><div style="height:8px;border-radius:6px;background:#e3e6ea;overflow:hidden"><div id="vs-bar" style="height:100%;width:0;background:#2065fe"></div></div><span id="vs-ptxt"></span> <button type="button" class="btn btn-secondary" id="vs-stop">Stop</button></div>'+
   '<div id="vs-res" style="display:none"></div>';
  cv=$('vs-cv');ctx=cv.getContext('2d');
  function sizeCv(){var d=FMT[st.fmt];cv.width=Math.round(d[0]/2);cv.height=Math.round(d[1]/2);}
  sizeCv();
  function setPressed(g,v){var bs=$(g).querySelectorAll('button');for(var i=0;i<bs.length;i++)bs[i].setAttribute('aria-pressed',bs[i].getAttribute('data-v')===v?'true':'false');}
  function showProg(on,pct,txt){$('vs-prog').style.display=on?'':'none';if(on){$('vs-bar').style.width=(pct||0)+'%';$('vs-ptxt').textContent=txt||'';}}

  /* ---------- drawing ---------- */
  function rrect(c,x,y,w,h,r){r=Math.max(0,Math.min(r,w/2,h/2));c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
  function cover(c,src,sw,sh,W,H){var s=Math.max(W/sw,H/sh),dw=sw*s,dh=sh*s;c.drawImage(src,(W-dw)/2,(H-dh)/2,dw,dh);}
  function drawBase(c,W,H,vid){
    c.fillStyle='#000';c.fillRect(0,0,W,H);
    var v=vid||B.el;
    if(!v||v.readyState<2||!B.w){c.fillStyle='#1f3a5f';c.fillRect(0,0,W,H);c.fillStyle='rgba(255,255,255,.9)';c.textAlign='center';c.textBaseline='middle';c.font='800 '+Math.round(W*0.07)+'px Arial';c.fillText('ADD VIDEO',W/2,H/2);return;}
    if(st.fit==='fill'){try{cover(c,v,B.w,B.h,W,H);}catch(e){}return;}
    try{ // blurred copy behind, whole picture in front
      small.width=36;small.height=Math.max(2,Math.round(36*H/W));
      var sx=small.getContext('2d');sx.drawImage(v,0,0,B.w,B.h,0,0,small.width,small.height);
      var im=small.getContext('2d');c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
      cover(c,small,small.width,small.height,W,H);c.fillStyle='rgba(0,0,0,.25)';c.fillRect(0,0,W,H);c.restore();
      var s=Math.min(W/B.w,H/B.h),dw=B.w*s,dh=B.h*s;c.drawImage(v,(W-dw)/2,(H-dh)/2,dw,dh);
    }catch(e){}
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
    x.font=f;x.textAlign='center';x.textBaseline='middle';x.fillStyle=l.c;
    if(!l.bg){x.shadowColor='rgba(0,0,0,.55)';x.shadowBlur=14;}
    lines.forEach(function(s,i){x.fillText(s,c.width/2,pad+59+i*118-4);});
    l._tk=key;l._tc=c;return c;
  }
  function srcOf(l){ // the picture a layer shows, with its size
    if(l.type==='logo'){var im=l.col?LOGO.col:LOGO.wh;return im?{s:im,w:im.naturalWidth,h:im.naturalHeight}:null;}
    if(l.type==='text'){var c=textCanvas(l);return {s:c,w:c.width,h:c.height};}
    if(l.type==='img'){var i=l.el;if(!i||!i.naturalWidth)return null;var r={s:i,w:i.naturalWidth,h:i.naturalHeight};
      if(l.key){var k=keyed(l,i,r.w,r.h);r={s:k,w:k.width,h:k.height};}return r;}
    if(l.type==='pip'){var v=l.el;if(!v||v.readyState<2||!v.videoWidth)return null;var r2={s:v,w:v.videoWidth,h:v.videoHeight};
      if(l.key){var k2=keyed(l,v,r2.w,r2.h);r2={s:k2,w:k2.width,h:k2.height};}return r2;}
    return null;
  }
  function box(l,W,H){var sr=srcOf(l);if(!sr)return null;var w=l.w/100*W,h=w*sr.h/sr.w;return {sr:sr,w:w,h:h,cx:l.x*W,cy:l.y*H};}
  function drawLayer(c,l,W,H){
    var b=box(l,W,H);if(!b)return;
    c.save();c.translate(b.cx,b.cy);c.rotate(l.r*Math.PI/180);c.globalAlpha=l.o/100;
    if(l.rd>0&&l.type!=='text'){rrect(c,-b.w/2,-b.h/2,b.w,b.h,l.rd/100*Math.min(b.w,b.h));c.clip();}
    try{c.drawImage(b.sr.s,-b.w/2,-b.h/2,b.w,b.h);}catch(e){}
    c.restore();
  }
  function drawScene(c,W,H,vid,preview){
    c.setTransform(1,0,0,1,0,0);drawBase(c,W,H,vid);
    L.forEach(function(l){drawLayer(c,l,W,H);});
    if(preview&&sel){var l=get(sel),b=l&&box(l,W,H);if(b){c.save();c.translate(b.cx,b.cy);c.rotate(l.r*Math.PI/180);c.strokeStyle='#2065fe';c.lineWidth=Math.max(2,W/180);c.setLineDash([W/60,W/90]);c.strokeRect(-b.w/2,-b.h/2,b.w,b.h);c.restore();}}
  }
  function draw(){drawScene(ctx,cv.width,cv.height,null,true);}
  function loop(){raf=0;if(!playing)return;
    if(B.el&&B.el.currentTime>=B.end-0.03){B.el.currentTime=B.start;}
    draw();raf=requestAnimationFrame(loop);}
  function setPlaying(on){
    if(on&&!B.el){toast('Add a video first.','error');return;}
    playing=on;$('vs-play').innerHTML=on?'<i class="ti ti-player-pause" aria-hidden="true"></i> Pause':'<i class="ti ti-player-play" aria-hidden="true"></i> Play preview';
    L.forEach(function(l){if(l.type==='pip'&&l.el){try{if(on){var p=l.el.play();if(p&&p.catch)p.catch(function(){});}else l.el.pause();}catch(e){}}});
    if(!B.el)return;
    if(on){B.el.muted=true;if(B.el.currentTime<B.start||B.el.currentTime>=B.end)B.el.currentTime=B.start;var p=B.el.play();if(p&&p.catch)p.catch(function(){});if(!raf)raf=requestAnimationFrame(loop);}
    else B.el.pause();
  }

  /* ---------- layers ---------- */
  function get(id){for(var i=0;i<L.length;i++)if(L[i].id===id)return L[i];return null;}
  function nameOf(l){return l.type==='logo'?'Logo':l.type==='text'?'Text':l.type==='img'?'Photo':'Video';}
  function addLayer(o){
    var l=Object.assign({id:++idc,x:.5,y:.5,w:30,r:0,o:100,rd:0,key:false,kc:'#00ff00',kt:30},o);
    L.push(l);sel=l.id;renderLayers();syncCtl();draw();return l;
  }
  function renderLayers(){
    var h='';L.forEach(function(l,i){h+='<button type="button" class="vs-chip" data-id="'+l.id+'" aria-pressed="'+(l.id===sel)+'">'+nameOf(l)+' '+(i+1)+'</button>';});
    $('vs-layers').innerHTML=h;
  }
  function syncCtl(){
    var l=sel&&get(sel);$('vs-ctl').style.display=l?'':'none';if(!l)return;
    $('vs-w').value=l.w;$('vs-r').value=l.r;$('vs-o').value=l.o;$('vs-rd').value=l.rd;
    $('vs-rr').style.display=l.type==='text'?'none':'';
    $('vs-textctl').style.display=l.type==='text'?'':'none';
    if(l.type==='text'){$('vs-txt').value=l.t;$('vs-tc').value=l.c;$('vs-tb').value=l.bc;$('vs-tbon').checked=!!l.bg;}
    var kk=l.type==='img'||l.type==='pip';$('vs-keyctl').style.display=kk?'':'none';
    if(kk){$('vs-kon').checked=!!l.key;$('vs-kc').value=l.kc;$('vs-kt').value=l.kt;}
  }
  $('vs-layers').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;sel=+b.getAttribute('data-id');renderLayers();syncCtl();draw();});
  function bind(id,key,num){$(id).addEventListener('input',function(e){var l=sel&&get(sel);if(!l)return;var v=e.target.type==='checkbox'?e.target.checked:e.target.value;l[key]=num?+v:v;draw();});}
  bind('vs-w','w',1);bind('vs-r','r',1);bind('vs-o','o',1);bind('vs-rd','rd',1);bind('vs-txt','t');bind('vs-tc','c');bind('vs-tb','bc');bind('vs-tbon','bg');bind('vs-kon','key');bind('vs-kc','kc');bind('vs-kt','kt',1);
  $('vs-tbon').addEventListener('change',function(e){var l=sel&&get(sel);if(l){l.bg=e.target.checked;draw();}});
  $('vs-kon').addEventListener('change',function(e){var l=sel&&get(sel);if(l){l.key=e.target.checked;draw();}});
  $('vs-del').addEventListener('click',function(){var l=sel&&get(sel);if(!l)return;if(l.type==='pip'&&l.el){try{l.el.pause();URL.revokeObjectURL(l.url);}catch(e){}}L=L.filter(function(x){return x!==l;});sel=L.length?L[L.length-1].id:null;renderLayers();syncCtl();draw();});
  function move(d){var l=sel&&get(sel);if(!l)return;var i=L.indexOf(l),j=i+d;if(j<0||j>=L.length)return;L.splice(i,1);L.splice(j,0,l);renderLayers();draw();}
  $('vs-up').addEventListener('click',function(){move(1);});$('vs-dn').addEventListener('click',function(){move(-1);});
  $('vs-add-logo').addEventListener('click',function(){addLayer({type:'logo',col:false,w:22,x:.82,y:.08});});
  $('vs-add-text').addEventListener('click',function(){addLayer({type:'text',t:'YOUR TEXT',c:'#ffffff',bc:'#2065fe',bg:true,w:70,y:.85});});
  $('vs-add-img').addEventListener('click',function(e){if(e.target.tagName!=='INPUT')$('vs-fi').click();});
  $('vs-add-pip').addEventListener('click',function(e){if(e.target.tagName!=='INPUT')$('vs-fp').click();});
  $('vs-fi').addEventListener('change',function(e){var f=e.target.files[0];e.target.value='';if(!f)return;
    if(!/^image\//.test(f.type)){toast('Choose an image file.','error');return;}
    var u=URL.createObjectURL(f),im=new Image();im.onload=function(){addLayer({type:'img',el:im,w:40,y:.3});};im.onerror=function(){toast('That photo could not be opened.','error');};im.src=u;});
  $('vs-fp').addEventListener('change',function(e){var f=e.target.files[0];e.target.value='';if(!f)return;
    var u=URL.createObjectURL(f),v=document.createElement('video');v.muted=true;v.loop=true;v.playsInline=true;v.preload='auto';v.setAttribute('playsinline','');
    v.onloadeddata=function(){v.currentTime=0.05;addLayer({type:'pip',el:v,url:u,w:42,x:.72,y:.3,rd:12});if(playing){try{v.play();}catch(x){}}};
    v.onseeked=function(){draw();};
    v.onerror=function(){toast('That video could not be opened in the browser. Try an MP4.','error');};v.src=u;});

  /* ---------- moving things on the picture ---------- */
  function pos(e){var r=cv.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};}
  function hit(p){
    var W=cv.width,H=cv.height;
    for(var i=L.length-1;i>=0;i--){var l=L[i],b=box(l,W,H);if(!b)continue;
      var dx=p.x*W-b.cx,dy=p.y*H-b.cy,a=-l.r*Math.PI/180,rx=dx*Math.cos(a)-dy*Math.sin(a),ry=dx*Math.sin(a)+dy*Math.cos(a);
      if(Math.abs(rx)<=b.w/2&&Math.abs(ry)<=b.h/2)return l;}
    return null;
  }
  cv.addEventListener('pointerdown',function(e){var p=pos(e),l=hit(p);if(!l)return;sel=l.id;renderLayers();syncCtl();drag={id:l.id,dx:l.x-p.x,dy:l.y-p.y};try{cv.setPointerCapture(e.pointerId);}catch(x){}draw();e.preventDefault();});
  cv.addEventListener('pointermove',function(e){if(!drag)return;var l=get(drag.id),p=pos(e);if(!l)return;l.x=Math.max(0,Math.min(1,p.x+drag.dx));l.y=Math.max(0,Math.min(1,p.y+drag.dy));draw();});
  function endDrag(){drag=null;}cv.addEventListener('pointerup',endDrag);cv.addEventListener('pointercancel',endDrag);

  /* ---------- base video + settings ---------- */
  function labels(){
    $('vs-vn').textContent=B.file?B.file.name:'Choose a video';$('vs-pick').classList.toggle('has',!!B.file);
    $('vs-ts').disabled=$('vs-te').disabled=!B.el;
    $('vs-tl').textContent=B.el?'Start '+fmt(B.start)+'  ·  End '+fmt(B.end)+'  ·  Length '+(B.end-B.start).toFixed(1)+' s':'Add a video to trim it.';
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
      var ts=$('vs-ts'),te=$('vs-te');ts.max=te.max=v.duration.toFixed(1);ts.value=0;te.value=B.end.toFixed(1);labels();v.currentTime=0.05;
      if(v.videoWidth>v.videoHeight&&st.fmt==='9:16')toast('This video is wide. Try "Show all" or the Wide size.','success');
    };
    v.onseeked=function(){draw();};v.onloadeddata=function(){draw();};
    v.onerror=function(){URL.revokeObjectURL(url);toast('This video could not be opened in the browser. Try an MP4.','error');};v.src=url;
  }
  $('vs-fv').addEventListener('change',function(e){loadBase(e.target.files[0]);e.target.value='';});
  $('vs-fmt').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;st.fmt=b.getAttribute('data-v');setPressed('vs-fmt',st.fmt);sizeCv();draw();});
  $('vs-fit').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;st.fit=b.getAttribute('data-v');setPressed('vs-fit',st.fit);draw();});
  $('vs-snd').addEventListener('change',function(e){st.snd=e.target.checked;});
  function trim(which){var ts=$('vs-ts'),te=$('vs-te'),a=+ts.value,b=+te.value;
    if(which==='s'&&a>b-0.5){a=Math.max(0,b-0.5);ts.value=a;}if(which==='e'&&b<a+0.5){b=Math.min(B.dur,a+0.5);te.value=b;}
    B.start=a;B.end=b;labels();if(B.el){setPlaying(false);B.el.currentTime=which==='s'?a:Math.max(a,b-0.05);}}
  $('vs-ts').addEventListener('input',function(){trim('s');});$('vs-te').addEventListener('input',function(){trim('e');});
  $('vs-play').addEventListener('click',function(){setPlaying(!playing);});
  [['logo-white.png','wh'],['logo-brand.png','col']].forEach(function(a){var im=new Image();im.onload=function(){LOGO[a[1]]=im;draw();};im.src=a[0];});
  try{if(document.fonts&&document.fonts.load)document.fonts.load('800 40px Poppins').then(draw,draw);}catch(e){}
  draw();labels();

  /* ---------- making the video (every frame at its exact time) ---------- */
  function clearResult(){if(result&&result.url)URL.revokeObjectURL(result.url);result=null;var r=$('vs-res');r.style.display='none';r.innerHTML='';}
  async function make(){
    if(busy)return;
    if(!B.el){toast('Add a video first.','error');return;}
    if(!(window.VideoEncoder&&window.VideoFrame)){toast('This browser cannot create video. Please use Chrome, Edge or a recent Safari.','error');return;}
    var d=FMT[st.fmt],RW=d[0],RH=d[1],FPS=30,dur=B.end-B.start,n=Math.round(dur*FPS),i;
    var vbps=Math.max(250000,Math.min(6000000,Math.floor((44*1024*1024*8)/dur-(dur>600?100000:160000))));
    var vcfg={codec:'avc1.640032',width:RW,height:RH,bitrate:vbps,framerate:FPS,avc:{format:'avc'},latencyMode:'realtime'};
    try{var sup=await VideoEncoder.isConfigSupported(vcfg);if(!sup.supported){toast('This device cannot create this size of video. Try the Square size.','error');return;}}catch(e){toast('This device cannot create video.','error');return;}
    setPlaying(false);clearResult();busy=true;cancel=false;$('vs-make').disabled=true;
    var rv=document.createElement('video');
    var pips=L.filter(function(l){return l.type==='pip'&&l.el;});
    try{
      var vs=[],vdesc=null,aenc=null,asamples=[],adesc=null,acodec='',sr=48000,ch=2,pre=312;
      rv.src=B.url;rv.muted=true;rv.playsInline=true;rv.preload='auto';
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
      function prog(){showProg(true,Math.min(100,next/n*100),'Creating… '+(next/FPS).toFixed(1)+' / '+dur.toFixed(1)+' s · keep this tab open');}
      function scene(){drawScene(rctx,RW,RH,rv,false);}
      function playPhase(){
        return new Promise(function(resolve){
          var last=Date.now(),fin=false;
          function finish(r){if(fin)return;fin=true;clearInterval(wd);try{rv.pause();pips.forEach(function(l){l.el.pause();});}catch(e){}resolve(r);}
          var wd=setInterval(function(){if(Date.now()-last>3000)finish(false);},500);
          function cb(now,meta){
            last=Date.now();scene();
            var idx=Math.min(n-1,Math.max(0,Math.round((meta.mediaTime-B.start)*FPS)));
            while(next<=idx){encodeCanvas(next);next++;}
            prog();
            if(cancel||next>=n||meta.mediaTime>=B.end)finish(true);else rv.requestVideoFrameCallback(cb);
          }
          rv.onended=function(){while(next<n){encodeCanvas(next);next++;}finish(true);};
          pips.forEach(function(l){try{l.el.currentTime=0;l.el.play();}catch(e){}});
          seekTo(rv,B.start).then(function(){rv.playbackRate=1;var p=rv.play();if(p&&p.catch)p.catch(function(){finish(false);});rv.requestVideoFrameCallback(cb);});
        });
      }
      if('requestVideoFrameCallback' in HTMLVideoElement.prototype&&document.visibilityState==='visible'){
        await playPhase();
        while(venc.encodeQueueSize>0)await new Promise(function(r){setTimeout(r,10);});
      }
      for(;next<n&&!cancel;){
        var tt=next/FPS;
        await seekTo(rv,Math.min(B.start+tt,Math.max(0,B.dur-0.001)));
        for(var q=0;q<pips.length;q++){var pv=pips[q].el,pd=pv.duration||1;await seekTo(pv,Math.min(tt%pd,Math.max(0,pd-0.001)));}
        scene();encodeCanvas(next);next++;
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
      if(blob.size>100*1024*1024){toast('The video came out too big. Trim it shorter and try again.','error');return;}
      showResult(blob,poster);
    }catch(err){
      showProg(false);try{rv.pause();}catch(e){}
      toast('Could not create the video on this device. Try Chrome, a shorter clip or another file.','error');
    }finally{busy=false;$('vs-make').disabled=false;draw();}
  }
  $('vs-make').addEventListener('click',make);
  $('vs-stop').addEventListener('click',function(){cancel=true;});

  /* ---------- result: download + post to social media ---------- */
  function showResult(blob,poster){
    var name='buza-media-'+new Date().toISOString().slice(0,10)+'.mp4';
    result={blob:blob,url:URL.createObjectURL(blob),name:name,poster:poster};
    var r=$('vs-res');r.style.display='';
    r.innerHTML='<video controls playsinline src="'+result.url+'" style="width:100%;max-width:340px;display:block;margin:.5rem auto;border-radius:10px;background:#000"></video>'+
      '<div class="cb-note">Ready · '+(blob.size/1048576).toFixed(1)+' MB · MP4</div>'+
      '<label class="cb-note" style="display:block;margin-top:.4rem">Video from (optional, e.g. Wasafi Media)</label><input type="text" id="vs-credit" maxlength="80" placeholder="Wasafi Media">'+
      '<label class="cb-note" style="display:block;margin-top:.4rem">Caption</label><textarea id="vs-cap" rows="3" maxlength="1800" placeholder="Write the caption here"></textarea>'+
      '<div class="vs-row"><button type="button" class="btn btn-secondary" id="vs-dl"><i class="ti ti-download" aria-hidden="true"></i> Download video</button>'+
      '<button type="button" class="btn btn-primary" id="vs-post"><i class="ti ti-send" aria-hidden="true"></i> <span>Post to social media</span></button></div>'+
      '<div class="cb-note" id="vs-st"></div>';
    $('vs-dl').onclick=function(){var a=document.createElement('a');a.href=result.url;a.download=result.name;document.body.appendChild(a);a.click();a.remove();};
    $('vs-post').onclick=function(){post(this);};
    toast('Your video is ready.');
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
        if(r.status==='published')done.push(name(r.platform));
        else if(r.status==='processing')wait.push(r);
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
  window.__vs={st:st,B:function(){return B;},L:function(){return L;},make:make,addLayer:addLayer,result:function(){return result;}};
})();
