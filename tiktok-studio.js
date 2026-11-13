/* Buza Media - TikTok module (admin only).
   Discovery (official TikTok oEmbed) -> Creators -> Selected -> Import (authorised files only) -> Library (private storage)
   -> Edit & brand (Video Studio) -> Approval queue -> TikTok Content Posting API -> History.
   All secrets stay on the server (tiktok-api edge function). Nothing here downloads media from TikTok. */
(function(){
  'use strict';
  var TABS=[['discovery','Discovery','ti-search'],['creators','Creators','ti-users'],['selected','Selected','ti-bookmark'],['import','Import','ti-upload'],['library','Library','ti-photo-video'],['queue','Queue','ti-clock'],['history','History','ti-history'],['settings','Settings','ti-settings']];
  var tab='discovery',root=null,state={found:null,posts:[],media:[],creators:[],status:null},poll=null;
  var RIGHTS=[['permission','The creator gave me permission (message, email or written)'],['own','The content belongs to Buza Media'],['licence','Licensed through a partner or agreement (e.g. Wasafi Media)']];
  function $(id){return document.getElementById(id);}
  function esc(t){return String(t==null?'':t).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function toast(m,t){if(typeof showToast==='function')showToast(m,t||'success');}
  function ls(k,v){try{if(v===undefined)return JSON.parse(localStorage.getItem(k)||'null');localStorage.setItem(k,JSON.stringify(v));}catch(e){return null;}}
  function fmtD(s){try{return new Date(s).toLocaleString('en-GB',{timeZone:'Africa/Dar_es_Salaam',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}catch(e){return s||'';}}
  async function call(action,body){
    var r=await sb.functions.invoke('tiktok-api',{body:Object.assign({action:action},body||{})});
    if(r.error){var m='Request failed.';try{var j=await r.error.context.json();if(j&&j.error)m=j.error;}catch(e){}throw new Error(m);}
    if(r.data&&r.data.error)throw new Error(r.data.error);
    return r.data;
  }
  function selected(){return ls('tt_selected')||[];}

  var CSS='#panel-tiktok .tt-tabs{display:flex;gap:.35rem;overflow-x:auto;padding-bottom:.6rem;margin-bottom:.8rem;scrollbar-width:none}#panel-tiktok .tt-tabs::-webkit-scrollbar{display:none}'+
  '#panel-tiktok .tt-tab{flex:0 0 auto;border:1px solid var(--border);background:var(--card);color:var(--text);border-radius:999px;padding:.45rem .85rem;font:600 .8rem inherit;font-family:inherit;cursor:pointer;display:flex;gap:.35rem;align-items:center}'+
  '#panel-tiktok .tt-tab.on{background:var(--primary);color:#fff;border-color:var(--primary)}'+
  '#panel-tiktok .tt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.8rem}'+
  '#panel-tiktok .tt-card{background:var(--card);border:.5px solid var(--border);border-radius:12px;padding:.8rem;display:flex;flex-direction:column;gap:.45rem;min-width:0}'+
  '#panel-tiktok .tt-card img,#panel-tiktok .tt-card video{width:100%;border-radius:8px;background:#000;max-height:260px;object-fit:cover}'+
  '#panel-tiktok .tt-row{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}'+
  '#panel-tiktok input[type=text],#panel-tiktok input[type=password],#panel-tiktok textarea,#panel-tiktok select{width:100%;padding:.55rem .7rem;border:1px solid var(--border);border-radius:8px;font:inherit;background:var(--card);color:var(--text)}'+
  '#panel-tiktok label.tt-l{display:block;font-size:.76rem;color:var(--muted);margin:.5rem 0 .2rem}'+
  '#panel-tiktok .tt-st{display:inline-block;border-radius:999px;padding:.12rem .55rem;font-size:.7rem;font-weight:700;background:#eef2ff;color:#3730a3}'+
  '#panel-tiktok .tt-st.ok{background:#e3f8ea;color:#136c2e}#panel-tiktok .tt-st.bad{background:#fde8ea;color:#a4111f}#panel-tiktok .tt-st.wait{background:#fff4d6;color:#8a5a00}'+
  '#panel-tiktok .tt-note{font-size:.78rem;color:var(--muted);line-height:1.45}'+
  '#panel-tiktok .tt-tags{display:flex;gap:.3rem;flex-wrap:wrap}#panel-tiktok .tt-tags button{border:1px solid var(--border);background:var(--tag-bg);color:var(--tag-color);border-radius:999px;padding:.15rem .6rem;font-size:.72rem;cursor:pointer}'+
  '#panel-tiktok .tt-box{border:1px solid var(--border);border-radius:12px;padding:.8rem 1rem;margin-bottom:.8rem;background:var(--card)}'+
  '#panel-tiktok .tt-steps{display:flex;gap:.35rem;flex-wrap:wrap;font-size:.72rem;color:var(--muted);margin-bottom:.8rem}#panel-tiktok .tt-steps b{color:var(--accent)}';

  function mount(){
    var p=$('panel-tiktok');if(!p||root)return;
    var st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);
    p.innerHTML='<div class="admin-section"><div class="admin-section-title"><i class="ti ti-brand-tiktok" aria-hidden="true"></i> TikTok</div>'+
      '<div class="admin-section-sub">Find content, keep a record of who allowed you to use it, brand it in Video Studio, get approval, then publish to your TikTok account.</div>'+
      '<div class="tt-steps"><b>Discovery</b> → Creator → Selected → Import (with permission) → Edit &amp; brand → Approve → Publish → History</div>'+
      '<div class="tt-tabs" id="tt-tabs"></div><div id="tt-body"></div></div>';
    root=$('tt-body');
    $('tt-tabs').innerHTML=TABS.map(function(t){return '<button class="tt-tab" data-t="'+t[0]+'"><i class="ti '+t[2]+'" aria-hidden="true"></i> '+t[1]+'</button>';}).join('');
    $('tt-tabs').onclick=function(e){var b=e.target.closest('button[data-t]');if(b)go(b.getAttribute('data-t'));};
  }
  function go(t){
    tab=t;if(poll){clearInterval(poll);poll=null;}
    var bs=document.querySelectorAll('#tt-tabs .tt-tab');for(var i=0;i<bs.length;i++)bs[i].classList.toggle('on',bs[i].getAttribute('data-t')===t);
    root.innerHTML='<div class="tt-note">Loading…</div>';
    ({discovery:vDiscovery,creators:vCreators,selected:vSelected,import:vImport,library:vLibrary,queue:vQueue,history:vHistory,settings:vSettings})[t]();
  }

  /* ---------------- Discovery ---------------- */
  function vDiscovery(){
    root.innerHTML='<div class="tt-box"><label class="tt-l" style="margin-top:0">TikTok video link or @username</label><div class="tt-row"><input type="text" id="tt-q" placeholder="https://www.tiktok.com/@name/video/123… or @name" style="flex:1;min-width:200px"><button class="btn btn-primary" id="tt-go"><i class="ti ti-search" aria-hidden="true"></i> Look up</button></div>'+
      '<div class="tt-note" style="margin-top:.5rem">Keyword and hashtag search open TikTok itself in a new tab (TikTok does not give websites a public search of other people’s videos). Copy the link of a video you like and paste it above.</div>'+
      '<div class="tt-row" style="margin-top:.5rem"><input type="text" id="tt-kw" placeholder="keyword or #hashtag" style="flex:1;min-width:160px"><button class="btn btn-secondary" id="tt-kwgo">Search on TikTok</button></div></div><div id="tt-res"></div>';
    $('tt-go').onclick=lookup;$('tt-q').onkeydown=function(e){if(e.key==='Enter')lookup();};
    $('tt-kwgo').onclick=function(){var k=$('tt-kw').value.trim();if(!k)return;window.open('https://www.tiktok.com/search?q='+encodeURIComponent(k),'_blank','noopener');};
    if(state.found)showFound();
  }
  async function lookup(){
    var q=$('tt-q').value.trim();if(!q)return;var out=$('tt-res');
    var m=q.match(/^@?([A-Za-z0-9._]{2,40})$/)||q.match(/tiktok\.com\/@([A-Za-z0-9._]+)\/?(?:\?.*)?$/i);
    if(m){var u=m[1];state.found={type:'creator',username:u,url:'https://www.tiktok.com/@'+u};showFound();return;}
    out.innerHTML='<div class="tt-note">Looking up…</div>';
    try{var j=await call('oembed',{url:q});state.found={type:'video',url:q,title:j.title,author:j.author_name,author_url:j.author_url,thumb:j.thumbnail_url};showFound();}
    catch(e){out.innerHTML='<div class="tt-box" style="color:#a4111f">'+esc(e.message)+'</div>';}
  }
  function showFound(){
    var f=state.found,out=$('tt-res');if(!f||!out)return;
    if(f.type==='creator'){
      out.innerHTML='<div class="tt-card" style="max-width:360px"><b>@'+esc(f.username)+'</b><div class="tt-note">TikTok profile. Open it, then copy the link of a video you want to use.</div><div class="tt-row"><a class="btn btn-secondary" href="'+esc(f.url)+'" target="_blank" rel="noopener">Open on TikTok</a><button class="btn btn-primary" id="tt-addc">Add to creators</button></div></div>';
      $('tt-addc').onclick=function(){addCreator(f.username,'');};return;
    }
    out.innerHTML='<div class="tt-card" style="max-width:360px">'+(f.thumb?'<img src="'+esc(f.thumb)+'" alt="" referrerpolicy="no-referrer">':'')+'<b>'+esc(f.author||'')+'</b><div class="tt-note">'+esc(f.title||'')+'</div>'+
      '<div class="tt-row"><a class="btn btn-secondary" href="'+esc(f.url)+'" target="_blank" rel="noopener">Open on TikTok</a><button class="btn btn-primary" id="tt-sel">Select</button></div>'+
      '<div class="tt-row"><button class="btn btn-secondary" id="tt-addc2">Add creator</button></div></div>';
    $('tt-sel').onclick=function(){var s=selected();if(!s.some(function(x){return x.url===f.url;}))s.unshift({url:f.url,author:f.author||'',title:f.title||'',thumb:f.thumb||''});ls('tt_selected',s);toast('Added to Selected.');};
    $('tt-addc2').onclick=function(){var uname=String((f.author_url||'').split('@')[1]||f.author||'').replace(/[^A-Za-z0-9._]/g,'');if(uname)addCreator(uname,f.author||'');};
  }
  async function addCreator(username,name){
    var r=await sb.from('tiktok_creators').upsert({username:username,display_name:name||null,profile_url:'https://www.tiktok.com/@'+username},{onConflict:'username'});
    toast(r.error?'Could not save the creator.':'Creator saved.',r.error?'error':'success');
  }

  /* ---------------- Creators ---------------- */
  async function vCreators(){
    var r=await sb.from('tiktok_creators').select('*').order('created_at',{ascending:false});
    var rows=r.data||[];
    root.innerHTML='<div class="tt-box"><div class="tt-row"><input type="text" id="tt-cu" placeholder="@username" style="flex:1;min-width:150px"><input type="text" id="tt-cn" placeholder="Note (e.g. agreed by DM)" style="flex:1;min-width:150px"><button class="btn btn-primary" id="tt-cadd">Add</button></div></div>'+
      (rows.length?'<div class="tt-grid">'+rows.map(function(c){return '<div class="tt-card"><b>@'+esc(c.username)+'</b><div class="tt-note">'+esc(c.note||c.display_name||'')+'</div><div class="tt-row"><a class="btn btn-secondary" href="'+esc(c.profile_url||'#')+'" target="_blank" rel="noopener">Open</a><button class="btn btn-secondary" data-del="'+c.id+'">Remove</button></div></div>';}).join('')+'</div>':'<div class="tt-note">No creators saved yet.</div>');
    $('tt-cadd').onclick=async function(){var u=$('tt-cu').value.trim().replace(/^@/,'').replace(/[^A-Za-z0-9._]/g,'');if(!u)return;var x=await sb.from('tiktok_creators').upsert({username:u,note:$('tt-cn').value.trim()||null,profile_url:'https://www.tiktok.com/@'+u},{onConflict:'username'});if(x.error)toast('Could not save.','error');vCreators();};
    root.onclick=async function(e){var b=e.target.closest('button[data-del]');if(!b)return;await sb.from('tiktok_creators').delete().eq('id',b.getAttribute('data-del'));vCreators();};
  }

  /* ---------------- Selected ---------------- */
  function vSelected(){
    var s=selected();
    root.innerHTML=s.length?'<div class="tt-grid">'+s.map(function(x,i){return '<div class="tt-card">'+(x.thumb?'<img src="'+esc(x.thumb)+'" alt="" referrerpolicy="no-referrer">':'')+'<b>'+esc(x.author)+'</b><div class="tt-note">'+esc(x.title)+'</div><div class="tt-row"><a class="btn btn-secondary" href="'+esc(x.url)+'" target="_blank" rel="noopener">Open</a><button class="btn btn-primary" data-imp="'+i+'">Import file…</button><button class="btn btn-secondary" data-rm="'+i+'">Remove</button></div></div>';}).join('')+'</div>'+
      '<div class="tt-note" style="margin-top:.7rem">To import, get the video file from the creator (or from the owner of the rights), then press Import file.</div>':'<div class="tt-note">Nothing selected yet. Use Discovery to select videos.</div>';
    root.onclick=function(e){var b=e.target.closest('button');if(!b)return;
      if(b.hasAttribute('data-rm')){var a=selected();a.splice(+b.getAttribute('data-rm'),1);ls('tt_selected',a);vSelected();}
      if(b.hasAttribute('data-imp')){state.prefill=selected()[+b.getAttribute('data-imp')];go('import');}};
  }

  /* ---------------- Import (download manager) ---------------- */
  function vImport(){
    var pf=state.prefill||{};state.prefill=null;
    var cu=String((pf.url||'').match(/@([A-Za-z0-9._]+)/)?RegExp.$1:(pf.author||'')).replace(/^@/,'');
    root.innerHTML='<div class="tt-box"><div class="tt-note"><b>Authorised files only.</b> Buza Media does not download videos from TikTok for you. Upload a file that the creator sent you, that you own, or that you are licensed to use. Every import records who gave permission, who imported it and when. Creator watermarks must stay on the video.</div>'+
      '<label class="tt-l">Video or photo file (MP4, MOV, JPG, PNG, WEBP · max 250 MB)</label><input type="file" id="ti-f" accept="video/mp4,video/quicktime,image/jpeg,image/png,image/webp">'+
      '<label class="tt-l">Original TikTok link</label><input type="text" id="ti-u" value="'+esc(pf.url||'')+'" placeholder="https://www.tiktok.com/@…">'+
      '<label class="tt-l">Creator username</label><input type="text" id="ti-c" value="'+esc(cu)+'" placeholder="@username">'+
      '<label class="tt-l">Original caption</label><textarea id="ti-cap" rows="2">'+esc(pf.title||'')+'</textarea>'+
      '<label class="tt-l">Why can you use it?</label><select id="ti-r">'+RIGHTS.map(function(r){return '<option value="'+r[0]+'">'+esc(r[1])+'</option>';}).join('')+'</select>'+
      '<label class="tt-l">Permission note (who allowed it, when, where)</label><input type="text" id="ti-n" placeholder="e.g. DM from the creator on 13 Nov">'+
      '<label style="display:flex;gap:.5rem;align-items:flex-start;margin:.7rem 0;font-size:.82rem"><input type="checkbox" id="ti-ok" style="margin-top:.2rem"> <span>I confirm I have permission to use and publish this content, and I will credit the creator.</span></label>'+
      '<div class="tt-row"><button class="btn btn-primary" id="ti-go"><i class="ti ti-upload" aria-hidden="true"></i> Import</button><span class="tt-note" id="ti-st"></span></div></div>';
    $('ti-go').onclick=doImport;
  }
  async function doImport(){
    var f=$('ti-f').files[0],st=$('ti-st'),btn=$('ti-go');
    if(!f){toast('Choose a file first.','error');return;}
    if(!$('ti-ok').checked){toast('Please confirm you have permission.','error');return;}
    if(!$('ti-n').value.trim()&&$('ti-r').value!=='own'){toast('Write who gave permission.','error');return;}
    var ext=(f.name.split('.').pop()||'').toLowerCase(),isImg=/^(jpg|jpeg|png|webp)$/.test(ext),isVid=/^(mp4|mov)$/.test(ext);
    if(!isImg&&!isVid){toast('Only MP4, MOV, JPG, PNG or WEBP files.','error');return;}
    if(f.size>262144000){toast('File is larger than 250 MB.','error');return;}
    var link=$('ti-u').value.trim();if(link&&!/^https:\/\/([a-z0-9-]+\.)?tiktok\.com\//i.test(link)){toast('The link must be a tiktok.com link.','error');return;}
    btn.disabled=true;st.textContent='Uploading… keep this tab open';
    try{
      var pr=await call('prepare_upload',{kind:'import',ext:ext});
      var up=await sb.storage.from('tiktok-media').uploadToSignedUrl(pr.path,pr.token,f,{contentType:f.type||(isImg?'image/jpeg':'video/mp4')});
      if(up.error)throw new Error('Upload failed.');
      var u=(await sb.auth.getUser()).data.user||{};
      var cu=$('ti-c').value.trim().replace(/^@/,'');
      var ins=await sb.from('tiktok_media').insert({source_url:link||null,creator_username:cu||null,caption:$('ti-cap').value.trim()||null,kind:isImg?'photo':'video',storage_path:pr.path,rights_basis:$('ti-r').value,rights_note:$('ti-n').value.trim()||null,attribution:cu?'Video: @'+cu+' (TikTok)':null,imported_by:u.id||null,imported_email:u.email||null});
      if(ins.error)throw new Error('Could not save the record.');
      st.textContent='Imported ✓';toast('Imported to the Library.');go('library');
    }catch(e){st.textContent=e.message||'Failed.';btn.disabled=false;}
  }

  /* ---------------- Library ---------------- */
  async function vLibrary(){
    var r=await sb.from('tiktok_media').select('*').order('collected_at',{ascending:false}).limit(60);
    var rows=r.data||[];state.media=rows;
    if(!rows.length){root.innerHTML='<div class="tt-note">The library is empty. Use Import.</div>';return;}
    root.innerHTML='<div class="tt-grid">'+rows.map(function(m){return '<div class="tt-card" data-m="'+m.id+'"><div class="tt-pv tt-note">Loading preview…</div><b>'+(m.creator_username?'@'+esc(m.creator_username):'Buza Media')+'</b><div class="tt-note">'+esc((m.caption||'').slice(0,90))+'</div>'+
      '<div class="tt-note">Imported by '+esc(m.imported_email||'')+' · '+fmtD(m.collected_at)+'<br>Permission: '+esc(m.rights_basis)+(m.rights_note?' — '+esc(m.rights_note):'')+'</div>'+
      (m.kind==='video'?'<label style="font-size:.76rem;display:flex;gap:.4rem;align-items:center"><input type="checkbox" class="tt-br" checked> Add Buza Media branding</label><button class="btn btn-primary" data-edit="'+m.id+'"><i class="ti ti-scissors" aria-hidden="true"></i> Edit &amp; brand</button>':'<div class="tt-note">Photo (stored only; TikTok photo posting is not enabled yet).</div>')+
      '<button class="btn btn-secondary" data-del="'+m.id+'">Delete</button></div>';}).join('')+'</div>';
    rows.forEach(async function(m){try{var s=await call('sign',{path:m.storage_path});var el=root&&root.querySelector('[data-m="'+m.id+'"] .tt-pv');if(el)el.outerHTML=m.kind==='photo'?'<img src="'+esc(s.url)+'" alt="">':'<video src="'+esc(s.url)+'#t=0.5" controls playsinline preload="metadata"></video>';}catch(e){}});
    root.onclick=async function(e){var b=e.target.closest('button');if(!b)return;
      if(b.hasAttribute('data-del')){if(!confirm('Delete this item?'))return;var id=+b.getAttribute('data-del'),m=rows.filter(function(x){return x.id===id;})[0];if(m)await sb.storage.from('tiktok-media').remove([m.storage_path]);await sb.from('tiktok_media').delete().eq('id',id);vLibrary();}
      if(b.hasAttribute('data-edit'))editMedia(+b.getAttribute('data-edit'),b.closest('.tt-card').querySelector('.tt-br').checked,b);};
  }
  async function editMedia(id,branding,btn){
    var m=state.media.filter(function(x){return x.id===id;})[0];if(!m)return;
    if(typeof window.__vsOpenWith!=='function'){toast('Video Studio is still loading. Try again.','error');return;}
    btn.disabled=true;var old=btn.innerHTML;btn.textContent='Opening…';
    try{
      var s=await call('sign',{path:m.storage_path});var res=await fetch(s.url);if(!res.ok)throw new Error('read');
      var blob=await res.blob();var file=new File([blob],'tiktok-import.mp4',{type:blob.type||'video/mp4'});
      var attr=m.attribution||'';
      window.__vsOpenWith(file,{branding:branding,onResult:async function(out,cap,credit){
        try{
          var pr=await call('prepare_upload',{kind:'final',ext:'mp4'});
          var up=await sb.storage.from('tiktok-media').uploadToSignedUrl(pr.path,pr.token,out,{contentType:'video/mp4'});
          if(up.error)throw new Error('upload');
          var tags=suggestTags(m.caption||cap);
          var text=[cap||m.caption||'',attr,credit?'Video kutoka '+credit:'',tags.join(' ')].filter(Boolean).join('\n\n').slice(0,2200);
          var ins=await sb.from('tiktok_posts').insert({media_id:m.id,final_path:pr.path,caption:text,status:'draft'});
          if(ins.error)throw new Error('db');return true;
        }catch(e){toast('Could not add to the queue.','error');return false;}}});
    }catch(e){toast('Could not open the file.','error');}
    btn.disabled=false;btn.innerHTML=old;
  }
  function suggestTags(src){
    var base=['#BuzaMedia','#Tanzania','#HabariZaLeo','#fyp'];var own=(String(src||'').match(/#[\p{L}\p{N}_]+/gu)||[]).slice(0,5);
    var seen={},out=[];base.concat(own).forEach(function(t){var k=t.toLowerCase();if(!seen[k]){seen[k]=1;out.push(t);}});return out.slice(0,8);
  }

  /* ---------------- Queue / History ---------------- */
  var LAB={draft:['Waiting for approval','wait'],approved:['Approved','ok'],publishing:['Publishing…','wait'],processing:['TikTok is processing…','wait'],published:['Published','ok'],failed:['Failed','bad']};
  async function vQueue(){
    var r=await sb.from('tiktok_posts').select('*').in('status',['draft','approved','publishing','processing','failed']).order('created_at',{ascending:false}).limit(40);
    var rows=r.data||[];state.posts=rows;
    if(!rows.length){root.innerHTML='<div class="tt-note">The queue is empty. Edit something in the Library and press “Send to TikTok queue”.</div>';return;}
    root.innerHTML='<div class="tt-grid">'+rows.map(function(p){var l=LAB[p.status]||[p.status,''];return '<div class="tt-card" data-p="'+p.id+'"><div class="tt-pv tt-note">Loading…</div><span class="tt-st '+l[1]+'">'+l[0]+'</span>'+
      (p.status==='draft'?'<label class="tt-l">Caption (editable)</label><textarea rows="5" class="tt-cap">'+esc(p.caption)+'</textarea><div class="tt-tags">'+suggestTags(p.caption).map(function(t){return '<button data-tag="'+esc(t)+'">'+esc(t)+'</button>';}).join('')+'</div><button class="btn btn-primary" data-ap="'+p.id+'"><i class="ti ti-check" aria-hidden="true"></i> Approve for TikTok</button>':
       '<div class="tt-note" style="white-space:pre-wrap">'+esc(p.caption)+'</div>')+
      (p.status==='approved'?'<div class="tt-row"><button class="btn btn-primary" data-pub="'+p.id+'" data-mode="direct">Publish now</button><button class="btn btn-secondary" data-pub="'+p.id+'" data-mode="inbox">Send to TikTok inbox</button></div><div class="tt-note">“Inbox” puts it in your TikTok app as a draft so you finish posting there.</div>':'')+
      (p.error?'<div class="tt-note" style="color:#a4111f">'+esc(p.error)+'</div>':'')+
      '<button class="btn btn-secondary" data-del="'+p.id+'">Remove</button></div>';}).join('')+'</div>';
    rows.forEach(async function(p){try{var s=await call('sign',{path:p.final_path});var el=root&&root.querySelector('[data-p="'+p.id+'"] .tt-pv');if(el)el.outerHTML='<video src="'+esc(s.url)+'#t=0.5" controls playsinline preload="metadata"></video>';}catch(e){}});
    root.onclick=async function(e){var b=e.target.closest('button');if(!b)return;
      if(b.hasAttribute('data-tag')){var ta=b.closest('.tt-card').querySelector('.tt-cap');if(ta&&ta.value.indexOf(b.getAttribute('data-tag'))<0)ta.value=(ta.value+' '+b.getAttribute('data-tag')).trim();}
      if(b.hasAttribute('data-ap')){var id=+b.getAttribute('data-ap'),cap=b.closest('.tt-card').querySelector('.tt-cap').value.trim();if(!cap){toast('Write a caption first.','error');return;}
        var u=(await sb.auth.getUser()).data.user||{};var x=await sb.from('tiktok_posts').update({caption:cap,status:'approved',approved_by:u.id,approved_at:new Date().toISOString()}).eq('id',id).eq('status','draft');
        toast(x.error?'Could not approve.':'Approved.',x.error?'error':'success');vQueue();}
      if(b.hasAttribute('data-pub')){b.disabled=true;b.textContent='Publishing…';try{var j=await call('publish',{post_id:+b.getAttribute('data-pub'),mode:b.getAttribute('data-mode')});toast(j.privacy==='SELF_ONLY'?'Sent. TikTok keeps it private until your app is audited.':'Sent to TikTok.');}catch(er){toast(er.message,'error');}vQueue();}
      if(b.hasAttribute('data-del')){if(!confirm('Remove from the queue?'))return;var d=+b.getAttribute('data-del'),pp=rows.filter(function(q){return q.id===d;})[0];if(pp)await sb.storage.from('tiktok-media').remove([pp.final_path]);await sb.from('tiktok_posts').delete().eq('id',d);vQueue();}
    };
    if(rows.some(function(p){return p.status==='processing';})){poll=setInterval(async function(){for(var i=0;i<rows.length;i++)if(rows[i].status==='processing'){try{await call('check',{post_id:rows[i].id});}catch(e){}}if(tab==='queue')vQueue();},15000);}
  }
  async function vHistory(){
    var r=await sb.from('tiktok_posts').select('*').in('status',['published','failed']).order('created_at',{ascending:false}).limit(60);
    var rows=r.data||[];
    root.innerHTML=rows.length?rows.map(function(p){var l=LAB[p.status];return '<div class="tt-box"><span class="tt-st '+l[1]+'">'+l[0]+'</span> <span class="tt-note">'+fmtD(p.published_at||p.created_at)+(p.privacy?' · '+esc(p.privacy):'')+'</span><div style="margin:.3rem 0;font-size:.85rem;white-space:pre-wrap">'+esc((p.caption||'').slice(0,160))+'</div>'+(p.post_url?'<a href="'+esc(p.post_url)+'" target="_blank" rel="noopener">Open on TikTok</a>':'')+(p.error?'<div class="tt-note">'+esc(p.error)+'</div>':'')+'</div>';}).join(''):'<div class="tt-note">Nothing published yet.</div>';
  }

  /* ---------------- Settings ---------------- */
  async function vSettings(){
    var s=null;try{s=await call('status');}catch(e){}
    state.status=s;
    root.innerHTML='<div class="tt-box"><b>Connection</b><div style="margin:.4rem 0">'+(s?(s.keys?'<span class="tt-st ok">Keys saved</span> ':'<span class="tt-st bad">No keys yet</span> ')+(s.connected?'<span class="tt-st ok">TikTok connected'+(s.username?' (@'+esc(s.username)+')':'')+'</span>':'<span class="tt-st wait">Not connected</span>'):'<span class="tt-st bad">Could not check</span>')+'</div>'+
      '<div class="tt-row"><button class="btn btn-primary" id="tt-conn">Connect TikTok</button><button class="btn btn-secondary" id="tt-disc">Disconnect</button></div></div>'+
      '<div class="tt-box"><b>1. Your TikTok app keys</b><div class="tt-note">From developers.tiktok.com → your app → Credentials. They are saved on the server only and never shown again.</div>'+
      '<label class="tt-l">Client key</label><input type="text" id="tt-ck" autocomplete="off"><label class="tt-l">Client secret</label><input type="password" id="tt-cs" autocomplete="new-password"><div class="tt-row" style="margin-top:.6rem"><button class="btn btn-secondary" id="tt-sk">Save keys</button></div></div>'+
      '<div class="tt-box"><b>2. In the TikTok developer portal</b><div class="tt-note">Add this <b>Redirect URI</b> to Login Kit: <code style="word-break:break-all">'+esc(s&&s.redirect_uri||'')+'</code><br>Add the products <b>Login Kit</b> and <b>Content Posting API</b>, with scopes <code>user.info.basic</code>, <code>video.publish</code>, <code>video.upload</code>.<br>Until TikTok audits your app, TikTok only allows <b>private</b> posts. Use “Send to TikTok inbox” meanwhile.</div></div>'+
      '<div class="tt-box"><b>Browser extension</b><div class="tt-note">No downloader extension is used. Buza Media does not pull videos out of TikTok. Content comes in through Import, as files you are allowed to use. Creator watermarks are never removed.</div></div>';
    $('tt-sk').onclick=async function(){try{await call('save_keys',{client_key:$('tt-ck').value,client_secret:$('tt-cs').value});toast('Keys saved.');vSettings();}catch(e){toast(e.message,'error');}};
    $('tt-conn').onclick=async function(){try{var j=await call('auth_url');window.open(j.url,'_blank','noopener');toast('Finish in the TikTok tab, then come back and reopen Settings.');}catch(e){toast(e.message,'error');}};
    $('tt-disc').onclick=async function(){if(!confirm('Disconnect TikTok?'))return;await call('disconnect');vSettings();};
  }

  window.TTMod={show:function(){mount();go(tab);}};
})();
