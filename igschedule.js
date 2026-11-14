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
      (x.status==='failed'&&x.path?'<button class="btn btn-secondary" data-rt="'+x.id+'" style="margin-top:.3rem">↻ Retry</button> ':'')+(x.status==='queued'||x.status==='failed'?'<button class="btn btn-secondary" data-yd="'+x.id+'" style="margin-top:.3rem">'+(x.status==='queued'?'Cancel':'Remove')+'</button>':'')+'</div>';}
    root.innerHTML='<b style="font-size:.9rem">Coming up ('+up.length+')</b><div style="margin:.5rem 0 1rem">'+(up.length?up.map(item).join(''):'<div class="ys-n">Nothing scheduled. Make a video in Video Studio and press “Schedule”.</div>')+'</div>'+
      '<b style="font-size:.9rem">Done and failed</b><div style="margin-top:.5rem">'+(past.length?past.slice(0,30).map(item).join(''):'<div class="ys-n">Nothing yet.</div>')+'</div>';
    root.onclick=async function(e){var pv=e.target.closest('button[data-pv]');
      if(pv){var old=pv.parentNode.querySelector('video');if(old){old.pause();old.remove();pv.textContent='▶ Preview';return;}
        var vv=document.createElement('video');vv.src=sb.storage.from('social-videos').getPublicUrl(pv.getAttribute('data-pv')).data.publicUrl;vv.controls=true;vv.playsInline=true;vv.setAttribute('playsinline','');vv.style.cssText='display:block;width:100%;max-height:60vh;border-radius:12px;margin-top:.4rem;background:#000';
        pv.parentNode.appendChild(vv);pv.textContent='✕ Close preview';vv.play().catch(function(){});return;}
      var rt=e.target.closest('button[data-rt]');
      if(rt){rt.disabled=true;var q=await sb.from('video_queue').update({status:'queued',scheduled_at:new Date().toISOString(),results:null,container:null}).eq('id',rt.getAttribute('data-rt')).eq('status','failed');
        if(q.error)toast('Could not retry.','error');else toast('Will try again within 5 minutes.','success');load();return;}
      var b=e.target.closest('button[data-yd]');if(!b)return;if(!confirm('Remove this video from the schedule?'))return;
      var id=b.getAttribute('data-yd'),it=rows.filter(function(x){return String(x.id)===id;})[0];
      var d=await sb.from('video_queue').delete().eq('id',id).in('status',['queued','failed']);
      if(d.error)toast('Could not remove.','error');else{if(it&&it.status==='queued'&&it.path)try{await sb.storage.from('social-videos').remove([it.path]);}catch(x){}load();}};
  }
  window.IGSched={show:function(){
    var p=$('panel-igsched');if(!p)return;
    if(!root){var st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);
      p.innerHTML='<div class="admin-section"><div class="admin-section-title"><i class="ti ti-brand-instagram" aria-hidden="true"></i> Instagram &amp; Facebook schedule</div><div class="admin-section-sub">Videos you schedule from Video Studio. They post to Facebook and Instagram by themselves at the time shown (Tanzania time). Tap Preview to watch a video before it posts.</div><div id="ig-body"></div></div>';
      root=$('ig-body');}
    root.innerHTML='<div class="ys-n">Loading…</div>';load();
    if(timer)clearInterval(timer);timer=setInterval(function(){var pn=$('panel-igsched');if(pn&&!pn.classList.contains('hidden')){if(!pn.querySelector('video'))load();}else{clearInterval(timer);timer=null;}},60000);
  }};
})();
