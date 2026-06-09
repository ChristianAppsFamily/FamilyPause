# FamilyPause — Deploy to Vercel (live test)

Goal: get a live URL you can sign into, click through, and report bugs from.
Front door is the **Landing page** at `/`; the app lives at `/app`.

Estimated time: ~20 minutes. You'll need a free Supabase account, an Anthropic key,
a GitHub account, and a Vercel account.

---

## 1 — Supabase (database + auth) ~8 min

1. Go to **https://supabase.com** → **New project**. Name it `familypause`, pick a
   region near you, set a database password (save it somewhere). Wait ~2 min for it to provision.
2. Left sidebar → **SQL Editor** → **New query**. Open **`supabase_setup.sql`** from this
   repo, copy the WHOLE file, paste it in, and click **Run**. You should see "Success".
   (This creates all tables, security policies, realtime, and the test deck code.)
3. **Turn off email confirmation** (so signup works instantly for testing):
   Left sidebar → **Authentication** → **Sign In / Providers** → **Email** → toggle
   **"Confirm email" OFF** → Save.
4. Get your keys: **Project Settings** (gear) → **API**.
   - Copy **Project URL** → this is `VITE_SUPABASE_URL`
   - Copy the **anon / public** key → this is `VITE_SUPABASE_ANON_KEY`
   - (Do NOT use the `service_role` key — that one is secret.)

> **Google sign-in** is optional. The "Continue with Google" button only works once you
> configure the Google provider in Authentication ▸ Providers. For now, just use
> **email + password** to test. (Clicking Google before it's set up shows an error — expected.)

---

## 2 — Anthropic API key (AI distillation) ~2 min

1. Go to **https://console.anthropic.com** → **API Keys** → **Create Key**.
2. **Recommended:** set a low monthly **spend limit** on this key (Settings ▸ Limits).
3. Copy the key → this is `VITE_ANTHROPIC_KEY`.

> ⚠️ **This key will be visible in the site's public JavaScript** (the AI call runs in the
> browser for now). That's fine for a private test, but **rotate this key and move the call
> to a Supabase Edge Function before any public launch.** Keep the spend limit low.

---

## 3 — Push to GitHub ~3 min

The repo is already committed locally. Create the GitHub repo and push:

```bash
cd ~/Desktop/familypause
# create a PRIVATE repo named "familypause" at https://github.com/new  (do NOT init with a README)
git remote add origin https://github.com/CyberAfroDude/familypause.git
git push -u origin main
```

(If `git remote add` says it already exists, run `git remote set-url origin <your-repo-url>` instead.)

---

## 4 — Vercel ~4 min

1. Go to **https://vercel.com** → **Add New… ▸ Project** → **Import** your `familypause` repo.
2. Vercel auto-detects **Vite** — leave Build Command (`vite build`) and Output (`dist`) as-is.
3. Expand **Environment Variables** and add all three (exact names):

   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | your Supabase Project URL |
   | `VITE_SUPABASE_ANON_KEY` | your Supabase anon key |
   | `VITE_ANTHROPIC_KEY` | your Anthropic key |

4. Click **Deploy**. After ~1 min you'll get a live `*.vercel.app` URL.

> If you change env vars later, you must **redeploy** (Deployments ▸ ⋯ ▸ Redeploy) —
> Vite bakes them in at build time.

---

## 5 — Test it

1. Open the Vercel URL → you should see the **Landing page**.
2. Click **Start Free Week** / **Sign in** → lands on `/app` (Auth screen).
3. Click **Create one free**, make an account → you'll go through **Onboarding** → the **App**.
4. In the app: add a topic → **Distill this week** → paste a few sentences of a fake family
   chat → **Distill it**. The AI should extract cards. Review → **Build my week** → Plan.
5. Open **Settings** (gear, top right) and **Session History** (Log tab) to check those.

### When you report bugs, it helps to include:
- The URL/page you were on, and what you clicked.
- Anything in the browser **Console** (right-click ▸ Inspect ▸ Console) — red errors especially.
- Whether it's a **visual** issue or a **functional/data** issue.

---

## Securing the AI key — deploy the `distill` Edge Function (REQUIRED now)

The AI call was moved to a Supabase Edge Function so the key is no longer in the
browser. After the latest push, the app calls this function — **AI distillation will
not work until you deploy it.** Run these from the project folder (the Supabase CLI is
already installed):

```bash
cd ~/Desktop/familypause
supabase login                                   # opens your browser to authorize
supabase link --project-ref cftzaeoqkepvvnfavphw # your project ref (from your Supabase URL)
supabase functions deploy distill                # deploys supabase/functions/distill
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...# paste your Anthropic key (same one or a fresh one)
```

Then:
1. **Re-run `supabase_setup.sql`** in the SQL Editor (adds the FP-XXXX invite-code
   generator + case-insensitive code matching). Idempotent, safe to re-run.
2. Once you confirm AI distillation works on the live site, **remove `VITE_ANTHROPIC_KEY`
   from Vercel** (Project ▸ Settings ▸ Environment Variables) and **rotate that old key**
   in the Anthropic console — it was exposed in earlier builds.

> The function requires a signed-in user (it verifies the Supabase JWT), so only your
> logged-in users can spend tokens.

## Known caveats for this test build
- **AI key is public** in the bundle (see §2) — rotate before launch.
- **Google sign-in** needs provider setup in Supabase — use email/password for now.
- **Email confirmation is off** for testing — turn it back on before launch.
- **Stripe** buttons (Paywall) use placeholder links — payments aren't wired yet.
- The AI call should later move to a **Supabase Edge Function** (TODO noted in `App.jsx`).
