// Buza Media API — Cloudflare Worker backed by D1 (replaces the Supabase REST/RPC calls).
const ARTICLE_COLS = 'id,short_code,title,subtitle,body,author,tags,status,is_breaking,is_featured,orientation,language,title_en,subtitle_en,image_url,image_width,image_height,video_url,view_count,like_count,published_at,created_at,source_name,source_url,category_id';
const WRITABLE = ['title','subtitle','body','category_id','author','tags','status','is_breaking','is_featured','orientation','image_url','image_width','image_height','video_url','published_at','source_name','source_url','language','title_en','subtitle_en','body_en'];
const BOOLS = new Set(['is_breaking','is_featured']);
const PUBLIC_SETTING_KEYS = null; // public = is_public=1 in the table

const enc = new TextEncoder();
const b64u = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function hmac(secret, data) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', k, enc.encode(data)));
}
async function signToken(env, email) {
  const body = b64u(enc.encode(JSON.stringify({ e: email, exp: Date.now() + 14 * 864e5 })));
  return body + '.' + await hmac(env.TOKEN_SECRET, body);
}
async function verifyToken(env, req) {
  const m = (req.headers.get('Authorization') || '').match(/^Bearer (.+)\.(.+)$/);
  if (!m || !env.TOKEN_SECRET) return false;
  if (await hmac(env.TOKEN_SECRET, m[1]) !== m[2]) return false;
  try { const p = JSON.parse(atob(m[1].replace(/-/g,'+').replace(/_/g,'/'))); return p.exp > Date.now(); } catch { return false; }
}
function safeEq(a, b) { a = String(a); b = String(b); let r = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) r |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return r === 0; }

const cors = (env, req) => {
  const allowed = (env.ALLOWED_ORIGIN || 'https://255denisjackson.github.io').split(',');
  const o = req.headers.get('Origin') || '';
  return { 'Access-Control-Allow-Origin': allowed.includes(o) ? o : allowed[0], 'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization', 'Vary': 'Origin' };
};
const json = (d, s, h) => new Response(JSON.stringify(d), { status: s || 200, headers: { 'Content-Type': 'application/json', ...h } });

function shape(r, cats) { // D1 row -> same shape the site got from Supabase
  return { ...r, tags: safeParse(r.tags, []), is_breaking: !!r.is_breaking, is_featured: !!r.is_featured, categories: r.category_id && cats[r.category_id] ? { name: cats[r.category_id] } : null };
}
function safeParse(s, d) { try { return JSON.parse(s); } catch { return d; } }
async function catMap(env) { const { results } = await env.DB.prepare('SELECT id,name FROM categories').all(); return Object.fromEntries(results.map(c => [c.id, c.name])); }
const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

function cleanFields(b) {
  const o = {};
  for (const k of WRITABLE) if (k in b) {
    let v = b[k];
    if (k === 'tags') v = JSON.stringify(Array.isArray(v) ? v : []);
    else if (BOOLS.has(k)) v = v ? 1 : 0;
    else if (k === 'status' && !['draft','published','archived'].includes(v)) continue;
    else if (k === 'orientation' && !['landscape','portrait','square'].includes(v)) continue;
    o[k] = v === undefined ? null : v;
  }
  return o;
}

export default {
  async fetch(req, env) {
    const h = cors(env, req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const url = new URL(req.url);
    const p = url.pathname.replace(/\/+$/, '');
    const admin = req.method !== 'GET' || p === '/api/me' || url.searchParams.has('all') ? await verifyToken(env, req) : false;
    try {
      // ---- auth
      if (p === '/api/login' && req.method === 'POST') {
        const { email, password } = await req.json();
        if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD || !env.TOKEN_SECRET) return json({ error: 'Server not configured' }, 500, h);
        if (!safeEq(email || '', env.ADMIN_EMAIL) || !safeEq(password || '', env.ADMIN_PASSWORD)) return json({ error: 'Invalid login credentials' }, 401, h);
        return json({ token: await signToken(env, email) }, 200, h);
      }
      if (p === '/api/me') return json({ admin }, 200, h);

      // ---- categories / settings
      if (p === '/api/categories' && req.method === 'GET') { const { results } = await env.DB.prepare('SELECT id,name,slug FROM categories ORDER BY sort_order,id').all(); return json(results, 200, h); }
      let m;
      if ((m = p.match(/^\/api\/settings\/([\w-]+)$/))) {
        if (req.method === 'GET') {
          const r = await env.DB.prepare('SELECT value,is_public FROM site_settings WHERE key=?').bind(m[1]).first();
          if (!r || (!r.is_public && !admin)) return json({ value: null }, 200, h);
          return json({ value: safeParse(r.value, null) }, 200, h);
        }
        if (req.method === 'PUT') {
          if (!admin) return json({ error: 'Unauthorized' }, 401, h);
          const b = await req.json();
          await env.DB.prepare('INSERT INTO site_settings(key,value,is_public,updated_at) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,is_public=excluded.is_public,updated_at=excluded.updated_at').bind(m[1], JSON.stringify(b.value), b.is_public ? 1 : 0, now()).run();
          return json({ ok: true }, 200, h);
        }
      }

      // ---- articles
      if (p === '/api/articles' && req.method === 'GET') {
        const all = admin && url.searchParams.has('all');
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '500', 10) || 500, 1000);
        const key = url.searchParams.get('short_code') ? ['short_code', url.searchParams.get('short_code')] : url.searchParams.get('id') ? ['id', url.searchParams.get('id')] : null;
        let sql = `SELECT ${ARTICLE_COLS} FROM articles WHERE 1=1`; const args = [];
        if (!all) sql += " AND status='published'";
        if (key) { sql += ` AND ${key[0]}=?`; args.push(key[1]); }
        sql += ' ORDER BY published_at IS NULL, published_at DESC, created_at DESC LIMIT ?'; args.push(limit);
        const [{ results }, cats] = await Promise.all([env.DB.prepare(sql).bind(...args).all(), catMap(env)]);
        return json(results.map(r => shape(r, cats)), 200, h);
      }
      if ((m = p.match(/^\/api\/articles\/([\w-]+)\/body_en$/)) && req.method === 'GET') {
        const r = await env.DB.prepare("SELECT body_en FROM articles WHERE id=? AND status='published'").bind(m[1]).first();
        return json({ body_en: r ? r.body_en : null }, 200, h);
      }
      if (p === '/api/articles' && req.method === 'POST') {
        if (!admin) return json({ error: 'Unauthorized' }, 401, h);
        const f = cleanFields(await req.json()); const id = uuid();
        if (!f.title) return json({ error: 'title required' }, 400, h);
        const cols = ['id', ...Object.keys(f)]; const vals = [id, ...Object.values(f)];
        await env.DB.prepare(`INSERT INTO articles(${cols.join(',')}) VALUES(${cols.map(() => '?').join(',')})`).bind(...vals).run();
        const r = await env.DB.prepare(`SELECT ${ARTICLE_COLS} FROM articles WHERE id=?`).bind(id).first();
        return json(shape(r, await catMap(env)), 201, h);
      }
      if ((m = p.match(/^\/api\/articles\/([\w-]+)$/))) {
        if (!admin) return json({ error: 'Unauthorized' }, 401, h);
        if (req.method === 'PATCH') {
          const f = cleanFields(await req.json()); const ks = Object.keys(f);
          if (!ks.length) return json({ error: 'nothing to update' }, 400, h);
          const res = await env.DB.prepare(`UPDATE articles SET ${ks.map(k => k + '=?').join(',')}, updated_at=? WHERE id=?`).bind(...Object.values(f), now(), m[1]).run();
          if (!res.meta.changes) return json({ error: 'not found' }, 404, h);
          const r = await env.DB.prepare(`SELECT ${ARTICLE_COLS} FROM articles WHERE id=?`).bind(m[1]).first();
          return json(shape(r, await catMap(env)), 200, h);
        }
        if (req.method === 'DELETE') {
          const res = await env.DB.prepare('DELETE FROM articles WHERE id=?').bind(m[1]).run();
          return json({ deleted: res.meta.changes }, 200, h);
        }
      }

      // ---- views / likes (public)
      if ((m = p.match(/^\/api\/view\/([\w-]+)$/)) && req.method === 'POST') {
        await env.DB.prepare("UPDATE articles SET view_count=view_count+1 WHERE id=? AND status='published'").bind(m[1]).run();
        return json({ ok: true }, 200, h);
      }
      if (p === '/api/like' && req.method === 'POST') {
        const { article_id, visitor_id } = await req.json();
        if (!article_id || typeof visitor_id !== 'string' || visitor_id.length < 8 || visitor_id.length > 64) return json({ error: 'bad request' }, 400, h);
        const art = await env.DB.prepare("SELECT id FROM articles WHERE id=? AND status='published'").bind(article_id).first();
        if (!art) return json({ error: 'article not found' }, 404, h);
        const del = await env.DB.prepare('DELETE FROM article_likes WHERE article_id=? AND visitor_id=?').bind(article_id, visitor_id).run();
        let liked;
        if (del.meta.changes === 0) { await env.DB.prepare('INSERT INTO article_likes(article_id,visitor_id) VALUES(?,?)').bind(article_id, visitor_id).run(); await env.DB.prepare('UPDATE articles SET like_count=like_count+1 WHERE id=?').bind(article_id).run(); liked = true; }
        else { await env.DB.prepare('UPDATE articles SET like_count=MAX(like_count-1,0) WHERE id=?').bind(article_id).run(); liked = false; }
        const c = await env.DB.prepare('SELECT like_count FROM articles WHERE id=?').bind(article_id).first();
        return json({ liked, like_count: c.like_count }, 200, h);
      }

      // ---- push subscriptions (public save/delete, same as the old RPCs)
      if (p === '/api/push' && req.method === 'POST') {
        const { endpoint, p256dh, auth } = await req.json();
        if (!/^https:\/\//.test(endpoint || '') || endpoint.length >= 1200 || !p256dh || p256dh.length >= 200 || !auth || auth.length >= 100) return json({ error: 'bad subscription' }, 400, h);
        await env.DB.prepare('INSERT INTO push_subscriptions(endpoint,p256dh,auth) VALUES(?,?,?) ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth').bind(endpoint, p256dh, auth).run();
        return json({ ok: true }, 200, h);
      }
      if (p === '/api/push' && req.method === 'DELETE') {
        const { endpoint } = await req.json();
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').bind(endpoint || '').run();
        return json({ ok: true }, 200, h);
      }
      if (p === '/api/health') { const r = await env.DB.prepare('SELECT count(*) n FROM articles').first(); return json({ ok: true, articles: r.n }, 200, h); }
      return json({ error: 'Not found' }, 404, h);
    } catch (e) {
      return json({ error: String(e.message || e) }, 500, h);
    }
  },
};
