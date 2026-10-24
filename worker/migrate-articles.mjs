// One-time copy of published articles from Supabase -> D1 (run on your own computer, Node 18+).
//   node migrate-articles.mjs          # writes ./migration/articles-*.sql
//   node migrate-articles.mjs --run    # also loads them into D1 with wrangler
// Uses only the public (publishable) key, so it copies what visitors can already see:
// published articles with their view/like counts. Drafts/private rows are not readable with that key.
import { writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const URL_ = process.env.SUPABASE_URL || 'https://gxfwjicztemfpxfjbdqq.supabase.co';
const KEY = process.env.SUPABASE_KEY || 'sb_publishable_zz-T8b1gItOWTM2R43t-jQ_--qts2s8';
const DB = process.env.D1_NAME || 'buzamedia-db';
const COLS = ['id','slug','title','subtitle','body','category_id','author','tags','status','is_breaking','is_featured','orientation','image_url','image_width','image_height','video_url','source_name','source_url','source_caption','ai_generated','view_count','like_count','published_at','created_at','updated_at','language','short_code','source_title','title_en','subtitle_en','body_en'];

const lit = v => v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? (v ? '1' : '0') : "'" + String(v).replace(/'/g, "''") + "'";
const val = (c, v) => c === 'tags' ? lit(JSON.stringify(Array.isArray(v) ? v : [])) : lit(v);

async function fetchAll() {
  const rows = [];
  for (let from = 0; ; from += 200) {
    const r = await fetch(`${URL_}/rest/v1/articles?select=${COLS.join(',')}&status=eq.published&order=created_at.asc`, {
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, Range: `${from}-${from + 199}`, 'Range-Unit': 'items' },
    });
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
    const page = await r.json();
    rows.push(...page);
    process.stdout.write(`\rfetched ${rows.length}`);
    if (page.length < 200) break;
  }
  console.log();
  return rows;
}

const rows = await fetchAll();
mkdirSync('migration', { recursive: true });
const files = [];
for (let i = 0; i < rows.length; i += 50) {
  const sql = rows.slice(i, i + 50).map(a =>
    `INSERT OR REPLACE INTO articles(${COLS.join(',')}) VALUES(${COLS.map(c => val(c, a[c])).join(',')});`).join('\n');
  const f = `migration/articles-${String(i / 50).padStart(3, '0')}.sql`;
  writeFileSync(f, sql); files.push(f);
}
console.log(`wrote ${files.length} files for ${rows.length} articles in ./migration`);
if (process.argv.includes('--run')) {
  for (const f of files) {
    const r = spawnSync('npx', ['wrangler', 'd1', 'execute', DB, '--remote', '--file', f], { stdio: 'inherit', shell: process.platform === 'win32' });
    if (r.status !== 0) { console.error('stopped at', f); process.exit(1); }
  }
  console.log('done — check <worker-url>/api/health for the article count');
}
