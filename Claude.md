# FamilyPause — Claude Code Project Brief

## What this is
FamilyPause is a web app for married couples. They record or paste their weekly family meeting transcript, AI extracts every action item and appointment, they review each item with Keep / Discard / Add to Calendar, and their week is organized by person automatically. Built by Spence Longmore.

## Live URL
familypause.com (not yet deployed — this is the build session)

## Tech stack
- React 18 + Vite 5
- Supabase (auth, database, realtime, edge functions)
- Anthropic Claude API (claude-haiku-4-5) for AI distillation
- Vercel for hosting
- Stripe for payments
- Resend for email
- Namecheap for DNS

## File structure
```
familypause/
├── CLAUDE.md                  ← you are here
├── .env.local                 ← secret keys, never commit
├── .gitignore                 ← .env.local must be listed
├── index.html
├── package.json
├── vite.config.js
├── public/
│   ├── manifest.json          ← PWA config (needs to be built)
│   ├── sw.js                  ← service worker (needs to be built)
│   ├── privacy.html           ← needs to be built
│   └── terms.html             ← needs to be built
└── src/
    ├── main.jsx               ← renders <AppRouter />
    ├── AppRouter.jsx          ← top level router (PROVIDED)
    ├── App.jsx                ← main app flow (PROVIDED)
    ├── lib/
    │   └── supabase.js        ← supabase client (needs to be created)
    └── components/
        ├── Auth.jsx           ← auth screens (PROVIDED)
        ├── Onboarding.jsx     ← onboarding flow (PROVIDED)
        ├── CardSystem.jsx     ← card deck system (PROVIDED)
        ├── Settings.jsx       ← settings page (needs to be built)
        ├── SessionHistory.jsx ← past sessions (needs to be built)
        └── Paywall.jsx        ← upgrade screen (needs to be built)
```

## Environment variables
Create .env.local in project root with these three keys:
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_ANTHROPIC_KEY=your_anthropic_api_key
```
Never commit .env.local. Confirm it is in .gitignore before first push.

## Supabase setup
Run familypause_schema.sql in Supabase SQL Editor before starting.
That file creates: workspaces, workspace_members, sessions, deck_codes tables plus RLS policies and realtime on sessions.

After running the schema also run these additional columns:
```sql
alter table workspaces
  add column if not exists cards_unlocked boolean default false,
  add column if not exists unlocked_deck_years integer[] default '{}',
  add column if not exists deck_unlocked_at timestamptz;

create table if not exists subscriptions (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid references workspaces(id),
  stripe_customer_id text,
  stripe_sub_id     text,
  plan              text default 'free',
  trial_started_at  timestamptz default now(),
  trial_ends_at     timestamptz default now() + interval '7 days',
  active            boolean default true,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

insert into deck_codes (code, deck_year, batch)
values ('FP-2026-TEST-0001', 2026, 'dev-test');
```

## Files provided — do not rewrite these unless asked
- App.jsx — main app. NOTE: rewritten to PORT the design bundle's real 5-step weekly-sync flow (project/app: app.jsx, views.jsx, review.jsx, screens.css) — Agenda → Capture → Distill → Review → Plan, with step rail, Meeting Assistant rail, and person-routed plan. Wired to real Anthropic distill, Supabase session save + realtime, live speech capture, and family_context. Earlier "Selahon7" single-screen version is gone.
- AppRouter.jsx — session detection, routes between auth/onboarding/app
- Auth.jsx — sign in, sign up, forgot password, join via invite
- Onboarding.jsx — 4 step new user setup
- CardSystem.jsx — card draw locked/unlocked, unlock deck, deck library, all 52 questions

## What needs to be built in this session
Work through these in order. Do not skip ahead. Confirm each step works before moving to the next.

### Step 1 — Project scaffold
```bash
npm create vite@latest . -- --template react
npm install
npm install @supabase/supabase-js react-router-dom
```

### Step 2 — Create src/lib/supabase.js
```javascript
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

### Step 3 — Update src/main.jsx
```javascript
import React from 'react'
import ReactDOM from 'react-dom/client'
import AppRouter from './AppRouter.jsx'
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><AppRouter /></React.StrictMode>
)
```

### Step 4 — Move provided files into correct locations
- App.jsx → src/App.jsx
- AppRouter.jsx → src/AppRouter.jsx
- Auth.jsx → src/components/Auth.jsx
- Onboarding.jsx → src/components/Onboarding.jsx
- CardSystem.jsx → src/components/CardSystem.jsx
Create src/components/ folder if it does not exist.

### Step 5 — Verify all import paths
Check every import across all files. Confirm:
- AppRouter imports Auth from ./components/Auth
- AppRouter imports Onboarding from ./components/Onboarding
- AppRouter imports App from ./App
- AppRouter imports supabase from ./lib/supabase
- Auth imports supabase from ../lib/supabase
- Onboarding imports supabase from ../lib/supabase
- CardSystem imports supabase from ../lib/supabase

### Step 6 — Create .env.local and .gitignore
Create .env.local with the three placeholder keys.
Confirm .env.local is listed in .gitignore.

### Step 7 — Run dev server and confirm
```bash
npm run dev
```
App must load at localhost:5173 showing the Auth sign in screen with no console errors before moving on.

### Step 8 — Build Settings.jsx
File location: src/components/Settings.jsx
Sections needed:
- Family members — editable list, saves to workspace family_context in Supabase
- Invite code — displays current invite_code from workspace in a copyable monospace box with copy button
- Card decks — shows owned decks, links to CardSystem unlock flow
- Subscription — shows current plan and trial days remaining
- Sign out button — calls onSignOut prop passed from AppRouter
- Danger zone — delete workspace with a confirmation step

### Step 9 — Build SessionHistory.jsx
File location: src/components/SessionHistory.jsx
Load past sessions from Supabase sessions table ordered by meeting_date descending.
Each row shows: date in Plus Jakarta Sans, day of week, count of kept items, actions, events.
Tappable row expands to show the full card list for that session.
Empty state shows Plus Jakarta Sans headline "Your history starts this Sunday" with encouraging body copy.

### Step 10 — Build Paywall.jsx
File location: src/components/Paywall.jsx
Shown when trial expires or free user tries to run AI distillation.
Two plan cards side by side: Family Plan $59/year featured in terracotta, free tier with 1 AI session per month note.
Stripe payment link buttons — use placeholder URLs, Spence will replace with real links.
Note at bottom: no credit card required for trial.

### Step 11 — Wire session save into App.jsx
After the review phase when user taps See Plan, insert to Supabase:
```javascript
await supabase.from('sessions').insert({
  workspace_id: workspace.id,
  meeting_date: meetingDate,
  transcript: inputMode === 'record' ? transcript : pasteText,
  input_mode: inputMode,
  cards: cards,
  status: 'complete',
  created_by: user.id,
});
```

### Step 12 — Wire realtime sync into App.jsx
Add Supabase channel subscription so both spouses see updates live:
```javascript
useEffect(() => {
  if (!workspace?.id) return;
  const channel = supabase
    .channel('session-sync')
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'sessions',
      filter: `workspace_id=eq.${workspace.id}`,
    }, (payload) => {
      if (payload.new.cards) setCards(payload.new.cards);
    })
    .subscribe();
  return () => supabase.removeChannel(channel);
}, [workspace?.id]);
```

### Step 13 — Create PWA manifest
Create public/manifest.json:
```json
{
  "name": "FamilyPause",
  "short_name": "FamilyPause",
  "description": "The weekly reset every family needs",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FFFFFF",
  "theme_color": "#14805E",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```
Add to index.html inside the head tag:
```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#14805E">
```

### Step 14 — Deploy to Vercel
```bash
git init
git add .
git commit -m "initial commit — FamilyPause v1"
git remote add origin https://github.com/CyberAfroDude/familypause.git
git push -u origin main
```
Then in Vercel: import repo, add the three env vars, deploy.

---

## Design system — VISUAL SOURCE OF TRUTH
**Evergreen and Sunshine (emerald + sun) is the design system for the whole product** — landing,
marketing pages, auth, onboarding, the weekly-sync app, cards, settings, paywall, legal pages,
and emails. Marketing homepage source: `FamilyPause_ProtoType/` (ported as React). In-app
patterns still follow `FamilyPause App Screens.html`. It replaced the old Terra & Cream system
(Playfair / Lora / JetBrains Mono, terracotta) everywhere.

- `src/styles/tokens.css` — global app tokens + shared classes (`.btn`, `.eyebrow`, `.tag`,
  `.field`, `.brand`, `.steps`) and self-hosted `@font-face` for Plus Jakarta Sans and Inter
  (`public/fonts/`). Legacy variable names (`--terra`, `--olive`, `--gold`, `--paper`,
  `--display`, `--serif`, `--mono`) are kept as **aliases** of the v2 values so existing CSS
  keeps working. Prefer the v2 names (`--em`, `--sun`, `--hd`, `--bd`) in new code.
- `src/styles/site.css` — landing and marketing chrome styles, scoped under `.fp-site`.
- `src/components/SiteChrome.jsx` — shared marketing nav + footer + tilted `FpMark` / `FpLogo`;
  used by Landing and `MarketingChrome` (blog, contact, cards, mobile).

### Tokens
```
--em       #14805E  emerald — primary buttons, links, accents, Keep / success
--em-d     #0F6A4D  emerald dark — hover, tag text
--em-50    #E3F1EB  emerald tag background
--mint     #EEF6F2  mint wash — soft surfaces, focus fills
--sun      #FFB547  sun — logo heads, highlights, badges
--sun-50   #FFF4E0  sun tag background
--ink      #0F172A  primary text      --ink-2 #475569 secondary   --ink-3 #94A3B8 muted
--line     #E5E7EB  borders           --line-2 #D1D5DB stronger borders
--red      #DC2626  Discard / destructive (--red-soft #FEE2E2, --red-tint #FEF2F2)
person colors: blue #3B82F6 (person 1), violet #8B5CF6 (person 2), amber #F59E0B (shared), coral #FF6F61
```
Page background is plain white. Radii: `--r-sm 10px`, `--r 14px` (inputs), `--r-lg 20px`
(cards/panels); **buttons are pills (9999px)**. Shadows are soft slate (`rgba(15,23,42,…)`);
primary buttons use the emerald `--btn-sh`.

## Typography
Two fonts only.
- **Plus Jakarta Sans** 800 — all headlines/display, letter-spacing -.03em. No italics; emphasize
  a phrase by coloring it emerald (`h1 em` renders upright in emerald).
- **Inter** 400/500/600/700 — body, inputs, labels, eyebrows, buttons. Everything is sentence case;
  no uppercase mono labels, no wide letter-spacing. Eyebrows are Inter 600 emerald.

Buttons: Inter 600, sentence case, pill radius. Primary = emerald fill; secondary = white with
1.5px ink border (`.btn-ghost` / landing `.btn-s`); soft = mint fill.

Fonts are self-hosted in `public/fonts/` (`plus-jakarta-sans.woff2`, `inter.woff2`) with
`@font-face` in `src/styles/tokens.css`. Family names stay `'Plus Jakarta Sans'` and `'Inter'`
so existing stacks keep working. Do not add Google Fonts links.

## Logo mark
Two emerald pills, each tilted 6° outward, with a sun-gold dot above each (two people standing
together; also reads as pause). Files: `public/fp-mark.svg` (UI), `public/fp-mark.png` (jsPDF
export), `public/favicon.svg`, `icon-192/512.png`. Inline SVG: `FpMark` / `FpLogo` in
`SiteChrome.jsx`. Wordmark is Plus Jakarta Sans 800: `Family` in ink, `Pause` in emerald
(on dark/emerald backgrounds: white pills, `Pause` in sun).

## Pricing model
- Free — 7 day full trial, then manual use only, 1 AI session per month free
- Family Plan — $59/year, unlimited AI, session history, spouse sync, kids name routing
- Family Pro — $99/year, everything plus recurring item memory and kids profiles
- Church/Ministry — $39/month, up to 10 workspaces

## Card deck system — critical context
The card draw feature inside the app is locked by default. Users unlock it by:
1. Buying the physical deck at $24 — a printed card comes with a code inside the box lid formatted FP-2026-XXXX-0000. They enter it in the app.
2. Buying digital only at $12 via Stripe — workspace flag flips automatically on payment.

Cards never expire. One deck per year. 2026 deck has 52 questions across 6 categories already written inside CardSystem.jsx. 2027 deck shell is also in CardSystem.jsx ready to populate.

Test code for development: FP-2026-TEST-0001 (insert via the SQL in Supabase setup section above)

## AI call
The AI distillation call hits the Anthropic API directly from the browser during development. In production this must move to a Supabase Edge Function to protect the API key. Do not move it during this build session — flag it as a TODO comment in App.jsx for the Cursor session.

Model string: claude-haiku-4-5
Max tokens: 1000

## What NOT to change
- The evergreen system (`src/styles/tokens.css`, `src/styles/site.css`) — don't introduce off-palette colors, non-pill buttons, uppercase mono labels, or new fonts
- The AI model string claude-haiku-4-5
- Supabase table names: workspaces, workspace_members, sessions, deck_codes, subscriptions
- The invite code format FP-YYYY-XXXX-0000
- The provided files unless a specific step requires it

## GitHub
Repository: https://github.com/CyberAfroDude/familypause
Keep private until launch.

## Owner
Spence Longmore — building FamilyPause for personal use and public launch at familypause.com

## gstack (recommended)

This project uses [gstack](https://github.com/garrytan/gstack) for AI-assisted workflows.
Install it for the best experience:

```bash
git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup --team
```

Skills like /qa, /ship, /review, /investigate, and /browse become available after install.
Use /browse for all web browsing. Use ~/.claude/skills/gstack/... for gstack file paths.
