# Buza Media API (Cloudflare Worker + D1)

Replaces the Supabase REST/RPC/auth calls used by `index.html` and `build-seo.mjs`.
Database: D1 `buzamedia-db` (id in `wrangler.toml`). Schema: `schema.sql`.

## Deploy (one time)
```bash
cd worker && npm install
npx wrangler login
npx wrangler secret put ADMIN_EMAIL      # your admin login email
npx wrangler secret put ADMIN_PASSWORD   # your admin password
npx wrangler secret put TOKEN_SECRET     # any long random string
npx wrangler deploy                      # prints https://buzamedia-api.<you>.workers.dev
```
Then replace `REPLACE-ME` with your workers.dev subdomain in `index.html` (`API_BASE`) and
`build-seo.mjs` (`API_URL`, or set the `API_URL` env var in the GitHub Action). Check
`<worker-url>/api/health` returns the article count.

## Endpoints
`POST /api/login` · `GET /api/me` · `GET /api/categories` · `GET|PUT /api/settings/:key` ·
`GET|POST /api/articles` · `PATCH|DELETE /api/articles/:id` · `GET /api/articles/:id/body_en` ·
`POST /api/view/:id` · `POST /api/like` · `POST|DELETE /api/push` · `GET /api/health`

Not yet ported (still on Supabase): edge functions (fetch-trending, social-poster, send-push,
search-news, translate-en, ...), scheduled jobs, and file storage uploads.

## Copy the articles into D1 (one time, run on your computer)
```bash
cd worker
node migrate-articles.mjs --run     # fetches published articles from Supabase and loads them into D1
```
Without `--run` it only writes SQL files to `worker/migration/`. Run this while Supabase still responds;
if it is fully down, restore from a Supabase backup/export and load that SQL into D1 the same way.
