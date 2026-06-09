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
- Invite code — displays current invite_code from workspace in a copyable JetBrains Mono box with copy button
- Card decks — shows owned decks, links to CardSystem unlock flow
- Subscription — shows current plan and trial days remaining
- Sign out button — calls onSignOut prop passed from AppRouter
- Danger zone — delete workspace with a confirmation step

### Step 9 — Build SessionHistory.jsx
File location: src/components/SessionHistory.jsx
Load past sessions from Supabase sessions table ordered by meeting_date descending.
Each row shows: date in Playfair Display, day of week, count of kept items, actions, events.
Tappable row expands to show the full card list for that session.
Empty state shows Playfair Display headline "Your history starts this Sunday" with encouraging body copy.

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
  "background_color": "#FAF7F2",
  "theme_color": "#B85C38",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```
Add to index.html inside the head tag:
```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#B85C38">
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
**The design bundle in `project/` is the authoritative visual design.** It was exported
from Claude Design (see `README.md`) and the tokens + component styles in
`project/app/styles.css` and `project/app/screens.css` are the truth. Those tokens are
ported verbatim into **`src/styles/tokens.css`**, which is imported globally in `main.jsx`.
All UI — new and existing — composes those shared classes/tokens. Do not invent new
palettes, button shapes, or radii; use the tokens below.

> Note: earlier drafts of this brief listed an approximate "#B85C38" palette with
> Lora rounded buttons. That is superseded. The exact bundle values are authoritative.

### Terra & Cream tokens (from project/app/styles.css → src/styles/tokens.css)
```
--paper        #FBF6EC  warm paper — page background (with radial gradient, see body)
--paper-2      #F4EAD8  raised surface / segmented controls
--paper-3      #EEE1CC  deeper surface / hover
--paper-card   #FCF8F0  cards and panels
--ink          #2A251D  primary text
--ink-2        #5B5245  secondary copy
--ink-3        #8C8070  labels / metadata / muted
--line         #E6D9C4  borders and dividers
--line-2       #DECFB5  stronger borders
--terra        #BE5A37  terracotta — primary buttons, logo, accents
--terra-d      #A2481F  terracotta dark — hover / tag text
--terra-soft   #F1DDCF  terracotta tag background
--terra-tint   #FAEAE0  terracotta wash — focus rings, light fills
--olive        #5E6B37  olive — Keep / success
--olive-d      #4C5829  olive dark — success text
--olive-soft   #DEE4CB  olive tag background
--olive-tint   #EDF0E1  olive wash — success backgrounds
--gold         #C09740  gold — dates / calendar / events
--gold-soft    #F0E3C0  gold tag background
--red          #C0402F  Discard / destructive
--red-soft     #F6DAD3  / --red-tint #FBEAE5  destructive backgrounds
```
Radii: `--r-sm 7px` (buttons), `--r 12px`, `--r-lg 18px` (panels). Shadows: `--shadow-sm`,
`--shadow`, `--shadow-lg`. Page background is a radial-gradient warm paper (see `body` in tokens.css).

## Typography
Three fonts only. Never substitute.
- **Playfair Display** (weights 500/600/700) — all headlines and display text. h1–h3 are 600. Italic for emotional emphasis phrases.
- **Lora** (400/500/600) — all body copy, input text, conversational UI.
- **JetBrains Mono** (400/500/600) — all labels, metadata, codes, eyebrows, AND **buttons**. Buttons are UPPERCASE, letter-spacing .08em, 7px radius (`.btn` in tokens.css). Eyebrows are UPPERCASE terra at letter-spacing .22em (`.eyebrow`).

### Two button systems (IMPORTANT — don't mix them up)
The design bundle uses **two** distinct button treatments depending on the surface:
- **Standalone prototypes — Auth, Onboarding, Cards (CardSystem):** primary buttons are
  **Lora, sentence-case, 8px radius, soft drop-shadow** (e.g. "Sign In", "Save and Continue",
  "I have the deck"). Small/secondary buttons ("Add") are mono uppercase.
- **Main weekly-sync App** (`App.jsx`, screens.css): buttons are **mono UPPERCASE, .08em,
  7px radius** (`.btn` in tokens.css) — e.g. "DISTILL THIS WEEK", "BUILD MY WEEK".

So: Auth/Onboarding/Cards = Lora buttons; the main App flow = mono buttons. Settings/
SessionHistory/Paywall (new screens, no prototype) follow the main-App mono system.

Load from Google Fonts (per the design bundle):
```
https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&family=JetBrains+Mono:wght@400;500;600&display=swap
```

## Logo mark
The logo asset is `public/uploads/Logo_4.png` (two terracotta rounded pill shapes with a
dot above each — two people standing together; also reads as a pause symbol). Render it in a
38px rounded-square `.mark` (terra gradient fallback). Wordmark is **FamilyPause** in Playfair
Display 600: **`Family` in terra (#BE5A37)** and **`Pause` in ink (#2A251D)** — markup
`<b>Family</b><span>Pause</span>` per the design bundle.

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
- The design bundle (`project/`) and `src/styles/tokens.css` are the visual source of truth — match them; don't introduce off-palette colors, Lora buttons, or new radii
- The three font choices
- The AI model string claude-haiku-4-5
- Supabase table names: workspaces, workspace_members, sessions, deck_codes, subscriptions
- The invite code format FP-YYYY-XXXX-0000
- The provided files unless a specific step requires it

## GitHub
Repository: https://github.com/CyberAfroDude/familypause
Keep private until launch.

## Owner
Spence Longmore — building FamilyPause for personal use and public launch at familypause.com
