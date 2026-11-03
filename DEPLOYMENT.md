# TravelBuddy demo

This prototype is a static mobile-first web app for a pre-registration TravelBuddy demo.
It still deploys as plain HTML, CSS, and JavaScript without a build step.

The demo is community and run-club first. Swipe, match, and 1:1 messages are disabled
in the client. Account creation and login submission are closed. This repository
change does not deploy the site, change its visibility, or add payments.

## Static hosting

Use Vercel or Netlify when a preview host is needed.

- Vercel: import this folder/repository and deploy it as a static project.
- Netlify: deploy this folder with `publish = "."`.

No build command is required.

The Supabase SQL files are for local/admin use only. The Vercel ignore file and
Netlify redirects keep those files out of the public site surface.

Do not drop `supabase/migrations/002_create_swipes.sql`,
`003_create_matches.sql`, or `004_create_messages.sql`. Those historical tables
stay in the schema. The TravelBuddy client does not query them.

## Supabase settings

Open Supabase Dashboard -> Authentication -> URL Configuration only when a
real launch is planned. This demo does not open registration.

- `SUPABASE_URL`: Supabase Project URL, read from `config.js`.
- `SUPABASE_ANON_KEY`: Supabase public anon key, read from `config.js`.

The anon key is designed to be public in browser apps, but Row Level Security
must stay enabled. Never put the service role key in frontend code.

## Demo checklist

- Welcome copy says TravelBuddy and 受付開始前.
- Explore still loads the map and cities.
- Run clubs open with no like, pass, match, or chat actions.
- The community screen has no composer.
- Profile and join buttons stay disabled.
- `node scripts/check-travelbuddy-demo.js` passes.

## Local preview

From this folder:

```sh
python3 -m http.server 4173
```

Then open:

```text
http://localhost:4173
```
