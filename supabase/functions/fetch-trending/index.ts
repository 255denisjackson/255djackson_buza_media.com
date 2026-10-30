// fetch-trending: (1) pulls new stories from the enabled news_sources into articles,
//                 (2) with {mirror_url} copies a picture link into our own storage.
// Allowed callers: a signed-in Buza admin (the Admin page button) or the scheduler (x-cron-secret header).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { parseFeed, normalizeLink, isPrivateHost, stripHtml, type Story } from "./feed.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const MAX_NEW_PER_RUN = 80, TIME_BUDGET_MS = 110_000, MAX_AGE_DAYS = 5, BUCKET = "article-images";
const UA = "Mozilla/5.0 (compatible; BuzaMediaBot/1.0; +https://255denisjackson.github.io/255djackson_buza_media.com/)";

async function authorize(req: Request): Promise<boolean> {
  const cron = req.headers.get("x-cron-secret");
  if (cron) {
    const { data } = await sb.from("app_secrets").select("value").eq("name", "cron_secret").maybeSingle();
    return !!data?.value && data.value === cron;
  }
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return false;
  const { data: u } = await sb.auth.getUser(jwt);
  if (!u?.user) return false;
  const { data: a } = await sb.from("admins").select("user_id").eq("user_id", u.user.id).maybeSingle();
  return !!a;
}

async function timedFetch(url: string, ms: number, init: RequestInit = {}) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...init, signal: c.signal, redirect: "follow", headers: { "User-Agent": UA, ...(init.headers || {}) } }); }
  finally { clearTimeout(t); }
}

async function mirrorImage(src: string): Promise<string | null> {
  try {
    const u = new URL(src);
    if (!/^https?:$/.test(u.protocol) || isPrivateHost(u.hostname)) return null;
    const r = await timedFetch(src, 9000);
    if (!r.ok) return null;
    const type = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const ext = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" } as Record<string, string>)[type];
    if (!ext) return null;
    const len = Number(r.headers.get("content-length") || 0);
    if (len > 15 * 1024 * 1024) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.length > 15 * 1024 * 1024 || buf.length < 500) return null;
    const path = `mirrored/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: type, cacheControl: "31536000", upsert: false });
    if (error) return null;
    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } catch { return null; }
}

async function sha1(s: string) {
  const d = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function run() {
  const { data: got } = await sb.rpc("acquire_job_lock", { p_name: "fetch-trending", p_seconds: 200 });
  if (!got) return { found: 0, inserted: 0, errors: 0, skipped: "already running" };
  const started = Date.now();
  const { data: runRow } = await sb.from("trending_runs").insert({}).select("id").single();
  let found = 0, inserted = 0, errors = 0; const errMsgs: string[] = [];
  try {
    const { data: sources, error } = await sb.from("news_sources").select("*").eq("enabled", true).order("priority", { ascending: false }).order("id");
    if (error) throw error;
    const cutoff = Date.now() - MAX_AGE_DAYS * 864e5;

    const doSource = async (src: any) => {
      if (Date.now() - started > TIME_BUDGET_MS || inserted >= MAX_NEW_PER_RUN) return;
      try {
        const r = await timedFetch(src.feed_url, 12000);
        if (!r.ok) throw new Error(`${src.name}: feed said ${r.status}`);
        const stories: Story[] = parseFeed(await r.text()).filter((s) => {
          const t = Date.parse(s.published); return isNaN(t) || t >= cutoff;
        }).slice(0, Math.max(src.max_items * 4, 8));
        found += stories.length;
        const keyed = await Promise.all(stories.map(async (s) => ({ s, key: (await sha1(normalizeLink(s.link))).slice(0, 32) })));
        const { data: have } = await sb.from("articles").select("dedupe_key").in("dedupe_key", keyed.map((k) => k.key));
        const seen = new Set((have || []).map((h: any) => h.dedupe_key));
        const fresh = keyed.filter((k) => !seen.has(k.key)).slice(0, src.max_items);
        for (const { s, key } of fresh) {
          if (inserted >= MAX_NEW_PER_RUN) break;
          const name = s.source || src.name;
          const snippet = (s.text || s.title).slice(0, 1500);
          const image = s.image ? ((await mirrorImage(s.image)) ?? s.image) : null;
          const pub = Date.parse(s.published);
          const row = {
            title: s.title.slice(0, 300), subtitle: snippet.slice(0, 300),
            body: `${snippet}\n\nChanzo: ${name} — ${s.link}`,
            category_id: src.category_id, author: "Buza Media", status: "published",
            image_url: image, source_id: src.id, source_name: name, source_url: s.link, source_title: s.title,
            language: src.language || "en", dedupe_key: key, ai_generated: false,
            published_at: new Date(isNaN(pub) || pub > Date.now() ? Date.now() : pub).toISOString(),
          };
          const { error: ie } = await sb.from("articles").insert(row);
          if (!ie) inserted++; else if (ie.code !== "23505") { errors++; errMsgs.push(`${src.name}: ${ie.message}`); }
        }
        await sb.from("news_sources").update({ last_fetched_at: new Date().toISOString() }).eq("id", src.id);
      } catch (e) { errors++; errMsgs.push(String((e as Error).message || e)); }
    };

    for (let i = 0; i < (sources || []).length; i += 6) await Promise.all((sources || []).slice(i, i + 6).map(doSource));
  } catch (e) { errors++; errMsgs.push(String((e as Error).message || e)); }
  const status = errors === 0 ? "success" : inserted > 0 ? "partial" : "failed";
  if (runRow?.id) await sb.from("trending_runs").update({ finished_at: new Date().toISOString(), status, found, inserted, error: errMsgs.slice(0, 5).join(" | ") || null }).eq("id", runRow.id);
  await sb.from("job_locks").update({ locked_until: new Date().toISOString() }).eq("name", "fetch-trending");
  return { found, inserted, errors, status };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  let body: any = {}; try { body = await req.json(); } catch { /* empty body is fine */ }
  if (!(await authorize(req))) return json({ error: "Not allowed" }, 401);
  if (body?.mirror_url) {
    const url = await mirrorImage(String(body.mirror_url));
    return json(url ? { url } : { url: null, error: "could not copy that picture" });
  }
  return json(await run());
});
