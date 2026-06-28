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

> **Google sign-in** — enable in Authentication ▸ Providers ▸ **Google** (Client ID + secret
> from Google Cloud Console). Then set **Authentication ▸ URL Configuration**:
>
> | Setting | Value |
> |---------|-------|
> | **Site URL** | `https://familypause.com/app` |
> | **Redirect URLs** | Add each origin your app runs on (Supabase must allow the exact URL the client sends): |
>
> ```
> http://localhost:5173/app
> http://localhost:5173/reset-password
> https://familypause.com/app
> https://familypause.com/reset-password
> https://www.familypause.com/app
> https://www.familypause.com/reset-password
> ```
>
> The app uses `redirectTo: \`${window.location.origin}/app\`` for Google OAuth and
> `\`${window.location.origin}/reset-password\`` for password reset — so localhost works
> in dev and `familypause.com` in production with no hardcoded redirect in code.

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

## Speech-to-text (Whisper) — deploy `transcribe` + free Groq key ~3 min

Dictation records audio in the browser (works in **Brave**) and sends it to **Groq Whisper**
on save (free tier — no credit card). Without a server key, the app falls back to on-device
Whisper (~40 MB first-time download, slower).

```bash
cd ~/Desktop/familypause
supabase functions deploy transcribe
supabase secrets set GROQ_API_KEY=gsk_...   # free: https://console.groq.com/keys
```

Also add **`GROQ_API_KEY`** to Vercel (Project ▸ Settings ▸ Environment Variables) as a
fallback via `/api/transcribe`, then **Redeploy**.

On Brave desktop, live words while speaking are not available (browser blocks speech APIs).
You will see a recording timer and reactive waveform; text appears in the box after you tap **✓**.

## Known caveats for this test build
- **Google sign-in** needs provider setup in Supabase — use email/password for now.
- **Email confirmation is off** for testing — turn it back on before launch.
- **Stripe** uses Checkout Sessions + webhooks — see §6 below (required for paid plans to unlock in-app).

---

## 6 — Stripe (Checkout + Webhooks) ~15 min

Payments now run through **Stripe Checkout** (edge function `stripe-checkout`) so each
purchase carries your `workspace_id`. A **webhook** (`stripe-webhook`) updates
`subscriptions` and unlocks digital decks automatically.

### A — Create products & prices in Stripe

In **Stripe Dashboard → Product catalog**, create:

| Product | Type | Price | Secret name |
|---------|------|-------|-------------|
| Family Plan | Recurring, yearly | $59/yr | `STRIPE_PRICE_FAMILY` |
| Family Pro | Recurring, yearly | $99/yr | `STRIPE_PRICE_PRO` |
| Digital deck | One-time | $12 | `STRIPE_PRICE_DIGITAL` |

Copy each **Price ID** (`price_...`) — you will set them as Supabase secrets.

### B — Deploy edge functions & secrets

```bash
cd ~/Desktop/familypause
supabase functions deploy stripe-checkout
supabase functions deploy stripe-webhook --no-verify-jwt

supabase secrets set STRIPE_SECRET_KEY=sk_live_...          # or sk_test_... for testing
supabase secrets set STRIPE_PRICE_FAMILY=price_...
supabase secrets set STRIPE_PRICE_PRO=price_...
supabase secrets set STRIPE_PRICE_DIGITAL=price_...
```

### C — Register the webhook in Stripe

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**
2. Endpoint URL:
   `https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/stripe-webhook`
3. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the **Signing secret** (`whsec_...`) and run:
   ```bash
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   ```

### D — Run SQL migration (idempotency table)

Re-run the bottom of **`supabase_setup.sql`** in the SQL Editor (adds
`stripe_webhook_events` + unique index on `subscriptions.workspace_id`). Safe to re-run.

### E — Optional Payment Link fallbacks (Vercel)

If checkout is misconfigured, the app falls back to static Payment Links. Set in Vercel:

- `VITE_STRIPE_FAMILY_ANNUAL`
- `VITE_STRIPE_FAMILY_PRO`
- `VITE_STRIPE_CARD_DIGITAL`

> Payment Links **without** checkout metadata will **not** auto-unlock the workspace.
> Prefer Checkout Sessions for production.

### F — Test the flow

1. Sign in → Settings → **Upgrade to Pro** (or hit Paywall → Family $59).
2. Complete Stripe test checkout (`4242 4242 4242 4242`).
3. Return to Settings — plan should show **Family** or **Family Pro**.
4. Digital deck: Cards → unlock → **Purchase digital** → after payment,
   `cards_unlocked` should flip true (check Settings → Card decks).

Use **Stripe test mode** until you are ready to go live, then swap secrets to live keys.

---

## 7 — Google Calendar OAuth ~10 min

Connect Google Calendar from **Settings** or **Plan → Add to Calendar**. Tokens are stored
per user on `workspace_members` (each spouse connects their own Google account).

### A — Google Cloud Console

1. Create a project (or use existing) → **APIs & Services → Enable APIs** → enable **Google Calendar API**.
2. **Credentials → Create credentials → OAuth client ID → Web application**.
3. Authorized redirect URI:
   `https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/google-calendar-callback`
4. Copy **Client ID** and **Client secret**.

### B — Supabase secrets

```bash
supabase secrets set GOOGLE_CLIENT_ID=....apps.googleusercontent.com
supabase secrets set GOOGLE_CLIENT_SECRET=GOCSPX-...
supabase secrets set GOOGLE_OAUTH_STATE_SECRET=$(openssl rand -hex 32)
supabase secrets set GOOGLE_APP_ORIGIN=https://familypause.com
```

### C — Deploy edge functions

```bash
supabase functions deploy google-calendar-auth
supabase functions deploy google-calendar-callback --no-verify-jwt
supabase functions deploy calendar-sync
```

### D — Run SQL migration

Re-run the **Google Calendar** block in **`supabase_setup.sql`** (adds token columns +
`members_update` RLS policy). Safe to re-run.

### E — Test the flow

1. Settings → **Connect Google Calendar** → grant `calendar.events` access.
2. Complete a weekly sync with dated kept items → Plan → **Add to Calendar**.
3. Sync modal: add 2 events, skip 1 → summary shows counts; Plan rows show **Synced** badges.
4. Verify events appear in Google Calendar (primary calendar).

OAuth consent screen must be in **Testing** or **Production** with your Google account added as a test user until the app is verified.
