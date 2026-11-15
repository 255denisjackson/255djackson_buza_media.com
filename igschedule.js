/* Buza Media - Instagram & Facebook schedule (admin). Shows the video queue made by Video Studio's "Schedule". */
(function(){
  'use strict';
  var root=null,timer=null;
  function $(id){return document.getElementById(id);}
  function esc(t){return String(t==null?'':t).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function toast(m,t){if(typeof showToast==='function')showToast(m,t||'success');}
  var TZ='Africa/Dar_es_Salaam';
  function when(s){try{return new Date(s).toLocaleString('en-GB',{timeZone:TZ,weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}catch(e){return s;}}
  var LAB={queued:['Waiting','wait'],posting:['Posting…','wait'],processing:['Instagram processing','wait'],done:['Posted ✓','ok'],failed:['Failed','bad']};
  var CSS='#panel-igsched .ys-it{border:1px solid var(--border);border-radius:12px;padding:.7rem .9rem;margin-bottom:.6rem;background:var(--card)}'+
    '#panel-igsched .ys-st{display:inline-block;border-radius:999px;padding:.12rem .55rem;font-size:.7rem;font-weight:700;background:#eef2ff;color:#3730a3}#panel-igsched .ys-st.ok{background:#e3f8ea;color:#136c2e}#panel-igsched .ys-st.bad{background:#fde8ea;color:#a4111f}#panel-igsched .ys-st.wait{background:#fff4d6;color:#8a5a00}'+
    '#panel-igsched .ys-n{font-size:.78rem;color:var(--muted);line-height:1.45}';
  // Post a queued video right now (does not wait for its scheduled time). Instagram's final publish step is finished by the 5-minute job.
  async function postNow(it){
    try{
      var c=await sb.from('video_queue').update({status:'posting'}).eq('id',it.id).eq('status','queued').select('id');
      if(c.error||!c.data||!c.data.length)return {ok:false,msg:'This video is already being posted.'};
      var cap=String(it.caption||'').trim(),res,fail=function(m){return sb.from('video_queue').update({status:'failed',results:[{platform:'facebook',status:'failed',error:m}]}).eq('id',it.id);};
      var sr=await sb.functions.invoke('social-post-video',{body:{action:'start',path:it.path,caption:cap}});
      if(sr.error||!sr.data||sr.data.error){await fail('Post now failed. Press Retry.');return {ok:false,msg:'Could not post now. Press Retry.'};}
      res=sr.data.results||[];var proc=res.filter(function(r){return r.status==='processing';})[0],clean=res.filter(function(r){return r.status!=='processing';}).map(function(r){return {platform:r.platform,status:r.status,id:r.id,error:r.error};});
      var anyOk=res.some(function(r){return r.status==='published'||r.status==='processing';});
      var upd=proc?{status:'processing',container:proc.container,ig_account:proc.account,results:clean,scheduled_at:new Date().toISOString()}:{status:anyOk?'done':'failed',results:clean};
      await sb.from('video_queue').update(upd).eq('id',it.id);
      return {ok:anyOk,msg:anyOk?(proc?'Posted to Facebook. Instagram is processing and will publish in a few minutes.':'Posted ✓'):'Could not post. Check the error and press Retry.'};
    }catch(e){try{await sb.from('video_queue').update({status:'queued'}).eq('id',it.id).eq('status','posting');}catch(x){}return {ok:false,msg:'Could not post now. Check your internet.'};}
  }

  // Mix the waiting videos: keep every time slot exactly as it is, but alternate between different videos (parts of one video stay in order).
  function mixOrder(items,keyOf){
    var groups={},order=[];
    items.forEach(function(x){var k=keyOf(x);if(!groups[k]){groups[k]=[];order.push(k);}groups[k].push(x);});
    var out=[],keys=order.slice(),last=null;
    while(keys.length){
      var pool=keys.filter(function(k){return k!==last;});if(!pool.length)pool=keys;
      var k=pool[Math.floor(Math.random()*pool.length)];
      out.push(groups[k].shift());last=k;
      if(!groups[k].length)keys.splice(keys.indexOf(k),1);
    }
    return out;
  }
  async function shuffleQueue(rows,btn){
    var q=rows.filter(function(x){return x.status==='queued';}).sort(function(a,b){return new Date(a.scheduled_at)-new Date(b.scheduled_at);});
    if(q.length<2){toast('Need at least 2 waiting videos to shuffle.','error');return;}
    btn.disabled=true;btn.textContent='Shuffling…';
    var slots=q.map(function(x){return x.scheduled_at;}),mixed=mixOrder(q,function(x){return String(x.caption||'').split(/ · Part |\nPART /i)[0].trim().slice(0,60)||x.id;});
    var bad=0;
    for(var i=0;i<mixed.length;i++){if(mixed[i].scheduled_at===slots[i])continue;var u=await sb.from('video_queue').update({scheduled_at:slots[i]}).eq('id',mixed[i].id).eq('status','queued');if(u.error)bad++;}
    toast(bad?'Some videos could not be moved.':'Shuffled. Times stay the same, the videos are mixed.',bad?'error':'success');load();
  }
  async function load(){
    if(!root)return;
    var r=await sb.from('video_queue').select('id,path,caption,scheduled_at,status,results').order('scheduled_at',{ascending:true}).limit(120);
    if(r.error){root.innerHTML='<div class="ys-n">Log in as admin to see the schedule.</div>';return;}
    var rows=r.data||[];
    var up=rows.filter(function(x){return x.status==='queued'||x.status==='posting'||x.status==='processing';}),past=rows.filter(function(x){return x.status==='done'||x.status==='failed';}).reverse();
    function item(x){var l=LAB[x.status]||[x.status,''];
      var err=x.status==='failed'?(x.results||[]).filter(function(y){return y.status==='failed';}).map(function(y){var e=String(y.error||'');return y.platform+': '+(/access token|OAuthException|"code":190|code\\":190/i.test(e)?'Facebook has logged the connection out (token expired). Needs to be reconnected, then press Retry.':e.slice(0,100));}).join(' · '):'';
      return '<div class="ys-it"><span class="ys-st '+l[1]+'">'+l[0]+'</span> <span class="ys-n">'+when(x.scheduled_at)+'</span><div style="margin:.3rem 0;font-size:.85rem;white-space:pre-line">'+esc(String(x.caption||'(no caption)').slice(0,140))+'</div>'+
      (err?'<div class="ys-n" style="color:#a4111f">'+esc(err)+'</div>':'')+
      (x.path&&x.status!=='done'?'<button class="btn btn-secondary" data-pv="'+esc(x.path)+'" style="margin-top:.3rem">▶ Preview</button> ':'')+
      (x.status==='queued'&&x.path?'<button class="btn" data-pn="'+x.id+'" style="margin-top:.3rem">🚀 Post now</button> ':'')+(x.status==='failed'&&x.path?'<button class="btn btn-secondary" data-rt="'+x.id+'" style="margin-top:.3rem">↻ Retry</button> ':'')+(x.status==='queued'||x.status==='failed'?'<button class="btn btn-secondary" data-yd="'+x.id+'" style="margin-top:.3rem">'+(x.status==='queued'?'Cancel':'Remove')+'</button>':'')+'</div>';}
    root.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem"><b style="font-size:.9rem">Coming up ('+up.length+')</b>'+(up.filter(function(x){return x.status==="queued";}).length>1?'<button class="btn btn-secondary" id="ig-shuf">🔀 Shuffle</button>':'')+'</div><div style="margin:.5rem 0 1rem">'+(up.length?up.map(item).join(''):'<div class="ys-n">Nothing scheduled. Make a video in Video Studio and press “Schedule”.</div>')+'</div>'+
      '<b style="font-size:.9rem">Done and failed</b><div style="margin-top:.5rem">'+(past.length?past.slice(0,30).map(item).join(''):'<div class="ys-n">Nothing yet.</div>')+'</div>';
    var sb2=$('ig-shuf');if(sb2)sb2.onclick=function(){shuffleQueue(rows,this);};
    root.onclick=async function(e){var pn=e.target.closest('button[data-pn]');
      if(pn){var it0=rows.filter(function(x){return String(x.id)===pn.getAttribute('data-pn');})[0];pn.disabled=true;pn.textContent='Posting…';
        var rr=await postNow(it0);toast(rr.msg,rr.ok?'success':'error');load();return;}
      var pv=e.target.closest('button[data-pv]');
      if(pv){var old=pv.parentNode.querySelector('video');if(old){old.pause();old.remove();pv.textContent='▶ Preview';return;}
        var vv=document.createElement('video');vv.src=sb.storage.from('social-videos').getPublicUrl(pv.getAttribute('data-pv')).data.publicUrl;vv.controls=true;vv.playsInline=true;vv.setAttribute('playsinline','');vv.style.cssText='display:block;width:100%;max-height:60vh;border-radius:12px;margin-top:.4rem;background:#000';
        pv.parentNode.appendChild(vv);pv.textContent='✕ Close preview';vv.play().catch(function(){});return;}
      var rt=e.target.closest('button[data-rt]');
      if(rt){rt.disabled=true;var q=await sb.from('video_queue').update({status:'queued',scheduled_at:new Date().toISOString(),results:[],container:null}).eq('id',rt.getAttribute('data-rt')).eq('status','failed');
        if(q.error)toast('Could not retry.','error');else toast('Will try again within 5 minutes.','success');load();return;}
      var b=e.target.closest('button[data-yd]');if(!b)return;if(!confirm('Remove this video from the schedule?'))return;
      var id=b.getAttribute('data-yd'),it=rows.filter(function(x){return String(x.id)===id;})[0];
      var d=await sb.from('video_queue').delete().eq('id',id).in('status',['queued','failed']);
      if(d.error)toast('Could not remove.','error');else{if(it&&it.status==='queued'&&it.path)try{await sb.storage.from('social-videos').remove([it.path]);}catch(x){}load();}};
  }
  window.IGSched={postNow:postNow,show:function(){
    var p=$('panel-igsched');if(!p)return;
    if(!root){var st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);
      p.innerHTML='<div class="admin-section"><div class="admin-section-title"><i class="ti ti-brand-instagram" aria-hidden="true"></i> Instagram &amp; Facebook schedule</div><div class="admin-section-sub">Videos you schedule from Video Studio. They post to Facebook and Instagram by themselves at the time shown (Tanzania time). Tap Preview to watch a video before it posts.</div><div id="ig-body"></div></div>';
      root=$('ig-body');}
    root.innerHTML='<div class="ys-n">Loading…</div>';load();
    if(timer)clearInterval(timer);timer=setInterval(function(){var pn=$('panel-igsched');if(pn&&!pn.classList.contains('hidden')){if(!pn.querySelector('video'))load();}else{clearInterval(timer);timer=null;}},60000);
  }};
})();
