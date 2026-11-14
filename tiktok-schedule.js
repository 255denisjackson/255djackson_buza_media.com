/* Buza Media - TikTok schedule (admin). Status page: TikTok posting needs TikTok's approval of our Content Posting API request first. */
(function(){
  'use strict';
  var root=null;
  function $(id){return document.getElementById(id);}
  async function load(){
    if(!root)return;
    var r=await sb.from('social_accounts').select('enabled,account_ref').eq('platform','tiktok').maybeSingle();
    var on=!!(r&&r.data&&r.data.enabled&&r.data.account_ref);
    root.innerHTML=
      '<div class="ys-it" style="border:1px solid var(--border);border-radius:12px;padding:.8rem .95rem;background:var(--card);margin-bottom:.8rem"><span style="display:inline-block;border-radius:999px;padding:.12rem .6rem;font-size:.72rem;font-weight:700;background:'+(on?'#e3f8ea;color:#136c2e':'#fff4d6;color:#8a5a00')+'">'+(on?'Connected':'Not connected yet')+'</span>'+
      '<div style="margin-top:.5rem;font-size:.86rem;line-height:1.5">'+(on?'TikTok is connected. Scheduled videos will show here.':'No video can go to TikTok from this site yet. TikTok must first approve our “Content Posting API” request (Privacy Policy and Terms pages are ready). Nothing has been posted or scheduled on TikTok.')+'</div></div>'+
      '<b style="font-size:.9rem">Coming up</b><div style="margin:.5rem 0 1rem;font-size:.8rem;color:var(--muted)">Nothing scheduled on TikTok.</div>'+
      '<b style="font-size:.9rem">What happens when TikTok approves</b><ol style="font-size:.82rem;line-height:1.6;color:var(--muted);padding-left:1.1rem"><li>You connect the Buza Media TikTok account once.</li><li>Video Studio gets a “Schedule for TikTok” button.</li><li>Every scheduled video, and whether it posted, shows on this page.</li></ol>';
  }
  window.TTSched={show:function(){
    var p=$('panel-ttsched');if(!p)return;
    if(!root){p.innerHTML='<div class="admin-section"><div class="admin-section-title"><i class="ti ti-brand-tiktok" aria-hidden="true"></i> TikTok schedule</div><div class="admin-section-sub">See here if videos are going to TikTok.</div><div id="tt-body"></div></div>';root=$('tt-body');}
    root.innerHTML='Loading…';load();
  }};
})();
