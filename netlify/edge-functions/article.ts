// Netlify Edge Function: gives every shared article link (/a/<code>/) its own picture, headline and
// summary for WhatsApp, Facebook, X, Telegram etc., the moment the article exists (no waiting for a build).
// People opening the link are sent straight into the site's reader at /?a=<code>.
const SB_URL = 'https://gxfwjicztemfpxfjbdqq.supabase.co';
const SB_KEY = 'sb_publishable_zz-T8b1gItOWTM2R43t-jQ_--qts2s8';

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = (s: unknown) => String(s ?? '').replace(/<[^>]*>/g, ' ').normalize('NFKC').replace(/\s+/g, ' ').trim();
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trim() + '…' : s);

export default async (req: Request, context: any) => {
  const url = new URL(req.url);
  const m = url.pathname.match(/^\/a\/([A-Za-z0-9_-]+)\/?$/);
  if (!m) return context.next();
  const code = m[1];
  const origin = url.origin;

  let a: any = null;
  try {
    const sel = 'short_code,title,subtitle,body,author,image_url,published_at,categories(name)';
    const r = await fetch(
      `${SB_URL}/rest/v1/articles?select=${encodeURIComponent(sel)}&short_code=eq.${encodeURIComponent(code)}&status=eq.published&limit=1`,
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } },
    );
    if (r.ok) a = (await r.json())[0] ?? null;
  } catch { /* fall through to the plain redirect */ }

  const target = `${origin}/?a=${encodeURIComponent(code)}`;
  const title = a ? plain(a.title).replace(/\s*[-–—|:]\s*videos?\s*$/i, '') : 'Buza Media';
  const desc = a ? cut(plain(a.subtitle) || plain(a.body), 200) : 'Habari za uhakika kutoka Tanzania';
  let img = a?.image_url || `${origin}/og-default.png`;
  if (img.startsWith('/')) img = origin + img;
  const pageUrl = `${origin}/a/${encodeURIComponent(code)}/`;

  const html = `<!doctype html>
<html lang="sw"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} | Buza Media</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(pageUrl)}">
<meta property="og:type" content="article"><meta property="og:site_name" content="Buza Media">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(pageUrl)}"><meta property="og:image" content="${esc(img)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(img)}">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
<script>location.replace(${JSON.stringify(target)});</script>
</head><body style="font-family:system-ui;padding:2rem"><p>Inafungua Buza Media… <a href="${esc(target)}">Bonyeza hapa</a></p></body></html>`;

  return new Response(html, {
    status: a ? 200 : 404,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
  });
};

export const config = { path: '/a/*' };
