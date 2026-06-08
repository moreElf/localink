# Localink MVP Deployment

This prototype is a static mobile-first web app. It can be deployed as plain
HTML, CSS, and JavaScript without a build step.

## Recommended First Deploy

Use Vercel or Netlify for the first public MVP link.

- Vercel: import this folder/repository and deploy it as a static project.
- Netlify: deploy this folder with `publish = "."`.

No build command is required.

The Supabase SQL files are for local/admin use only. The Vercel ignore file and
Netlify redirects keep those files out of the public MVP surface.

## Supabase Settings To Check

Open Supabase Dashboard -> Authentication -> URL Configuration.

After deployment, set:

- Site URL: your deployed production URL.
- Redirect URLs: your deployed production URL.

For local testing, keep these redirect URLs too:

- `http://localhost:4173`
- `http://localhost:4174`
- `http://localhost:4185`
- `file:///Users/moreelf/Documents/Codex/2026-05-27/i-want-to-create-an-app/index.html`

## Frontend Supabase Keys

The current static prototype reads Supabase settings from `config.js`.

- `SUPABASE_URL`: Supabase Project URL.
- `SUPABASE_ANON_KEY`: Supabase public anon key.

The anon key is designed to be public in browser apps, but Row Level Security
must stay enabled. Never put the service role key in frontend code.

## Pre-Deploy Checklist

- Run all Supabase migrations in `supabase/migrations`.
- Run the sample seed only if you still need demo Local profiles.
- Confirm RLS policies allow the expected authenticated reads.
- Confirm login works with a real email/password user.
- Confirm profile completion works with at least 3 media uploads.
- Confirm Local mode creates or updates `local_host_profiles`.
- Confirm Explore -> Local list -> Local detail works after refresh.

## Quick Local Preview

From this folder:

```sh
python3 -m http.server 4173
```

Then open:

```text
http://localhost:4173
```
