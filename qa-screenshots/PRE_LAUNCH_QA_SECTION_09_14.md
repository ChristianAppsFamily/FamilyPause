# FamilyPause Pre-Launch QA — Sections 9–14

**Site:** https://familypause.com (redirects to https://www.familypause.com)  
**Tested:** 2026-06-23  
**Browser:** Chrome (headless via gstack browse), 1280×800 desktop + 390×844 mobile spot checks  
**Test account:** Fresh signup during session (`fpqa09141782210228@mailinator.com`)  
**Deck code:** `FP-2026-TEST-0001`  
**Screenshots:** `qa-screenshots/section-09-14/`

---

## Executive summary

| Severity | Count |
|----------|-------|
| Critical | 3 |
| Major | 5 |
| Minor | 4 |

**Launch blockers:** All Stripe payment links are still placeholders (403 from Stripe). Supabase Realtime WebSocket authentication fails on every authenticated app screen, which blocks live spouse sync. No `robots.txt` is deployed — crawlers can index the full SPA.

---

## Critical issues

### C1 — Stripe payment links are placeholders (all monetization broken)
**Sections:** 9, 10, 11, 14  
Production bundle (`/assets/index-DrEhYXJM.js`) contains:
- `buy.stripe.com/PLACEHOLDER_card_digital` (card digital $12)
- `buy.stripe.com/PLACEHOLDER_digital_12` (onboarding)
- `buy.stripe.com/PLACEHOLDER_family_59` (paywall Family $59)
- `buy.stripe.com/PLACEHOLDER_pro_99` (paywall Family Pro $99)
- `buy.stripe.com/PLACEHOLDER_pro` (Settings upgrade)

All return **HTTP 403** from Stripe. Users cannot purchase Family Plan, Pro, or digital/physical deck unlock.

**Repro:** Settings → Upgrade to Pro, or Paywall → Upgrade to Family, or Cards → Buy digital $12.  
**Screenshot:** `17-paywall-auth.png`, `11-cards-digital-tab.png`

---

### C2 — Supabase Realtime WebSocket auth failure (spouse sync non-functional)
**Sections:** 12, 14  
On authenticated screens (`/app/settings`, `/app/sync/agenda`), console shows repeated errors:

```
WebSocket connection to 'wss://cftzaeoqkepvvnfavphw.supabase.co/realtime/v1/websocket?apikey=...%0A%0A&vsn=2.0.0'
failed: HTTP Authentication failed; no valid credentials available
```

The `%0A%0A` (double newline) appended to the anon key in the WebSocket URL strongly suggests **`VITE_SUPABASE_ANON_KEY` in Vercel has trailing newlines**. Realtime never connects, so live card sync between spouses cannot work.

**Repro:** Sign in → open DevTools Console on any app screen.  
**Screenshot:** Console captured during `15-settings.png` / `18-app-home.png` session.

---

### C3 — No `robots.txt`; site is fully indexable pre-launch
**Section:** 14  
`GET https://www.familypause.com/robots.txt` returns the SPA `index.html` (200), not a robots file. `vercel.json` rewrites do not exclude `robots.txt`. No `noindex` meta on homepage or `/app`. Search engines can crawl and index the app before launch.

**Repro:** `curl -sL https://www.familypause.com/robots.txt` — returns HTML shell.  
**Codebase:** `vercel.json` rewrite pattern omits `robots.txt`.

---

## Major issues

### M1 — Settings “Open library” does not open Deck Library
**Section:** 9  
Settings → **Open library** navigates to `/app/cards` but always renders the **card draw** view. `cardDeckInitialView()` in `App.jsx` hardcodes `"draw"`; `onOpenDecks` only calls `navigate("/app/cards")` without `initialView="library"`.

**Repro:** Unlock a deck → Settings → Card decks → Open library → see “Draw This Week's Card”, not “Card Deck Library”.  
**Screenshot:** `15-settings.png` (button visible); library view not reached.

---

### M2 — Faith Mode toggle missing from Settings
**Section:** 10  
QA brief requires a Faith Mode toggle. `workspaces.faith_mode` exists in schema and `App.jsx` reads it for AI distillation, but **Settings.jsx has no UI** to toggle it.

**Repro:** Sign in → Settings → no Faith Mode control anywhere on page.  
**Screenshot:** `15-settings.png`

---

### M3 — Settings missing “Send via Text” for invite
**Section:** 10  
Onboarding step 3 includes **Send via Text** (`sms:` link). Settings invite section only has **Copy** — no SMS share option (brief expects it on mobile).

**Repro:** Settings → Invite code → only Copy button present.

---

### M4 — Direct `/app/paywall` URL shows wrong copy during active trial
**Section:** 11  
Navigating to `/app/paywall` while subscription shows **7 days left** still displays headline **“Your free trial has ended”** because `paywallBlock` is null and `Paywall` defaults to `reason="trial"`. Gating via distill may work correctly; direct URL is misleading.

**Repro:** Active trial account → visit `https://www.familypause.com/app/paywall`.  
**Screenshot:** `17-paywall-auth.png` (shows “trial ended” while Settings showed 7 days remaining).

---

### M5 — `/cards` product page does not exist
**Section:** 9, 14  
Card unlock UI links to `familypause.com/cards` for the $24 physical deck. That URL serves the **main SPA** (same as homepage), not a product/checkout page.

**Repro:** Visit `https://www.familypause.com/cards` — generic FamilyPause shell, no deck product content.

---

## Minor issues

### m1 — `familypause.com` vs `www.familypause.com` redirect chain
Bare domain 308s to `www`. Not broken, but bookmark/share links may differ. HTTPS and HSTS present on `www`.

### m2 — Protected routes redirect unauthenticated users to sign-in (expected)
`/app/cards`, `/app/settings`, `/app/paywall` all redirect to sign-in when logged out. **Pass** for security; deep links require auth first.  
**Screenshots:** `02-paywall-unauth.png`, `03-cards-unauth.png`, `04-settings-unauth.png`

### m3 — Invalid deck code error copy slightly differs from design
Invalid code shows “Code not found. Check the card inside your box lid.” (acceptable; brief expected similar error).  
**Screenshot:** `12-cards-invalid-code.png`

### m4 — PageSpeed Insights API quota exceeded
Could not retrieve Lighthouse scores programmatically (Google API 429). Manual run at pagespeed.web.dev recommended.

---

## Section 9 — Card System

| Item | Result | Notes |
|------|--------|-------|
| Locked state before unlock | **Pass** | Onboarding step 5 shows unlock UI with code + digital tabs |
| Unlock tabs (code / digital) | **Pass** | Tab switching works |
| Code uppercase input | **Pass** | Auto-uppercase on entry |
| Unlock button inactive when empty | **Pass** | Button present; enabled only with code |
| Valid code `FP-2026-TEST-0001` | **Pass** | Unlocks deck, navigates to card draw |
| Invalid code error state | **Pass** | Error message shown |
| Digital purchase Stripe link | **Fail (C1)** | Placeholder URL |
| Card draw + flip | **Pass** | Drew card #12 Kids category |
| Start Recording / different card | **Pass** | Buttons present after draw |
| Deck Library | **Fail (M1)** | Not reachable from Settings “Open library” |
| Get deck link (`/cards`) | **Fail (M5)** | No product page |
| Skip to session | **Pass** | “Skip and start session without a card” visible |

**Screenshots:** `09-onboarding-cards-unlock.png` through `14-card-drawn.png`

---

## Section 10 — Settings

| Item | Result | Notes |
|------|--------|-------|
| All sections load | **Pass** | Family, invite, decks, subscription, sign out, danger zone |
| Family members editable | **Pass** | Parents/kids/businesses with Save |
| Invite code displayed | **Pass** | `FP-KEJX-WSYA` in mono box |
| Copy invite | **Pass** | Button toggles (clipboard not verified in headless) |
| Send via Text | **Fail (M3)** | Not in Settings (only Onboarding) |
| Faith Mode toggle | **Fail (M2)** | Not implemented in UI |
| Subscription plan + trial days | **Pass** | “Free”, “7 days left” |
| Sign out | **Pass** | Returns to sign-in; back button does not restore session |
| Upgrade to Pro link | **Fail (C1)** | `PLACEHOLDER_pro` |

**Screenshot:** `15-settings.png`, `19-after-signout.png`

---

## Section 11 — Paywall

| Item | Result | Notes |
|------|--------|-------|
| Trigger via expired trial / AI limit | **Not Tested** | Trial still active; did not force expiry |
| Paywall UI when URL visited | **Pass** (layout) / **Fail (M4)** (copy) | Both plan cards visible; wrong headline on direct URL |
| Family Plan featured | **Pass** | Terracotta featured card, $59/yr |
| CTA Stripe links | **Fail (C1)** | Placeholder URLs |

**Screenshot:** `17-paywall-auth.png`

---

## Section 12 — Invite and Workspace Sync

| Item | Result | Notes |
|------|--------|-------|
| Two-account invite join flow | **Not Tested** | Requires second browser session + invite redemption E2E |
| Live card sync between spouses | **Not Tested** | Blocked by C2 (Realtime WebSocket auth failure) |
| Single invite slot / filled state | **Not Tested** | Depends on two-account flow |

**Reason:** Realtime channel cannot authenticate (C2). Multi-account sync cannot be validated until env key is fixed and two sessions are run in parallel.

**Partial pass:** Join URL `/join/FP-TEST` pre-fills invite code on join form.  
**Screenshot:** `05-join-invite.png`

---

## Section 13 — Email Flows

| Item | Result | Notes |
|------|--------|-------|
| Welcome email | **Not Tested** | No inbox access for test signup email during automated run |
| Password reset email | **Not Tested** | “Send password reset” visible in Settings but inbox not monitored |
| Sunday reminder | **Not Tested** | No test trigger environment documented |

**Reason:** Requires real mailbox monitoring (Mailinator/manual) and Resend template verification outside headless scope.

---

## Section 14 — Performance and Technical

| Item | Result | Notes |
|------|--------|-------|
| PageSpeed mobile | **Not Tested** | Google PSI API quota exceeded (429) |
| PageSpeed desktop | **Not Tested** | Same |
| Console — landing | **Pass** | No errors |
| Console — sign in | **Pass** | No errors |
| Console — app home / settings | **Fail (C2)** | Realtime WebSocket errors |
| Console — review screen | **Not Tested** | Full distill → review flow not run in this session |
| HTTPS all pages | **Pass** | `strict-transport-security` on www; HTTP → HTTPS redirect |
| robots / indexing | **Fail (C3)** | No robots.txt; no noindex |
| manifest.json | **Pass** | Valid JSON, icons 200 |
| PWA icons | **Pass** | `/icon-192.png`, `/icon-512.png` return 200 |
| External — Bible Gateway link | **Pass** | Landing footer link returns 200 |
| External — Stripe links | **Fail (C1)** | All placeholders 403 |
| External — `/cards` deck link | **Fail (M5)** | SPA fallback, not product page |
| External — Google Calendar | **Not Tested** | Requires completed session with calendar action |

**Screenshots:** `06-landing-desktop.png`, `07-landing-mobile.png`, `01-app-signin.png`

---

## Issue log (formatted)

1. **Section 11 / Critical** — All Stripe payment URLs are `PLACEHOLDER_*` strings; purchases return 403. Repro: tap any Upgrade or Purchase button. Screenshot: `17-paywall-auth.png`. Chrome desktop.

2. **Section 12 / Critical** — Supabase Realtime WebSocket fails auth (`%0A%0A` in apikey param). Repro: sign in, open Console on `/app/settings`. Screenshot: session `15-settings.png`. Chrome desktop.

3. **Section 14 / Critical** — `robots.txt` serves SPA HTML; site indexable. Repro: fetch `/robots.txt`. Chrome desktop.

4. **Section 9 / Major** — Settings “Open library” opens card draw, not Deck Library. Repro: unlock deck → Settings → Open library. Chrome desktop.

5. **Section 10 / Major** — Faith Mode toggle absent from Settings. Repro: Settings after sign-in. Screenshot: `15-settings.png`.

6. **Section 10 / Major** — No “Send via Text” on Settings invite section. Repro: compare Onboarding step 3 vs Settings.

7. **Section 11 / Major** — `/app/paywall` shows “trial ended” during active trial. Repro: visit paywall URL with 7 days remaining. Screenshot: `17-paywall-auth.png`.

8. **Section 9 / Major** — `familypause.com/cards` is not a product page. Repro: open `/cards`.

---

## Health score (Sections 9–14): **4.5 / 10**

Card unlock and draw flows work well. Settings structure is solid. Monetization, realtime sync, SEO gating, and several Settings brief items are not launch-ready.

---

*Report-only QA — no code changes made.*
