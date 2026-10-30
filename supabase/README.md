# Backend functions (new Supabase project)

`functions/fetch-trending` — finds new stories from the enabled `news_sources` (Admin > Auto-post trending news,
and automatically every 3 hours by the `fetch-trending-3h` scheduled job) and copies picture links into our own storage.
Only a signed-in Buza admin or the scheduler (secret in `app_secrets.cron_secret`) may call it.

Deployed with `verify_jwt = false` because the function does its own admin check.
Not yet rebuilt from the original project: social-poster, send-push, search-news, search-youtube, translate-en, make-joke, share.
