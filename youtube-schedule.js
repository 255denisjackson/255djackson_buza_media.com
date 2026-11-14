/* Buza Media - YouTube schedule (admin). Shows the upload queue made by Video Studio's "Schedule for YouTube".
   Max 5 videos a day (12:00, 14:00, 16:00, 18:00, 20:00 Tanzania time); a full day moves to the next day. */
(function(){
  'use strict';
  var root=null,timer=null;
  function $(id){return document.getElementById(id);}
  function esc(t){return String(t==null?'':t).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function toast(m,t){if(typeof showToast==='function')showToast(m,t||'success');}
  var TZ='Africa/Dar_es_Salaam';
  function when(s){try{return new Date(s).toLocaleString('en-GB',{timeZone:TZ,weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}catch(e){return s;}}
  function dayKey(s){return new Date(s).toLocaleDateString('en-CA',{timeZone:TZ});}
  var LAB={queued:['Waiting','wait'],uploading:['Uploading…','wait'],done:['Posted ✓','ok'],failed:['Failed','bad']};
  var CSS='#panel-ytsched .ys-days{display:flex;gap:.5rem;overflow-x:auto;padding-bottom:.4rem;margin-bottom:1rem}#panel-ytsched .ys-day{flex:0 0 auto;min-width:92px;border:1px solid var(--border);border-radius:12px;padding:.55rem .7rem;background:var(--card);text-align:center}'+
  '#panel-ytsched .ys-day b{display:block;font-size:1.1rem}#panel-ytsched .ys-day.full{border-color:#e63946}#panel-ytsched .ys-day small{color:var(--muted)}'+
  '#panel-ytsched .ys-it{border:1px solid var(--border);border-radius:12px;padding:.7rem .9rem;margin-bottom:.6rem;background:var(--card)}'+
  '#panel-ytsched .ys-st{display:inline-block;border-radius:999px;padding:.12rem .55rem;font-size:.7rem;font-weight:700;background:#eef2ff;color:#3730a3}#panel-ytsched .ys-st.ok{background:#e3f8ea;color:#136c2e}#panel-ytsched .ys-st.bad{background:#fde8ea;color:#a4111f}#panel-ytsched .ys-st.wait{background:#fff4d6;color:#8a5a00}'+
  '#panel-ytsched .ys-n{font-size:.78rem;color:var(--muted);line-height:1.45}';
  async function load(){
    if(!root)return;
    var r=await sb.from('yt_queue').select('*').order('scheduled_at',{ascending:true}).limit(120);
    if(r.error){root.innerHTML='<div class="ys-n">Log in as admin to see the schedule.</div>';return;}
    var rows=r.data||[],cnt={};
    rows.forEach(function(x){if(x.status!=='failed'){var k=dayKey(x.scheduled_at);cnt[k]=(cnt[k]||0)+1;}});
    var days='';for(var i=0;i<7;i++){var d=new Date(Date.now()+i*86400000),k=dayKey(d),n=cnt[k]||0;days+='<div class="ys-day'+(n>=5?' full':'')+'"><small>'+d.toLocaleDateString('en-GB',{timeZone:TZ,weekday:'short',day:'numeric',month:'short'})+'</small><b>'+n+'/5</b></div>';}
    var up=rows.filter(function(x){return x.status==='queued'||x.status==='uploading';}),past=rows.filter(function(x){return x.status==='done'||x.status==='failed';}).reverse();
    function item(x){var l=LAB[x.status]||[x.status,''];return '<div class="ys-it"><span class="ys-st '+l[1]+'">'+l[0]+'</span> <span class="ys-n">'+when(x.posted_at||x.scheduled_at)+'</span><div style="margin:.3rem 0;font-weight:600;font-size:.88rem">'+esc(x.title)+'</div>'+
      (x.video_id?'<a href="https://youtube.com/shorts/'+esc(x.video_id)+'" target="_blank" rel="noopener">Open on YouTube</a>':'')+(x.error?'<div class="ys-n" style="color:#a4111f">'+esc(x.error)+'</div>':'')+
      (x.status==='queued'&&x.path?' <button class="btn btn-secondary" data-pv="'+esc(x.path)+'" style="margin-top:.3rem">▶ Preview</button>':'')+(x.status==='queued'||x.status==='failed'?' <button class="btn btn-secondary" data-yd="'+x.id+'" style="margin-top:.3rem">'+(x.status==='queued'?'Cancel':'Remove')+'</button>':'')+'</div>';}
    root.innerHTML='<div class="ys-n" style="margin-bottom:.4rem">Next 7 days (max 5 videos a day):</div><div class="ys-days">'+days+'</div>'+
      '<b style="font-size:.9rem">Coming up</b><div style="margin:.5rem 0 1rem">'+(up.length?up.map(item).join(''):'<div class="ys-n">Nothing scheduled. Make a video in Video Studio and press “Schedule for YouTube”.</div>')+'</div>'+
      '<b style="font-size:.9rem">Done and failed</b><div style="margin-top:.5rem">'+(past.length?past.slice(0,30).map(item).join(''):'<div class="ys-n">Nothing yet.</div>')+'</div>';
    root.onclick=async function(e){var pv=e.target.closest('button[data-pv]');
      if(pv){var old=pv.parentNode.querySelector('video');if(old){old.pause();old.remove();pv.textContent='▶ Preview';return;}
        var vv=document.createElement('video');vv.src=sb.storage.from('social-videos').getPublicUrl(pv.getAttribute('data-pv')).data.publicUrl;vv.controls=true;vv.playsInline=true;vv.setAttribute('playsinline','');vv.style.cssText='width:100%;max-height:60vh;border-radius:12px;margin-top:.4rem;background:#000';
        pv.parentNode.appendChild(vv);pv.textContent='✕ Close preview';vv.play().catch(function(){});return;}
      var b=e.target.closest('button[data-yd]');if(!b)return;if(!confirm('Remove this video from the schedule?'))return;
      var id=b.getAttribute('data-yd'),it=rows.filter(function(x){return String(x.id)===id;})[0];
      var d=await sb.from('yt_queue').delete().eq('id',id).in('status',['queued','failed']);
      if(d.error)toast('Could not remove.','error');else{if(it&&it.status==='queued')try{await sb.storage.from('social-videos').remove([it.path]);}catch(x){}load();}};
  }
  window.YTSched={show:function(){
    var p=$('panel-ytsched');if(!p)return;
    if(!root){var st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);
      p.innerHTML='<div class="admin-section"><div class="admin-section-title"><i class="ti ti-brand-youtube" aria-hidden="true"></i> YouTube schedule</div><div class="admin-section-sub">Videos you schedule from Video Studio upload to YouTube by themselves, 5 a day (12:00, 14:00, 16:00, 18:00, 20:00). When a day is full the next video goes to the next day. These 5 uploads also use the same daily YouTube allowance as the automatic news videos, so on a full day the automatic ones pause.</div><div id="ys-body"></div></div>';
      root=$('ys-body');}
    root.innerHTML='<div class="ys-n">Loading…</div>';load();
    if(timer)clearInterval(timer);timer=setInterval(function(){var pn=$('panel-ytsched');if(pn&&!pn.classList.contains('hidden')){if(!pn.querySelector('video'))load();}else{clearInterval(timer);timer=null;}},60000);
  }};
})();
