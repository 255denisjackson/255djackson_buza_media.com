// Copies published articles (with view/like counts) from the PRIMARY database into the BACKUP database.
// Run on your computer or in GitHub Actions (Node 18+). Safe to run again: existing rows are updated, nothing is deleted.
//
//   BACKUP_SERVICE_KEY=<service_role key of the backup project> node tools/copy-articles-to-backup.mjs
//
// The service_role key is in the backup project: Settings > API > service_role (secret). Never put it in the website.
const FROM = { url: process.env.FROM_URL || 'https://gxfwjicztemfpxfjbdqq.supabase.co', key: process.env.FROM_KEY || 'sb_publishable_zz-T8b1gItOWTM2R43t-jQ_--qts2s8' };
const TO = { url: process.env.TO_URL || 'https://liingyivheqmuosuxwvd.supabase.co', key: process.env.BACKUP_SERVICE_KEY };
if (!TO.key) { console.error('Set BACKUP_SERVICE_KEY (service_role key of the backup project).'); process.exit(1); }

const COLS = 'id,slug,title,subtitle,body,category_id,author,tags,status,is_breaking,is_featured,orientation,image_url,image_width,image_height,video_url,source_id,source_name,source_url,source_caption,ai_generated,view_count,like_count,published_at,created_at,updated_at,language,short_code,dedupe_key,source_title,title_en,subtitle_en,body_en';

async function readAll() {
  const rows = [];
  for (let from = 0; ; from += 500) {
    const r = await fetch(`${FROM.url}/rest/v1/articles?select=${COLS}&status=eq.published&order=created_at.asc`,
      { headers: { apikey: FROM.key, Authorization: 'Bearer ' + FROM.key, Range: `${from}-${from + 499}`, 'Range-Unit': 'items' } });
    if (!r.ok) throw new Error(`reading primary failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
    const page = await r.json(); rows.push(...page); process.stdout.write(`\rread ${rows.length}`);
    if (page.length < 500) break;
  }
  console.log(); return rows;
}

const rows = await readAll();
let done = 0;
for (let i = 0; i < rows.length; i += 50) {
  const chunk = rows.slice(i, i + 50);
  const r = await fetch(`${TO.url}/rest/v1/articles?on_conflict=id`, {
    method: 'POST',
    headers: { apikey: TO.key, Authorization: 'Bearer ' + TO.key, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(chunk),
  });
  if (!r.ok) throw new Error(`writing backup failed at row ${i}: ${r.status} ${(await r.text()).slice(0, 300)}`);
  done += chunk.length; process.stdout.write(`\rcopied ${done}/${rows.length}`);
}
console.log(`\nDone: ${done} articles are now in the backup database.`);
