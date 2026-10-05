// Builds, from the Supabase database:
//   a/<code>/index.html   one crawlable page per article (title, photo, text, share preview, NewsArticle data)
//   sitemap.xml           every public page
//   news-sitemap.xml      original stories from the last 48 hours (Google News format)
//   feed.xml              RSS feed
// Runs every 30 minutes in GitHub Actions. Only the public (publishable) key is used.
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';

const SITE = (process.env.SITE_URL || 'https://255denisjackson.github.io/255djackson_buza_media.com/').replace(/\/?$/, '/');
const SB_URL = process.env.SUPABASE_URL || 'https://gxfwjicztemfpxfjbdqq.supabase.co';
const SB_KEY = process.env.SUPABASE_KEY || 'sb_publishable_zz-T8b1gItOWTM2R43t-jQ_--qts2s8';
// Stories copied in from other publishers are short teasers. By default they get a page (so shared links show
// a picture) but are asked NOT to be indexed. Set INDEX_AGGREGATED=1 to let Google index them too.
const INDEX_AGGREGATED = process.env.INDEX_AGGREGATED === '1';
const NAME = 'Buza Media';
const LOGO = SITE + 'icon-512.png';
const FIXTURE = process.env.FIXTURE; // test mode: read articles from a JSON file instead of the database

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = (s) => String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).trim() + '…' : s);
const iso = (d) => new Date(d).toISOString();

async function load() {
  if (FIXTURE) return JSON.parse(readFileSync(FIXTURE, 'utf8'));
  const sel = 'short_code,title,subtitle,body,author,image_url,published_at,created_at,source_name,source_url,is_breaking,categories(name)';
  const r = await fetch(`${SB_URL}/rest/v1/articles?select=${encodeURIComponent(sel)}&status=eq.published&short_code=not.is.null&order=published_at.desc&limit=1000`,
    { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
  if (!r.ok) throw new Error('database said ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}

const rows = (await load()).filter((a) => a.short_code && a.title);
const articles = rows.map((a) => {
  const pub = a.published_at || a.created_at;
  const original = !a.source_url;
  const desc = cut(plain(a.subtitle) || plain(a.body), 200);
  return {
    code: a.short_code, title: plain(a.title), desc, image: a.image_url || SITE + 'og-default.png',
    hasImage: !!a.image_url, pub, author: plain(a.author) || NAME, cat: a.categories?.name || 'Habari',
    sourceName: a.source_name || '', sourceUrl: a.source_url || '', original, body: String(a.body || ''),
    indexable: original || INDEX_AGGREGATED,
    url: `${SITE}a/${a.short_code}/`,
  };
});

// ---------- article pages ----------
function articlePage(a) {
  const paras = a.body.split(/\n{2,}/).map((p) => plain(p)).filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" rel="nofollow noopener" target="_blank">$1</a>')}</p>`).join('\n');
  const ld = {
    '@context': 'https://schema.org', '@type': 'NewsArticle', mainEntityOfPage: a.url, headline: a.title.slice(0, 110),
    description: a.desc, image: [a.image], datePublished: iso(a.pub), dateModified: iso(a.pub), inLanguage: 'sw',
    articleSection: a.cat,
    author: { '@type': a.author === NAME ? 'Organization' : 'Person', name: a.author },
    publisher: { '@type': 'NewsMediaOrganization', name: NAME, url: SITE, logo: { '@type': 'ImageObject', url: LOGO } },
  };
  return `<!doctype html>
<html lang="sw"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(a.title)} | ${NAME}</title>
<meta name="description" content="${esc(a.desc)}">
<meta name="robots" content="${a.indexable ? 'index,follow,max-image-preview:large' : 'noindex,follow'}">
<link rel="canonical" href="${a.url}">
<link rel="icon" href="${SITE}favicon.ico"><link rel="apple-touch-icon" href="${SITE}icon-180.png">
<meta property="og:type" content="article"><meta property="og:site_name" content="${NAME}"><meta property="og:locale" content="sw_TZ">
<meta property="og:title" content="${esc(a.title)}"><meta property="og:description" content="${esc(a.desc)}">
<meta property="og:url" content="${a.url}"><meta property="og:image" content="${esc(a.image)}">
<meta property="article:published_time" content="${iso(a.pub)}"><meta property="article:section" content="${esc(a.cat)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(a.title)}">
<meta name="twitter:description" content="${esc(a.desc)}"><meta name="twitter:image" content="${esc(a.image)}">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
<style>
body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f8f9fa;color:#1a1a1e;line-height:1.65}
header{background:#1a1a2e;padding:.8rem 1.2rem}header a{color:#fff;font-weight:700;text-decoration:none;font-size:1.1rem}header span{color:#5a8cff}
main{max-width:720px;margin:0 auto;padding:1.2rem}img.hero{width:100%;height:auto;border-radius:12px;display:block;background:#ddd}
.cat{display:inline-block;background:#eef2ff;color:#3730a3;font-size:.75rem;font-weight:700;padding:3px 10px;border-radius:12px;margin:1rem 0 .2rem}
h1{font-size:1.7rem;line-height:1.25;margin:.3rem 0}.meta{color:#6c757d;font-size:.85rem;margin-bottom:1rem}
.btn{display:inline-block;background:#2065fe;color:#fff;text-decoration:none;font-weight:600;padding:.7rem 1.2rem;border-radius:10px;margin:1rem 0}
footer{text-align:center;color:#6c757d;font-size:.8rem;padding:1.5rem}footer a{color:#2065fe}a{color:#2065fe;word-break:break-word}
</style></head><body>
<header><a href="${SITE}">Buza<span> Media</span></a></header>
<main><article>
${a.hasImage ? `<img class="hero" src="${esc(a.image)}" alt="${esc(a.title)}" width="1200" height="800">` : ''}
<span class="cat">${esc(a.cat)}</span>
<h1>${esc(a.title)}</h1>
<div class="meta">${esc(a.author)} · <time datetime="${iso(a.pub)}">${new Date(a.pub).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Dar_es_Salaam' })}</time></div>
${paras}
<a class="btn" href="${SITE}?a=${a.code}">Soma kwenye Buza Media</a>
</article></main>
<footer><a href="${SITE}">Buza Media</a> · <a href="${SITE}privacy.html">Faragha</a> · <a href="${SITE}Terms.html">Masharti</a></footer>
</body></html>`;
}

// write pages, remove pages for articles that no longer exist
mkdirSync('a', { recursive: true });
const live = new Set(articles.map((a) => a.code));
if (existsSync('a')) for (const d of readdirSync('a')) if (!live.has(d)) rmSync('a/' + d, { recursive: true, force: true });
for (const a of articles) { mkdirSync(`a/${a.code}`, { recursive: true }); writeFileSync(`a/${a.code}/index.html`, articlePage(a)); }

// ---------- sitemap.xml ----------
const urls = [
  `<url><loc>${SITE}</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>`,
  `<url><loc>${SITE}privacy.html</loc><priority>0.2</priority></url>`,
  `<url><loc>${SITE}Terms.html</loc><priority>0.2</priority></url>`,
  ...articles.filter((a) => a.indexable).map((a) => `<url><loc>${a.url}</loc><lastmod>${iso(a.pub)}</lastmod></url>`),
];
writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);

// ---------- news-sitemap.xml (Google News: last 2 days, indexable stories only) ----------
const recent = articles.filter((a) => a.indexable && Date.now() - new Date(a.pub).getTime() < 48 * 3600000).slice(0, 1000);
writeFileSync('news-sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${recent.map((a) =>
  `<url><loc>${a.url}</loc><news:news><news:publication><news:name>${NAME}</news:name><news:language>sw</news:language></news:publication><news:publication_date>${iso(a.pub)}</news:publication_date><news:title>${esc(a.title)}</news:title></news:news></url>`).join('\n')}\n</urlset>\n`);

// ---------- feed.xml ----------
const feedItems = articles.slice(0, 50).map((a) => `<item><title>${esc(a.title)}</title><link>${a.url}</link><guid isPermaLink="true">${a.url}</guid><pubDate>${new Date(a.pub).toUTCString()}</pubDate><category>${esc(a.cat)}</category><description>${esc(a.desc)}</description>${a.hasImage ? `<enclosure url="${esc(a.image)}" type="image/jpeg" length="0"/>` : ''}</item>`);
writeFileSync('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${NAME}</title><link>${SITE}</link><description>Habari za uhakika kutoka Tanzania</description><language>sw</language>\n${feedItems.join('\n')}\n</channel></rss>\n`);

console.log(`pages: ${articles.length}, indexable: ${articles.filter((a) => a.indexable).length}, in news sitemap: ${recent.length}`);
